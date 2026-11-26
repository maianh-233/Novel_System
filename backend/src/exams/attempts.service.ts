import { Injectable } from '@nestjs/common';
import {
  attemptDeadline,
  buildAttemptOrder,
  detailsVisible,
  examState,
  gradeQuestion,
  isLessonForLearner,
  isPastGrace,
  questionKind,
  scoreOutOf10,
  SUBMIT_GRACE_MS,
  toOriginalResponse,
  type AttemptResponse,
  type AttemptResult,
  type AttemptView,
  type ExamErrorCode,
  type Learner,
  type PlayExam,
  type QuestionResponse,
} from '@novel/shared';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { PlayService } from '../play/play.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toGradable } from '../questions/mappers.js';
import {
  attemptInclude,
  examContentInclude,
  layOut,
  passagesOf,
  toItemView,
  toResultItem,
  type AttemptRow,
} from './exam-mappers.js';

const examError = (code: ExamErrorCode, message: string) =>
  conflict(code, message);

/** Đề em thấy được: đã công khai và đúng cấp học / khối (giống quy tắc bài học). */
const visibleTo = (
  e: {
    isPublished: boolean;
    stage: Learner['stage'] | null;
    grade: number | null;
  },
  learner: Learner,
) => e.isPublished && isLessonForLearner(e, learner);

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly play: PlayService,
  ) {}

  /** Đề đang mở / sắp mở, và đề đã đóng mà em từng làm (để xem lại điểm). */
  async listForStudent(studentId: string): Promise<PlayExam[]> {
    const now = new Date();
    await this.finalizeOverdue({ studentId }, now);
    const learner = await this.play.learner(studentId);
    const exams = await this.prisma.exam.findMany({
      where: { isPublished: true },
      include: {
        sections: { select: { _count: { select: { items: true } } } },
        attempts: {
          where: { studentId },
          orderBy: { startedAt: 'desc' },
          select: { id: true, submittedAt: true, score: true },
        },
      },
    });
    const list = exams.flatMap((e): PlayExam[] => {
      if (!visibleTo(e, learner)) return [];
      const state = examState(e, now);
      if (state === 'closed' && e.attempts.length === 0) return [];
      const questionCount = e.sections.reduce((n, s) => n + s._count.items, 0);
      if (questionCount === 0) return [];
      const inProgress = e.attempts.find((a) => !a.submittedAt);
      const last = e.attempts.find((a) => a.submittedAt && a.score !== null);
      return [
        {
          id: e.id,
          title: e.title,
          description: e.description,
          mode: e.mode,
          durationMin: e.durationMin,
          opensAt: e.opensAt?.toISOString() ?? null,
          closesAt: e.closesAt?.toISOString() ?? null,
          questionCount,
          maxAttempts: e.maxAttempts,
          attemptsUsed: e.attempts.length,
          state,
          inProgressAttemptId: inProgress?.id ?? null,
          lastAttempt: last ? { id: last.id, score: last.score! } : null,
        },
      ];
    });
    const rank = { open: 0, upcoming: 1, closed: 2 } as const;
    return list.sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        (a.closesAt ?? '9').localeCompare(b.closesAt ?? '9') ||
        a.title.localeCompare(b.title, 'vi'),
    );
  }

  /** Bắt đầu lượt mới, hoặc trả lại lượt đang làm dở (mất mạng / tắt máy vào lại làm tiếp). */
  async start(studentId: string, examId: string): Promise<AttemptResponse> {
    const now = new Date();
    const learner = await this.play.learner(studentId);
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: examContentInclude,
    });
    if (!exam || !visibleTo(exam, learner)) {
      throw notFound('Không tìm thấy đề');
    }
    await this.finalizeOverdue({ studentId, examId }, now);

    const open = await this.prisma.examAttempt.findFirst({
      where: { examId, studentId, submittedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (open) return this.get(studentId, open.id);

    const state = examState(exam, now);
    if (state === 'upcoming')
      throw examError('exam_not_open', 'Đề chưa tới giờ mở');
    if (state === 'closed') throw examError('exam_closed', 'Đề đã đóng');
    const items = exam.sections.flatMap((s) => s.items);
    if (items.length === 0)
      throw examError('exam_empty', 'Đề chưa có câu hỏi nào');
    if (exam.maxAttempts > 0) {
      const used = await this.prisma.examAttempt.count({
        where: { examId, studentId },
      });
      if (used >= exam.maxAttempts)
        throw examError(
          'no_attempts_left',
          `Em đã làm đủ ${exam.maxAttempts} lần cho đề này`,
        );
    }

    const order = buildAttemptOrder(
      exam.sections.map((s) => ({
        id: s.id,
        items: s.items.map((i) => ({
          id: i.id,
          type: i.question.type,
          optionCount: toGradable(i.question).options.length,
        })),
      })),
      exam.shuffle,
    );
    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        startedAt: now,
        deadlineAt: attemptDeadline(now, exam.durationMin, exam.closesAt),
        maxPoints: items.reduce((sum, i) => sum + i.points, 0),
        order: order as unknown as Prisma.InputJsonValue,
      },
    });
    return this.get(studentId, attempt.id);
  }

  /** Mở lại một lượt: còn làm thì trả bài đang làm; đã nộp / quá hạn thì trả kết quả. */
  async get(studentId: string, attemptId: string): Promise<AttemptResponse> {
    let attempt = await this.load(studentId, attemptId);
    const now = new Date();
    if (!attempt.submittedAt && isPastGrace(attempt.deadlineAt, now)) {
      await this.finalize(attempt, true, now);
      attempt = await this.load(studentId, attemptId);
    }
    if (attempt.submittedAt)
      return { status: 'submitted', result: this.toResult(attempt, now) };
    return { status: 'in_progress', attempt: this.toView(attempt, now) };
  }

  /** Tự lưu một câu. Quá hạn (kể cả 30 giây cho thêm) thì tự nộp những gì đã lưu. */
  async saveAnswer(
    studentId: string,
    attemptId: string,
    itemId: string,
    response: QuestionResponse,
    flagged: boolean,
  ): Promise<{ savedAt: string }> {
    const attempt = await this.load(studentId, attemptId);
    const now = new Date();
    if (attempt.submittedAt)
      throw examError('attempt_submitted', 'Bài đã nộp rồi');
    if (isPastGrace(attempt.deadlineAt, now)) {
      await this.finalize(attempt, true, now);
      throw examError(
        'attempt_expired',
        'Đã hết giờ làm bài. Máy đã nộp những câu em lưu trước đó.',
      );
    }
    const laid = layOut(attempt).all.find((l) => l.item.id === itemId);
    if (!laid)
      throw badRequest('invalid_response', 'Câu này không có trong bài');
    const problem = checkResponse(
      laid.item.question.type,
      response,
      toGradable(laid.item.question).options.length,
    );
    if (problem) throw badRequest('invalid_response', problem);

    const value =
      response === null ? Prisma.DbNull : (response as Prisma.InputJsonValue);
    await this.prisma.examAnswer.upsert({
      where: { attemptId_itemId: { attemptId, itemId } },
      create: { attemptId, itemId, response: value, flagged },
      update: { response: value, flagged },
    });
    return { savedAt: now.toISOString() };
  }

  async submit(studentId: string, attemptId: string): Promise<AttemptResponse> {
    const attempt = await this.load(studentId, attemptId);
    const now = new Date();
    if (!attempt.submittedAt) {
      await this.finalize(attempt, isPastGrace(attempt.deadlineAt, now), now);
    }
    const done = await this.load(studentId, attemptId);
    return { status: 'submitted', result: this.toResult(done, now) };
  }

  /** Chấm và khoá các lượt quá hạn chưa nộp (em tắt máy, mất mạng, bị khoá tài khoản…). */
  async finalizeOverdue(
    where: { studentId?: string; examId?: string },
    now = new Date(),
  ): Promise<void> {
    const overdue = await this.prisma.examAttempt.findMany({
      where: {
        ...where,
        submittedAt: null,
        deadlineAt: { lt: new Date(now.getTime() - SUBMIT_GRACE_MS) },
      },
      include: attemptInclude,
    });
    for (const a of overdue) await this.finalize(a, true, now);
  }

  /**
   * Chấm một lượt bằng `gradeQuestion` (câu trả lời đổi về thứ tự gốc trước khi chấm)
   * rồi khoá lại. Câu bỏ trống tính sai. Gọi hai lần cùng lúc thì chỉ một lần được ghi.
   */
  private async finalize(attempt: AttemptRow, auto: boolean, now: Date) {
    const answers = new Map(attempt.answers.map((a) => [a.itemId, a]));
    let earned = 0;
    let correctCount = 0;
    const graded = layOut(attempt).all.map((l) => {
      const a = answers.get(l.item.id);
      const response = (a?.response ?? null) as QuestionResponse;
      const correct = gradeQuestion(
        toGradable(l.item.question),
        toOriginalResponse(l.item.question.type, response, l.optionOrder),
      );
      const points = correct ? l.item.points : 0;
      earned += points;
      if (correct) correctCount++;
      return { itemId: l.item.id, hasRow: !!a, correct, points };
    });

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.examAttempt.updateMany({
        where: { id: attempt.id, submittedAt: null },
        data: {
          // Máy tự nộp: ghi đúng hạn nộp, không phải lúc máy chủ phát hiện.
          submittedAt: auto ? attempt.deadlineAt : now,
          autoSubmitted: auto,
          earned,
          score: scoreOutOf10(earned, attempt.maxPoints),
          correctCount,
        },
      });
      if (count === 0) return;
      for (const g of graded) {
        if (g.hasRow) {
          await tx.examAnswer.update({
            where: {
              attemptId_itemId: { attemptId: attempt.id, itemId: g.itemId },
            },
            data: { correct: g.correct, points: g.points },
          });
        }
      }
    });
  }

  private async load(studentId: string, attemptId: string) {
    const a = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: attemptInclude,
    });
    // Bài của bạn khác cũng báo "không tìm thấy" — không lộ id nào có thật.
    if (!a || a.studentId !== studentId)
      throw notFound('Không tìm thấy bài làm');
    return a;
  }

  private toView(a: AttemptRow, now: Date): AttemptView {
    const { sections, all } = layOut(a);
    const answers: AttemptView['answers'] = {};
    for (const ans of a.answers) {
      answers[ans.itemId] = {
        response: (ans.response ?? null) as QuestionResponse,
        flagged: ans.flagged,
      };
    }
    return {
      id: a.id,
      exam: { id: a.exam.id, title: a.exam.title, mode: a.exam.mode },
      startedAt: a.startedAt.toISOString(),
      deadlineAt: a.deadlineAt.toISOString(),
      serverNow: now.toISOString(),
      sections: sections.map((s) => ({
        title: s.title,
        items: s.items.map(toItemView),
      })),
      passages: passagesOf(all),
      answers,
    };
  }

  private toResult(a: AttemptRow, now: Date): AttemptResult {
    const { all } = layOut(a);
    const visible = detailsVisible(a.exam, now);
    const answers = new Map(a.answers.map((x) => [x.itemId, x]));
    return {
      id: a.id,
      exam: { id: a.exam.id, title: a.exam.title, mode: a.exam.mode },
      submittedAt: (a.submittedAt ?? now).toISOString(),
      autoSubmitted: a.autoSubmitted,
      score: a.score ?? 0,
      earned: a.earned ?? 0,
      maxPoints: a.maxPoints,
      correctCount: a.correctCount,
      questionCount: all.length,
      items: visible
        ? all.map((l) => toResultItem(l, answers.get(l.item.id)))
        : null,
      detailsAt: visible ? null : (a.exam.closesAt?.toISOString() ?? null),
      passages: visible ? passagesOf(all) : {},
    };
  }
}

/** null = câu trả lời đúng kiểu với dạng câu; ngược lại là lý do. */
function checkResponse(
  type: Parameters<typeof questionKind>[0],
  response: QuestionResponse,
  optionCount: number,
): string | null {
  if (response === null) return null;
  switch (questionKind(type)) {
    case 'choice':
      return typeof response === 'number' && response < optionCount
        ? null
        : 'Câu chọn đáp án cần một lựa chọn hợp lệ';
    case 'typed':
      return typeof response === 'string' ? null : 'Câu này cần gõ đáp án';
    case 'reorder':
      return Array.isArray(response) &&
        response.length <= optionCount &&
        response.every((i) => i < optionCount)
        ? null
        : 'Thứ tự cụm từ không hợp lệ';
  }
}
