import { Injectable } from '@nestjs/common';
import {
  assignmentMergedSchema,
  assignmentProgress,
  examState,
  findGame,
  isGameForLearner,
  isLessonForLearner,
  learnerOf,
  sortForStudent,
  sortProgressRows,
  STUDENT_HISTORY_DAYS,
  type AssignableLesson,
  type AssignmentDetail,
  type AssignmentErrorCode,
  type AssignmentProgressRow,
  type AssignmentSummary,
  type AssignmentTarget,
  type Completion,
  type Learner,
  type PlayAssignment,
  type assignmentCreateSchema,
  type assignmentUpdateSchema,
} from '@novel/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../common/errors.js';
import { AttemptsService } from '../exams/attempts.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Create = z.output<typeof assignmentCreateSchema>;
type Update = z.output<typeof assignmentUpdateSchema>;

const invalid = (code: AssignmentErrorCode, message: string) =>
  badRequest(code, message);

const assignmentInclude = {
  lesson: {
    select: {
      id: true,
      title: true,
      stage: true,
      grade: true,
      isPublished: true,
    },
  },
  exam: {
    select: {
      id: true,
      title: true,
      stage: true,
      grade: true,
      isPublished: true,
      opensAt: true,
      closesAt: true,
      maxAttempts: true,
    },
  },
  classes: { include: { classGroup: { select: { id: true, name: true } } } },
} satisfies Prisma.AssignmentInclude;

type AssignmentRow = Prisma.AssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

const studentSelect = {
  id: true,
  displayName: true,
  username: true,
  classId: true,
  classGroup: { select: { name: true, grade: true, isArchived: true } },
} satisfies Prisma.StudentSelect;

type RosterStudent = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

const DAY_MS = 24 * 3600_000;

/** Em có làm được nội dung của bài không (đúng cấp học / khối của Unit, game, đề). */
function fitsLearner(a: AssignmentRow, learner: Learner): boolean {
  const content = a.kind === 'lesson_game' ? a.lesson : a.exam;
  if (!content || !isLessonForLearner(content, learner)) return false;
  if (a.kind === 'lesson_game') {
    const def = a.gameSlug ? findGame(a.gameSlug) : undefined;
    if (!def || !isGameForLearner(def, learner)) return false;
  }
  return true;
}

/**
 * Bài đề: mọi lượt đã nộp đều tính (đề là nội dung riêng của bài tập).
 * Bài game: chỉ lượt chơi từ lúc giao bài — lượt cũ của cùng Unit không tính.
 */
const progressWindow = (a: AssignmentRow) => ({
  assignedAt: a.kind === 'exam' ? new Date(0) : a.createdAt,
  dueAt: a.dueAt,
});

const passes = (a: AssignmentRow) => (c: Completion) =>
  a.kind === 'exam' ? true : c.value >= a.minStars;

