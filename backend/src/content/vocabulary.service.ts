import { Injectable } from '@nestjs/common';
import type {
  Paginated,
  VocabularyAdmin,
  VocabularyData,
  VocabularyImportResult,
  vocabularyQuerySchema,
  vocabularyUpdateSchema,
} from '@novel/shared';
import type { z } from 'zod';
import {
  badRequest,
  conflict,
  isForeignKeyViolation,
  isUniqueViolation,
  notFound,
} from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseVocabularyCsv } from './csv-import.js';
import { toVocabularyAdmin, vocabularyInclude } from './mappers.js';

type Query = z.output<typeof vocabularyQuerySchema>;
type Update = z.output<typeof vocabularyUpdateSchema>;

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: Query): Promise<Paginated<VocabularyAdmin>> {
    const where: Prisma.VocabularyWhereInput = {
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.level && { level: q.level }),
      ...(q.status && { status: q.status }),
      ...(q.q && {
        OR: [
          { word: { contains: q.q, mode: 'insensitive' } },
          { meaning: { contains: q.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.vocabulary.count({ where }),
      this.prisma.vocabulary.findMany({
        where,
        include: vocabularyInclude,
        orderBy: [{ updatedAt: 'desc' }, { word: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      items: rows.map(toVocabularyAdmin),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async get(id: string): Promise<VocabularyAdmin> {
    const v = await this.prisma.vocabulary.findUnique({
      where: { id },
      include: vocabularyInclude,
    });
    if (!v) throw notFound('Không tìm thấy từ vựng');
    return toVocabularyAdmin(v);
  }

  async create(data: VocabularyData): Promise<VocabularyAdmin> {
    await this.assertNotDuplicate(data.word, data.categoryId);
    try {
      const v = await this.prisma.vocabulary.create({
        data,
        include: vocabularyInclude,
      });
      return toVocabularyAdmin(v);
    } catch (e) {
      throw this.translateWriteError(e, data.word);
    }
  }

  async update(id: string, data: Update): Promise<VocabularyAdmin> {
    const current = await this.prisma.vocabulary.findUnique({ where: { id } });
    if (!current) throw notFound('Không tìm thấy từ vựng');
    if (data.word !== undefined || data.categoryId !== undefined) {
      await this.assertNotDuplicate(
        data.word ?? current.word,
        data.categoryId ?? current.categoryId,
        id,
      );
    }
    try {
      const v = await this.prisma.vocabulary.update({
        where: { id },
        data,
        include: vocabularyInclude,
      });
      return toVocabularyAdmin(v);
    } catch (e) {
      throw this.translateWriteError(e, data.word ?? current.word);
    }
  }

  /**
   * Xoá hẳn một từ. Từ đã có học sinh chơi thì không xoá (giữ lịch sử học tập) —
   * giáo viên chuyển sang "Ngừng dùng" thay thế.
   */
  async remove(id: string): Promise<void> {
    const v = await this.prisma.vocabulary.findUnique({
      where: { id },
      include: { _count: { select: { answers: true } } },
    });
    if (!v) throw notFound('Không tìm thấy từ vựng');
    if (v._count.answers > 0) {
      throw conflict(
        'vocabulary_in_use',
        `Học sinh đã chơi với từ "${v.word}" nên không xoá được (để giữ lịch sử học tập). Hãy chuyển sang "Ngừng dùng".`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.lessonVocabulary.deleteMany({ where: { vocabularyId: id } }),
      this.prisma.vocabulary.delete({ where: { id } }),
    ]);
  }

  /**
   * Nhập từ CSV. Từ đã có (cùng từ, cùng chủ đề — không phân biệt hoa thường) được cập nhật,
   * từ mới được thêm. `dryRun` chỉ kiểm tra và đếm, không ghi gì.
   */
  async import(
    csv: string,
    dryRun: boolean,
    defaultCategoryId?: string,
  ): Promise<VocabularyImportResult> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true, slug: true },
    });
    if (
      defaultCategoryId &&
      !categories.some((c) => c.id === defaultCategoryId)
    ) {
      throw badRequest('unknown_category', 'Chủ đề mặc định không tồn tại');
    }
    const { rows, errors } = parseVocabularyCsv(
      csv,
      categories,
      defaultCategoryId,
    );

    const existing = await this.prisma.vocabulary.findMany({
      where: {
        categoryId: { in: [...new Set(rows.map((r) => r.data.categoryId))] },
      },
      select: { id: true, word: true, categoryId: true },
    });
    const existingId = new Map(
      existing.map((v) => [`${v.word.toLowerCase()}|${v.categoryId}`, v.id]),
    );

    const toUpdate: Array<{ id: string; data: VocabularyData }> = [];
    const toCreate: VocabularyData[] = [];
    for (const { data } of rows) {
      const id = existingId.get(
        `${data.word.toLowerCase()}|${data.categoryId}`,
      );
      if (id) toUpdate.push({ id, data });
      else toCreate.push(data);
    }

    const result: VocabularyImportResult = {
      dryRun,
      totalRows: rows.length + errors.filter((e) => e.line > 1).length,
      created: toCreate.length,
      updated: toUpdate.length,
      errors,
    };

    // Có lỗi thì không ghi dòng nào — giáo viên sửa file rồi nhập lại, tránh nhập dở dang.
    if (dryRun || errors.length > 0) return { ...result, dryRun: true };

    await this.prisma.$transaction([
      this.prisma.vocabulary.createMany({ data: toCreate }),
      ...toUpdate.map(({ id, data }) =>
        this.prisma.vocabulary.update({ where: { id }, data }),
      ),
    ]);
    return result;
  }

  private async assertNotDuplicate(
    word: string,
    categoryId: string,
    exceptId?: string,
  ) {
    const dup = await this.prisma.vocabulary.findFirst({
      where: {
        categoryId,
        word: { equals: word, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (dup) {
      throw conflict('duplicate_word', `Từ "${word}" đã có trong chủ đề này`);
    }
  }

  private translateWriteError(e: unknown, word: string) {
    if (isUniqueViolation(e))
      return conflict('duplicate_word', `Từ "${word}" đã có trong chủ đề này`);
    if (isForeignKeyViolation(e))
      return badRequest('unknown_category', 'Chủ đề không tồn tại');
    return e;
  }
}
