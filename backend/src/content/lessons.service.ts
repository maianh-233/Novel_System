import { Injectable } from '@nestjs/common';
import {
  GAME_DEFINITIONS,
  type LessonDetail,
  type LessonGamePreview,
  type LessonSummary,
  type Level,
  type lessonInputSchema,
  type lessonUpdateSchema,
} from '@novel/shared';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toVocabularyAdmin, vocabularyInclude } from './mappers.js';
import { selectWordsForGame } from './word-selection.js';

type Create = z.output<typeof lessonInputSchema>;
type Update = z.output<typeof lessonUpdateSchema>;

const summaryInclude = {
  _count: { select: { words: true } },
  games: { select: { game: { select: { slug: true } } } },
} satisfies Prisma.LessonInclude;

type SummaryRow = Prisma.LessonGetPayload<{ include: typeof summaryInclude }>;

function toSummary(l: SummaryRow): LessonSummary {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    level: l.level as Level,
    isPublished: l.isPublished,
    wordCount: l._count.words,
    gameSlugs: l.games.map((g) => g.game.slug).sort(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<LessonSummary[]> {
    const rows = await this.prisma.lesson.findMany({
      include: summaryInclude,
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map(toSummary);
  }

  async get(id: string): Promise<LessonDetail> {
    const l = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        ...summaryInclude,
        words: {
          orderBy: { order: 'asc' },
          include: { vocabulary: { include: vocabularyInclude } },
        },
      },
    });
    if (!l) throw notFound('Không tìm thấy bài học');
    return {
      ...toSummary(l),
      words: l.words.map((w) => toVocabularyAdmin(w.vocabulary)),
    };
  }

  async create(data: Create): Promise<LessonDetail> {
    const l = await this.prisma.lesson.create({ data });
    return this.get(l.id);
  }

  async update(id: string, data: Update): Promise<LessonDetail> {
    await this.ensureExists(id);
    await this.prisma.lesson.update({ where: { id }, data });
    return this.get(id);
  }

  /** Thay toàn bộ danh sách từ của bài học, giữ đúng thứ tự gửi lên. */
  async setWords(id: string, vocabularyIds: string[]): Promise<LessonDetail> {
    await this.ensureExists(id);
    const found = await this.prisma.vocabulary.count({
      where: { id: { in: vocabularyIds } },
    });
    if (found !== vocabularyIds.length) {
      throw badRequest('unknown_vocabulary', 'Có từ vựng không tồn tại');
    }
    await this.prisma.$transaction([
      this.prisma.lessonVocabulary.deleteMany({ where: { lessonId: id } }),
      this.prisma.lessonVocabulary.createMany({
        data: vocabularyIds.map((vocabularyId, order) => ({
          lessonId: id,
          vocabularyId,
          order,
        })),
      }),
      this.prisma.lesson.update({
        where: { id },
        data: { updatedAt: new Date() },
      }),
    ]);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const l = await this.prisma.lesson.findUnique({
      where: { id },
      include: { _count: { select: { sessions: true } } },
    });
    if (!l) throw notFound('Không tìm thấy bài học');
    if (l._count.sessions > 0) {
      throw conflict(
        'lesson_in_use',
        'Học sinh đã chơi bài học này nên không xoá được (để giữ lịch sử học tập). Hãy chuyển sang "Chưa công khai".',
      );
    }
    // LessonVocabulary và GameLesson tự xoá theo (onDelete: Cascade).
    await this.prisma.lesson.delete({ where: { id } });
  }

  /** Với từng trò chơi: những từ nào của bài học sẽ được dùng, từ nào bị loại và vì sao. */
  async preview(id: string): Promise<LessonGamePreview[]> {
    const l = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        words: { orderBy: { order: 'asc' }, include: { vocabulary: true } },
      },
    });
    if (!l) throw notFound('Không tìm thấy bài học');
    const candidates = l.words.map((w) => w.vocabulary);
    return GAME_DEFINITIONS.map((g) => selectWordsForGame(g, candidates));
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.lesson.count({ where: { id } });
    if (!exists) throw notFound('Không tìm thấy bài học');
  }
}
