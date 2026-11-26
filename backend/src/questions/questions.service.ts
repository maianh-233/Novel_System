import { Injectable } from '@nestjs/common';
import {
  parseQuestionText,
  type ImportDefaults,
  type Paginated,
  type QuestionAdmin,
  type QuestionData,
  type QuestionImportResult,
  type QuestionStatus,
  type questionQuerySchema,
} from '@novel/shared';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  questionInclude,
  toQuestionAdmin,
  toQuestionColumns,
} from './mappers.js';
import { parseQuestionCsv } from './question-csv.js';

type Query = z.output<typeof questionQuerySchema>;

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: Query): Promise<Paginated<QuestionAdmin>> {
    const where: Prisma.QuestionWhereInput = {
      ...(query.q && {
        OR: [
          { prompt: { contains: query.q, mode: 'insensitive' } },
          { explanation: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
      ...(query.type && { type: query.type }),
      ...(query.grammarTag && {
        grammarTag: { equals: query.grammarTag, mode: 'insensitive' },
      }),
      ...(query.stage && {
        stage: query.stage === 'both' ? null : query.stage,
      }),
      ...(query.level && { level: query.level }),
      ...(query.status && { status: query.status }),
      ...(query.passageId && { passageId: query.passageId }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        include: questionInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toQuestionAdmin),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<QuestionAdmin> {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: questionInclude,
    });
    if (!q) throw notFound('Không tìm thấy câu hỏi');
    return toQuestionAdmin(q);
  }

  /** Các chủ điểm ngữ pháp đã dùng, để gợi ý khi nhập. */
  async tags(): Promise<string[]> {
    const rows = await this.prisma.question.findMany({
      where: { grammarTag: { not: null } },
      distinct: ['grammarTag'],
      select: { grammarTag: true },
      orderBy: { grammarTag: 'asc' },
      take: 500,
    });
    return rows.flatMap((r) => (r.grammarTag ? [r.grammarTag] : []));
  }

  async create(data: QuestionData): Promise<QuestionAdmin> {
    await this.ensurePassage(data.passageId);
    const q = await this.prisma.question.create({
      data: toQuestionColumns(data),
    });
    return this.get(q.id);
  }

  /** Sửa toàn bộ câu hỏi (form gửi đủ các trường). */
  async replace(id: string, data: QuestionData): Promise<QuestionAdmin> {
    await this.ensureExists(id);
    await this.ensurePassage(data.passageId);
    await this.prisma.question.update({
      where: { id },
      data: toQuestionColumns(data),
    });
    return this.get(id);
  }

  async setStatus(id: string, status: QuestionStatus): Promise<QuestionAdmin> {
    await this.ensureExists(id);
    await this.prisma.question.update({ where: { id }, data: { status } });
    return this.get(id);
  }

  /** Chỉ xoá hẳn câu chưa gắn vào Unit nào; đã dùng rồi thì ngừng dùng. */
  async remove(id: string): Promise<void> {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: { _count: { select: { lessons: true, examItems: true } } },
    });
    if (!q) throw notFound('Không tìm thấy câu hỏi');
    if (q._count.lessons > 0 || q._count.examItems > 0) {
      throw conflict(
        'question_in_use',
        'Câu hỏi đang nằm trong Unit hoặc đề thi nên không xoá được. Hãy chuyển sang "Ngừng dùng".',
      );
    }
    await this.prisma.question.delete({ where: { id } });
  }

  /**
   * Nhập hàng loạt. Kiểm tra trước; còn lỗi thì không ghi câu nào.
   * dryRun = chỉ kiểm tra và trả về bản xem trước.
   */
  async import(
    format: 'text' | 'csv',
    content: string,
    defaults: ImportDefaults,
    dryRun: boolean,
  ): Promise<QuestionImportResult> {
    const parsed =
      format === 'csv'
        ? parseQuestionCsv(content, defaults)
        : parseQuestionText(content, defaults);
    const titleOf = new Map(parsed.passages.map((p) => [p.key, p.title]));
    const result: QuestionImportResult = {
      dryRun,
      created: 0,
      passagesCreated: 0,
      questions: parsed.questions.map((q) => ({
        line: q.line,
        number: q.number,
        passageTitle:
          q.passageKey === null ? null : (titleOf.get(q.passageKey) ?? null),
        data: q.data,
      })),
      passages: parsed.passages.map((p) => ({ title: p.title, text: p.text })),
      errors: parsed.errors,
    };
    if (dryRun || parsed.errors.length > 0) {
      return { ...result, dryRun: dryRun || parsed.errors.length > 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      const passageIds = new Map<number, string>();
      for (const p of parsed.passages) {
        const row = await tx.passage.create({
          data: { title: p.title, text: p.text },
        });
        passageIds.set(p.key, row.id);
      }
      await tx.question.createMany({
        data: parsed.questions.map((q) =>
          toQuestionColumns({
            ...q.data,
            passageId:
              q.passageKey === null
                ? null
                : (passageIds.get(q.passageKey) ?? null),
          }),
        ),
      });
    });
    return {
      ...result,
      created: parsed.questions.length,
      passagesCreated: parsed.passages.length,
    };
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.question.count({ where: { id } });
    if (!n) throw notFound('Không tìm thấy câu hỏi');
  }

  private async ensurePassage(passageId: string | null) {
    if (!passageId) return;
    const n = await this.prisma.passage.count({ where: { id: passageId } });
    if (!n) throw badRequest('unknown_passage', 'Đoạn văn không tồn tại');
  }
}