function toTarget(a: AssignmentRow): AssignmentTarget {
  if (a.kind === 'exam') {
    return {
      kind: 'exam',
      exam: { id: a.exam!.id, title: a.exam!.title },
    };
  }
  const slug = a.gameSlug ?? '';
  return {
    kind: 'lesson_game',
    lesson: { id: a.lesson!.id, title: a.lesson!.title },
    game: { slug, name: findGame(slug)?.name ?? slug },
    minStars: a.minStars,
  };
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: AttemptsService,
  ) {}

  // ───────────── Giáo viên ─────────────

  async list(): Promise<AssignmentSummary[]> {
    const rows = await this.prisma.assignment.findMany({
      include: assignmentInclude,
      orderBy: { dueAt: 'desc' },
    });
    const now = new Date();
    return Promise.all(
      rows.map(async (a) => {
        const progress = await this.progressRows(a, now);
        return this.toSummary(a, progress);
      }),
    );
  }

  async get(id: string): Promise<AssignmentDetail> {
    const a = await this.load(id);
    const rows = await this.progressRows(a, new Date());
    return { ...this.toSummary(a, rows), rows };
  }

  async create(data: Create): Promise<AssignmentDetail> {
    await this.checkContent(data);
    const { classIds, ...fields } = data;
    const a = await this.prisma.assignment.create({
      data: {
        ...fields,
        dueAt: new Date(data.dueAt),
        classes: data.forAll
          ? undefined
          : { create: classIds.map((classId) => ({ classId })) },
      },
    });
    return this.get(a.id);
  }

  /** Sửa bài: ghép với bài cũ rồi kiểm tra lại cả bài như lúc tạo. */
  async update(id: string, patch: Update): Promise<AssignmentDetail> {
    const cur = await this.load(id);
    const parsed = assignmentMergedSchema.safeParse({
      title: cur.title,
      note: cur.note,
      kind: cur.kind,
      lessonId: cur.lessonId,
      gameSlug: cur.gameSlug,
      examId: cur.examId,
      minStars: cur.minStars,
      forAll: cur.forAll,
      classIds: cur.classes.map((c) => c.classId),
      dueAt: cur.dueAt.toISOString(),
      ...patch,
    });
    if (!parsed.success) {
      throw invalid('invalid_assignment', parsed.error.issues[0].message);
    }
    const data = parsed.data;
    await this.checkContent(data);
    const { classIds, ...fields } = data;
    await this.prisma.$transaction([
      this.prisma.assignmentClass.deleteMany({ where: { assignmentId: id } }),
      this.prisma.assignment.update({
        where: { id },
        data: {
          ...fields,
          dueAt: new Date(data.dueAt),
          classes: data.forAll
            ? undefined
            : { create: classIds.map((classId) => ({ classId })) },
        },
      }),
    ]);
    return this.get(id);
  }

  /** Xoá bài tập không mất gì: tiến độ nằm ở lượt chơi / bài thi, vẫn còn nguyên. */
  async remove(id: string): Promise<void> {
    await this.load(id);
    await this.prisma.assignment.delete({ where: { id } });
  }

  /** Unit giao được cho bài game: đã công khai và có ít nhất một game đang bật. */
  async assignableLessons(): Promise<AssignableLesson[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { isPublished: true },
      include: { games: { include: { game: true } } },
      orderBy: { title: 'asc' },
    });
    return lessons.flatMap((l) => {
      const games = l.games.flatMap(({ game }) => {
        const def = findGame(game.slug);
        return def && game.isEnabled
          ? [{ slug: def.slug, name: def.name }]
          : [];
      });
      if (games.length === 0) return [];
      games.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      return [
        { id: l.id, title: l.title, stage: l.stage, grade: l.grade, games },
      ];
    });
  }

  /**
   * Kiểm tra nội dung giao có làm được không: Unit / đề đã công khai, game đã gán cho Unit,
   * và mọi lớp được giao đúng cấp học / khối của nội dung.
   */
  private async checkContent(data: Create): Promise<void> {
    let audience: (learner: Learner) => boolean;
    if (data.kind === 'lesson_game') {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: data.lessonId! },
      });
      if (!lesson) throw invalid('unknown_lesson', 'Không tìm thấy Unit');
      if (!lesson.isPublished)
        throw invalid(
          'lesson_unpublished',
          'Unit chưa công khai nên học sinh chưa thấy. Hãy bật "Công khai" cho Unit trước.',
        );
      const def = findGame(data.gameSlug!);
      const game = def
        ? await this.prisma.game.findUnique({
            where: { slug: def.slug },
            include: { lessons: { where: { lessonId: lesson.id } } },
          })
        : null;
      if (!def || !game)
        throw invalid('unknown_game', 'Không tìm thấy trò chơi');
      if (game.lessons.length === 0)
        throw invalid(
          'game_not_in_lesson',
          `Trò chơi "${def.name}" chưa được gán cho Unit này. Mở Trò chơi → chọn Unit cho game trước.`,
        );
      audience = (l) =>
        isLessonForLearner(lesson, l) && isGameForLearner(def, l);
    } else {
      const exam = await this.prisma.exam.findUnique({
        where: { id: data.examId! },
      });
      if (!exam) throw invalid('unknown_exam', 'Không tìm thấy đề');
      if (!exam.isPublished)
        throw invalid(
          'exam_unpublished',
          'Đề chưa công khai nên học sinh chưa làm được. Hãy bật "Công khai" cho đề trước.',
        );
      audience = (l) => isLessonForLearner(exam, l);
    }

    if (data.forAll) return;
    const classes = await this.prisma.classGroup.findMany({
      where: { id: { in: data.classIds } },
    });
    if (classes.length !== data.classIds.length)
      throw invalid('unknown_class', 'Có lớp không tồn tại');
    const wrong = classes.find((c) => !audience(learnerOf(c)));
    if (wrong)
      throw invalid(
        'audience_mismatch',
        `Lớp ${wrong.name} (khối ${wrong.grade}) không làm được nội dung này vì khác cấp học hoặc khối.`,
      );
  }

  private async load(id: string): Promise<AssignmentRow> {
    const a = await this.prisma.assignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
    if (!a) throw notFound('Không tìm thấy bài tập');
    return a;
  }

  /**
   * Những em được giao (tài khoản đang hoạt động). Giao cho tất cả: mọi em đúng cấp học
   * của nội dung, trừ em ở lớp đã lưu trữ. Giao theo lớp: mọi em đang ở các lớp đó.
   */
  private async roster(a: AssignmentRow): Promise<RosterStudent[]> {
    if (a.forAll) {
      const all = await this.prisma.student.findMany({
        where: {
          isActive: true,
          OR: [{ classId: null }, { classGroup: { isArchived: false } }],
        },
        select: studentSelect,
      });
      return all.filter((s) => fitsLearner(a, learnerOf(s.classGroup)));
    }
    if (a.classes.length === 0) return [];
    return this.prisma.student.findMany({
      where: {
        isActive: true,
        classId: { in: a.classes.map((c) => c.classId) },
      },
      select: studentSelect,
    });
  }

  /** Các lần làm tính vào bài (lượt chơi đã xong / bài thi đã nộp), theo từng em. */
  private async completions(
    a: AssignmentRow,
    studentIds: string[],
  ): Promise<Map<string, Completion[]>> {
    const by = new Map<string, Completion[]>();
    const add = (studentId: string, c: Completion) =>
      by.set(studentId, [...(by.get(studentId) ?? []), c]);
    if (studentIds.length === 0) return by;

    if (a.kind === 'exam') {
      // Bài quá giờ chưa nộp được chấm trước, để bảng tiến độ không thiếu em nào.
      await this.attempts.finalizeOverdue({ examId: a.examId! });
      const attempts = await this.prisma.examAttempt.findMany({
        where: {
          examId: a.examId!,
          studentId: { in: studentIds },
          submittedAt: { not: null },
          score: { not: null },
        },
        select: { studentId: true, submittedAt: true, score: true },
      });
      for (const t of attempts)
        add(t.studentId, { at: t.submittedAt!, value: t.score! });
    } else {
      const sessions = await this.prisma.playSession.findMany({
        where: {
          lessonId: a.lessonId!,
          game: { slug: a.gameSlug! },
          studentId: { in: studentIds },
          finishedAt: { gte: a.createdAt },
        },
        select: { studentId: true, finishedAt: true, stars: true },
      });
      for (const s of sessions)
        add(s.studentId, { at: s.finishedAt!, value: s.stars });
    }
    return by;
  }

  private async progressRows(
    a: AssignmentRow,
    now: Date,
  ): Promise<AssignmentProgressRow[]> {
    const students = await this.roster(a);
    const done = await this.completions(
      a,
      students.map((s) => s.id),
    );
    return sortProgressRows(
      students.map((s) => {
        const p = assignmentProgress(
          done.get(s.id) ?? [],
          progressWindow(a),
          passes(a),
          now,
        );
        return {
          student: {
            id: s.id,
            displayName: s.displayName,
            username: s.username,
            classId: s.classId,
            className: s.classGroup?.name ?? null,
          },
          status: p.status,
          doneAt: p.doneAt?.toISOString() ?? null,
          best: p.best,
          tries: p.tries,
        };
      }),
    );
  }

  private toSummary(
    a: AssignmentRow,
    rows: AssignmentProgressRow[],
  ): AssignmentSummary {
    return {
      id: a.id,
      title: a.title,
      note: a.note,
      target: toTarget(a),
      forAll: a.forAll,
      classes: a.classes
        .map((c) => c.classGroup)
        .sort((x, y) => x.name.localeCompare(y.name, 'vi')),
      assignedAt: a.createdAt.toISOString(),
      dueAt: a.dueAt.toISOString(),
      studentCount: rows.length,
      doneCount: rows.filter((r) => r.status === 'done' || r.status === 'late')
        .length,
    };
  }

  // ───────────── Học sinh ─────────────

  /**
   * Bài được giao cho em: theo lớp em đang ở, hoặc giao cho tất cả (đúng cấp học của em).
   * Bài có hạn đã qua quá `STUDENT_HISTORY_DAYS` ngày thì không hiện nữa.
   */
  async listForStudent(studentId: string): Promise<PlayAssignment[]> {
    const now = new Date();
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: studentSelect,
    });
    if (!student) return [];
    const learner = learnerOf(student.classGroup);
    const rows = await this.prisma.assignment.findMany({
      where: {
        dueAt: { gte: new Date(now.getTime() - STUDENT_HISTORY_DAYS * DAY_MS) },
        OR: [
          { forAll: true },
          ...(student.classId
            ? [{ classes: { some: { classId: student.classId } } }]
            : []),
        ],
      },
      include: assignmentInclude,
    });
    const mine = rows.filter(
      (a) =>
        !a.forAll ||
        (!student.classGroup?.isArchived && fitsLearner(a, learner)),
    );
    if (mine.length === 0) return [];

    await this.attempts.finalizeOverdue({ studentId }, now);
    const examIds = mine.flatMap((a) => (a.examId ? [a.examId] : []));
    const lessonIds = mine.flatMap((a) => (a.lessonId ? [a.lessonId] : []));
    const [attempts, sessions, games] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where: { studentId, examId: { in: examIds } },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          examId: true,
          submittedAt: true,
          score: true,
        },
      }),
      this.prisma.playSession.findMany({
        where: {
          studentId,
          lessonId: { in: lessonIds },
          finishedAt: { not: null },
        },
        select: {
          lessonId: true,
          finishedAt: true,
          stars: true,
          game: { select: { slug: true } },
        },
      }),
      this.prisma.game.findMany({
        where: { slug: { in: mine.flatMap((a) => a.gameSlug ?? []) } },
        include: { lessons: { where: { lessonId: { in: lessonIds } } } },
      }),
    ]);
    const gameBySlug = new Map(games.map((g) => [g.slug, g]));

    const list = mine.map((a): PlayAssignment => {
      let completions: Completion[];
      let open: PlayAssignment['open'] = null;
      let unavailable: string | null = null;
      let state: PlayAssignment['examState'] = null;
      let attemptId: string | null = null;

      if (a.kind === 'exam') {
        const exam = a.exam!;
        const mineAttempts = attempts.filter((t) => t.examId === exam.id);
        completions = mineAttempts.flatMap((t) =>
          t.submittedAt && t.score !== null
            ? [{ at: t.submittedAt, value: t.score }]
            : [],
        );
        attemptId =
          mineAttempts.find((t) => t.submittedAt && t.score !== null)?.id ??
          null;
        state = examState(exam, now);
        const inProgress = mineAttempts.some((t) => !t.submittedAt);
        const left =
          exam.maxAttempts === 0 || mineAttempts.length < exam.maxAttempts;
        if (!exam.isPublished || !isLessonForLearner(exam, learner))
          unavailable = 'Thầy cô đang tạm đóng đề này';
        else if (state === 'upcoming') unavailable = 'Đề chưa tới giờ mở';
        else if (state === 'closed') unavailable = 'Đề đã đóng';
        else if (!inProgress && !left)
          unavailable = 'Em đã làm đủ số lần cho đề này';
        else open = { kind: 'exam', examId: exam.id };
      } else {
        const lesson = a.lesson!;
        const slug = a.gameSlug!;
        completions = sessions
          .filter((s) => s.lessonId === lesson.id && s.game.slug === slug)
          .map((s) => ({ at: s.finishedAt!, value: s.stars }));
        const def = findGame(slug);
        const game = gameBySlug.get(slug);
        const playable =
          !!def &&
          !!game?.isEnabled &&
          game.lessons.some((l) => l.lessonId === lesson.id) &&
          lesson.isPublished &&
          isGameForLearner(def, learner) &&
          isLessonForLearner(lesson, learner);
        if (playable)
          open = { kind: 'lesson_game', gameSlug: slug, lessonId: lesson.id };
        else unavailable = 'Thầy cô đang tạm đóng bài này';
      }

      const p = assignmentProgress(
        completions,
        progressWindow(a),
        passes(a),
        now,
      );
      return {
        id: a.id,
        title: a.title,
        note: a.note,
        dueAt: a.dueAt.toISOString(),
        status: p.status,
        doneAt: p.doneAt?.toISOString() ?? null,
        best: p.best,
        open,
        unavailable,
        target: toTarget(a),
        examState: state,
        attemptId,
      };
    });
    return sortForStudent(list);
  }
}
