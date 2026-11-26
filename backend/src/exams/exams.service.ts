import { Injectable } from '@nestjs/common';
import {
  lessonAudienceError,
  plainText,
  type ExamDetail,
  type ExamResultRow,
  type ExamResults,
  type ExamStructure,
  type ExamSummary,
  type QuestionType,
  type examCreateSchema,
  type examUpdateSchema,
} from '@novel/shared';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { questionInclude, toQuestionAdmin } from '../questions/mappers.js';
import { AttemptsService } from './attempts.service.js';
import {
  attemptInclude,
  examSummaryInclude,
  layOut,
  toExamSummary,
} from './exam-mappers.js';

type Create = z.output<typeof examCreateSchema>;
type Update = z.output<typeof examUpdateSchema>;

const toDate = (v: string | null | undefined) =>
  v === undefined ? undefined : v === null ? null : new Date(v);

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: AttemptsService,
  ) {}

  async list(): Promise<ExamSummary[]> {
    const rows = await this.prisma.exam.findMany({
      include: examSummaryInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toExamSummary);
  }

  async get(id: string): Promise<ExamDetail> {
    const e = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        ...examSummaryInclude,
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: { question: { include: questionInclude } },
            },
          },
        },
      },
    });
    if (!e) throw notFound('Không tìm thấy đề');
    return {
      ...toExamSummary(e),
      sections: e.sections.map((s) => ({
        id: s.id,
        title: s.title,
        items: s.items.map((i) => ({
          id: i.id,
          points: i.points,
          question: toQuestionAdmin(i.question),
        })),
      })),
    };
  }

  async create(data: Create): Promise<ExamDetail> {
    checkAudience(data.stage, data.grade);
    const e = await this.prisma.exam.create({
      data: {
        ...data,
        opensAt: toDate(data.opensAt),
        closesAt: toDate(data.closesAt),
        // Đề mới có sẵn một phần trống để thêm câu.
        sections: { create: { title: 'Phần 1', order: 0 } },
      },
    });
    return this.get(e.id);
  }

  async update(id: string, data: Update): Promise<ExamDetail> {
    const cur = await this.prisma.exam.findUnique({ where: { id } });
    if (!cur) throw notFound('Không tìm thấy đề');
    const stage = data.stage === undefined ? cur.stage : data.stage;
    let grade = data.grade === undefined ? cur.grade : data.grade;
    if (data.grade === undefined && lessonAudienceError(stage, grade))
      grade = null;
    checkAudience(stage, grade);
    const opensAt =
      data.opensAt === undefined ? cur.opensAt : toDate(data.opensAt);
    const closesAt =
      data.closesAt === undefined ? cur.closesAt : toDate(data.closesAt);
    if (opensAt && closesAt && closesAt <= opensAt) {
      throw badRequest('invalid_window', 'Giờ đóng phải sau giờ mở');
    }
    await this.prisma.exam.update({
      where: { id },
      data: { ...data, grade, opensAt, closesAt },
    });
    return this.get(id);
  }

  /**
   * Thay toàn bộ phần / câu của đề. Đã có em làm thì khoá cấu trúc (đổi câu sẽ làm sai
   * bài đã làm); vẫn sửa được giờ mở / đóng, thời gian, cách xem kết quả.
   */
  async setStructure(id: string, s: ExamStructure): Promise<ExamDetail> {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    });
    if (!exam) throw notFound('Không tìm thấy đề');
    if (exam._count.attempts > 0) {
      throw conflict(
        'exam_has_attempts',
        'Đã có học sinh làm đề này nên không đổi câu hỏi được nữa. Hãy nhân bản thành đề mới.',
      );
    }
    const ids = s.sections.flatMap((x) => x.items.map((i) => i.questionId));
    const found = await this.prisma.question.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length) {
      throw badRequest('unknown_question', 'Có câu hỏi không tồn tại');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.examSection.deleteMany({ where: { examId: id } });
      for (const [order, section] of s.sections.entries()) {
        await tx.examSection.create({
          data: {
            examId: id,
            title: section.title,
            order,
            items: {
              create: section.items.map((it, k) => ({
                questionId: it.questionId,
                points: it.points,
                order: k,
              })),
            },
          },
        });
      }
      await tx.exam.update({ where: { id }, data: { updatedAt: new Date() } });
    });
    return this.get(id);
  }

  /** Nhân bản đề (kể cả câu hỏi) thành bản nháp mới — để sửa đề đã có người làm. */
  async duplicate(id: string): Promise<ExamDetail> {
    const src = await this.get(id);
    const copy = await this.prisma.exam.create({
      data: {
        title: `${src.title} (bản sao)`,
        description: src.description,
        mode: src.mode,
        durationMin: src.durationMin,
        maxAttempts: src.maxAttempts,
        shuffle: src.shuffle,
        showResult: src.showResult,
        stage: src.stage,
        grade: src.grade,
        isPublished: false,
      },
    });
    await this.setStructure(copy.id, {
      sections: src.sections.map((s) => ({
        title: s.title,
        items: s.items.map((i) => ({
          questionId: i.question.id,
          points: i.points,
        })),
      })),
    });
    return this.get(copy.id);
  }

  async remove(id: string): Promise<void> {
    const e = await this.prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    });
    if (!e) throw notFound('Không tìm thấy đề');
    if (e._count.attempts > 0) {
      throw conflict(
        'exam_has_attempts',
        'Đề đã có học sinh làm nên không xoá được (để giữ điểm). Hãy tắt "Công khai".',
      );
    }
    await this.prisma.exam.delete({ where: { id } });
  }

  /**
   * Bảng điểm + thống kê. Lượt quá hạn chưa nộp được chấm trước (máy tự nộp).
   * Mỗi em lấy lượt nộp gần nhất; em chưa nộp lượt nào thì hiện lượt đang làm.
   */
  async results(id: string): Promise<ExamResults> {
    const now = new Date();
    await this.attempts.finalizeOverdue({ examId: id }, now);
    const summary = toExamSummary(
      (await this.prisma.exam.findUnique({
        where: { id },
        include: examSummaryInclude,
      })) ?? throwNotFound(),
    );
    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId: id },
      include: {
        ...attemptInclude,
        student: { include: { classGroup: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const latest = new Map<string, (typeof attempts)[number]>();
    const counts = new Map<string, number>();
    for (const a of attempts) {
      counts.set(a.studentId, (counts.get(a.studentId) ?? 0) + 1);
      const cur = latest.get(a.studentId);
      // Đã có lượt nộp thì giữ; chưa có thì lấy lượt mới nhất (đang làm).
      if (!cur || (!cur.submittedAt && a.submittedAt))
        latest.set(a.studentId, a);
    }

    const rows: ExamResultRow[] = [...latest.values()].map((a) => ({
      attemptId: a.id,
      student: {
        id: a.student.id,
        displayName: a.student.displayName,
        username: a.student.username,
        className: a.student.classGroup?.name ?? null,
        classId: a.student.classId,
      },
      attemptCount: counts.get(a.studentId) ?? 1,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      autoSubmitted: a.autoSubmitted,
      score: a.score,
      correctCount: a.correctCount,
    }));
    rows.sort(
      (x, y) =>
        (x.student.className ?? '').localeCompare(
          y.student.className ?? '',
          'vi',
        ) || x.student.displayName.localeCompare(y.student.displayName, 'vi'),
    );

    // Thống kê trên các lượt đã nộp (câu bỏ trống tính sai).
    const submitted = [...latest.values()].filter((a) => a.submittedAt);
    const detail = await this.get(id);
    const itemStats = new Map<string, { answered: number; correct: number }>();
    for (const a of submitted) {
      const byItem = new Map(a.answers.map((x) => [x.itemId, x]));
      for (const l of layOut(a).all) {
        const st = itemStats.get(l.item.id) ?? { answered: 0, correct: 0 };
        st.answered++;
        if (byItem.get(l.item.id)?.correct) st.correct++;
        itemStats.set(l.item.id, st);
      }
    }
    let n = 0;
    const items = detail.sections.flatMap((s) =>
      s.items.map((i) => {
        n++;
        const st = itemStats.get(i.id) ?? { answered: 0, correct: 0 };
        return {
          itemId: i.id,
          number: n,
          sectionTitle: s.title,
          prompt: plainText(i.question.prompt),
          type: i.question.type,
          grammarTag: i.question.grammarTag,
          ...st,
        };
      }),
    );
    const group = <K extends string>(
      key: (x: (typeof items)[number]) => K | null,
    ) => {
      const m = new Map<K, { answered: number; correct: number }>();
      for (const it of items) {
        const k = key(it);
        if (k === null) continue;
        const g = m.get(k) ?? { answered: 0, correct: 0 };
        g.answered += it.answered;
        g.correct += it.correct;
        m.set(k, g);
      }
      return [...m.entries()];
    };
    const rate = (x: { answered: number; correct: number }) =>
      x.answered ? x.correct / x.answered : 1;

    return {
      exam: summary,
      questionCount: items.length,
      rows,
      items,
      byType: group<QuestionType>((x) => x.type)
        .map(([type, g]) => ({ type, ...g }))
        .sort((a, b) => rate(a) - rate(b)),
      byTag: group<string>((x) => x.grammarTag)
        .map(([tag, g]) => ({ tag, ...g }))
        .sort((a, b) => rate(a) - rate(b)),
    };
  }
}

function throwNotFound(): never {
  throw notFound('Không tìm thấy đề');
}

function checkAudience(stage: ExamSummary['stage'], grade: number | null) {
  const error = lessonAudienceError(stage, grade);
  if (error) throw badRequest('invalid_grade', error);
}
