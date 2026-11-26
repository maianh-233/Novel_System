import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  findGame,
  GAME_DEFINITIONS,
  type GameAdmin,
  type GameConfig,
  type gameUpdateSchema,
} from '@novel/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Update = z.output<typeof gameUpdateSchema>;

/** Cấu hình lưu trong DB (JSON) ghép với mặc định — chịu được JSON thiếu/sai trường. */
export function mergeConfig(defaults: GameConfig, stored: unknown): GameConfig {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<
    Record<keyof GameConfig, unknown>
  >;
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    wordsPerRound: num(s.wordsPerRound, defaults.wordsPerRound),
    timeLimitSec: num(s.timeLimitSec, defaults.timeLimitSec),
  };
}

@Injectable()
export class GamesService implements OnModuleInit {
  private readonly logger = new Logger(GamesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Mỗi game trong GAME_DEFINITIONS luôn có một dòng trong bảng Game (thêm game mới không cần seed lại). */
  async onModuleInit() {
    const existing = await this.prisma.game.findMany({
      select: { slug: true },
    });
    const have = new Set(existing.map((g) => g.slug));
    const missing = GAME_DEFINITIONS.filter((g) => !have.has(g.slug));
    if (missing.length === 0) return;
    await this.prisma.game.createMany({
      data: missing.map((g) => ({
        slug: g.slug,
        config: { ...g.defaultConfig },
      })),
      skipDuplicates: true,
    });
    this.logger.log(`Đã thêm ${missing.length} trò chơi mới vào database`);
  }

  async list(): Promise<GameAdmin[]> {
    const rows = await this.prisma.game.findMany({
      include: { lessons: { select: { lessonId: true } } },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return GAME_DEFINITIONS.flatMap((def) => {
      const row = bySlug.get(def.slug);
      if (!row) return [];
      return [
        {
          slug: def.slug,
          isEnabled: row.isEnabled,
          config: mergeConfig(def.defaultConfig, row.config),
          lessonIds: row.lessons.map((l) => l.lessonId),
        },
      ];
    });
  }

  async update(slug: string, input: Update): Promise<GameAdmin> {
    const def = findGame(slug);
    const row = def
      ? await this.prisma.game.findUnique({ where: { slug } })
      : null;
    if (!def || !row) throw notFound('Không tìm thấy trò chơi');

    if (input.lessonIds) {
      const unique = [...new Set(input.lessonIds)];
      const found = await this.prisma.lesson.count({
        where: { id: { in: unique } },
      });
      if (found !== unique.length) {
        throw badRequest('unknown_lesson', 'Có bài học không tồn tại');
      }
      await this.prisma.$transaction([
        this.prisma.gameLesson.deleteMany({ where: { gameId: row.id } }),
        this.prisma.gameLesson.createMany({
          data: unique.map((lessonId) => ({ gameId: row.id, lessonId })),
        }),
      ]);
    }

    if (input.isEnabled !== undefined || input.config) {
      await this.prisma.game.update({
        where: { id: row.id },
        data: {
          ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
          ...(input.config && { config: { ...input.config } }),
        },
      });
    }

    const updated = (await this.list()).find((g) => g.slug === slug);
    return updated!;
  }
}
