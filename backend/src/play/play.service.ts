import { Injectable } from '@nestjs/common';
import {
  checkAnswers,
  findGame,
  rateRound,
  type FinishSessionRequest,
  type FinishSessionResponse,
  type GameDefinition,
  type Level,
  type PlayErrorCode,
  type PlayGameInfo,
  type PlayLesson,
  type PlaySessionSummary,
  type StartSessionResponse,
} from '@novel/shared';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { mergeConfig } from '../content/games.service.js';
import { selectWordsForGame, toGameWord } from '../content/word-selection.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  finishedSessionInclude,
  toSessionSummary,
} from '../students/students.service.js';

/** Lượt chơi bắt đầu quá lâu thì không nhận kết quả nữa. */
export const SESSION_MAX_AGE_MS = 3 * 3600_000;
/** Cho phép thời gian game báo lệch so với đồng hồ máy chủ một chút (mạng chậm). */
const DURATION_SLACK_MS = 5_000;

const playError = (code: PlayErrorCode, message: string) =>
  conflict(code, message);

/** Trộn ngẫu nhiên (Fisher–Yates), không sửa mảng gốc. */
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class PlayService {
  constructor(private readonly prisma: PrismaService) {}

  /** Thông tin game + những bài học học sinh chọn được (đã công khai, đã gán cho game, đủ từ). */
  async gameInfo(slug: string): Promise<PlayGameInfo> {
    const def = findGame(slug);
    const row = def
      ? await this.prisma.game.findUnique({
          where: { slug },
          include: {
            lessons: {
              where: { lesson: { isPublished: true } },
              include: {
                lesson: {
                  include: {
                    words: {
                      orderBy: { order: 'asc' },
                      include: { vocabulary: true },
                    },
                  },
                },
              },
            },
          },
        })
      : null;
    if (!def || !row) throw notFound('Không tìm thấy trò chơi');

    const lessons: PlayLesson[] = [];
    if (row.isEnabled) {
      for (const { lesson } of row.lessons) {
        const sel = selectWordsForGame(
          def,
          lesson.words.map((w) => w.vocabulary),
        );
        if (!sel.playable) continue;
        lessons.push({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          level: lesson.level as Level,
          wordCount: sel.words.length,
        });
      }
      lessons.sort(
        (a, b) => a.level - b.level || a.title.localeCompare(b.title, 'vi'),
      );
    }

    return {
      slug: def.slug,
      name: def.name,
      isEnabled: row.isEnabled,
      timeLimitSec: mergeConfig(def.defaultConfig, row.config).timeLimitSec,
      lessons,
    };
  }

  async start(
    studentId: string,
    gameSlug: string,
    lessonId: string,
  ): Promise<StartSessionResponse> {
    const def = findGame(gameSlug);
    const game = def
      ? await this.prisma.game.findUnique({ where: { slug: gameSlug } })
      : null;
    if (!def || !game || !game.isEnabled) {
      throw playError('game_unavailable', 'Trò chơi này đang tạm nghỉ');
    }
    const link = await this.prisma.gameLesson.findUnique({
      where: { gameId_lessonId: { gameId: game.id, lessonId } },
      include: {
        lesson: {
          include: {
            words: { orderBy: { order: 'asc' }, include: { vocabulary: true } },
          },
        },
      },
    });
    if (!link || !link.lesson.isPublished) {
      throw playError(
        'lesson_unavailable',
        'Bài học này chưa dùng được cho trò chơi',
      );
    }

    const config = mergeConfig(def.defaultConfig, game.config);
    const words = this.pickWords(
      def,
      link.lesson.words.map((w) => w.vocabulary),
      config.wordsPerRound,
    );

    const session = await this.prisma.playSession.create({
      data: {
        studentId,
        gameId: game.id,
        lessonId,
        level: link.lesson.level,
        wordIds: words.map((w) => w.id),
        timeLimitSec: config.timeLimitSec,
      },
    });

    return {
      content: {
        sessionId: session.id,
        lessonId,
        level: link.lesson.level as Level,
        words,
      },
      timeLimitSec: config.timeLimitSec,
    };
  }

  async finish(
    studentId: string,
    sessionId: string,
    result: FinishSessionRequest,
  ): Promise<FinishSessionResponse> {
    const session = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
    });
    // Lượt của bạn khác cũng báo "không tìm thấy" — không lộ id nào có thật.
    if (!session || session.studentId !== studentId) {
      throw notFound('Không tìm thấy lượt chơi');
    }
    if (session.finishedAt) {
      throw playError('session_finished', 'Lượt chơi này đã có kết quả rồi');
    }
    const elapsed = Date.now() - session.startedAt.getTime();
    if (elapsed > SESSION_MAX_AGE_MS) {
      throw playError(
        'session_expired',
        'Lượt chơi đã quá lâu, em bắt đầu lượt mới nhé',
      );
    }
    const invalid = checkAnswers(session.wordIds, result.answers);
    if (invalid) throw badRequest('invalid_answers', invalid);

    const rating = rateRound(
      session.wordIds.length,
      result.answers,
      session.timeLimitSec > 0,
    );
    const durationMs = Math.min(result.durationMs, elapsed + DURATION_SLACK_MS);

    const totalStars = await this.prisma.$transaction(async (tx) => {
      // Điều kiện finishedAt = null ngay trong câu UPDATE: hai request gửi cùng lúc thì chỉ một cái được ghi.
      const { count } = await tx.playSession.updateMany({
        where: { id: sessionId, finishedAt: null },
        data: {
          finishedAt: new Date(),
          score: result.score,
          stars: rating.stars,
          correctCount: rating.correctCount,
          wrongCount: rating.wrongCount,
          durationMs,
        },
      });
      if (count === 0) {
        throw playError('session_finished', 'Lượt chơi này đã có kết quả rồi');
      }
      if (result.answers.length > 0) {
        await tx.playAnswer.createMany({
          data: result.answers.map((a) => ({ sessionId, ...a })),
        });
      }
      const s = await tx.student.update({
        where: { id: studentId },
        data: { totalStars: { increment: rating.stars } },
        select: { totalStars: true },
      });
      return s.totalStars;
    });

    return {
      ...rating,
      totalStars,
      mistakes: await this.mistakes(
        session.wordIds,
        result.answers,
        session.timeLimitSec > 0,
      ),
    };
  }

  async history(studentId: string): Promise<PlaySessionSummary[]> {
    const rows = await this.prisma.playSession.findMany({
      where: { studentId, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      take: 20,
      include: finishedSessionInclude,
    });
    return rows.map(toSessionSummary);
  }

  private pickWords(
    def: GameDefinition,
    candidates: Parameters<typeof selectWordsForGame>[1],
    count: number,
  ) {
    const sel = selectWordsForGame(def, candidates);
    if (!sel.playable) {
      throw playError(
        'not_enough_words',
        'Bài học này chưa đủ từ để chơi trò chơi này',
      );
    }
    return shuffle(sel.words).slice(0, count);
  }

  /** Từ sai, và (với game không tính giờ) từ chưa trả lời — theo thứ tự đã phát. */
  private async mistakes(
    wordIds: string[],
    answers: FinishSessionRequest['answers'],
    timed: boolean,
  ) {
    const byId = new Map(answers.map((a) => [a.vocabularyId, a.correct]));
    const ids = wordIds.filter((id) => (byId.has(id) ? !byId.get(id) : !timed));
    if (ids.length === 0) return [];
    const rows = await this.prisma.vocabulary.findMany({
      where: { id: { in: ids } },
    });
    const rowById = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const r = rowById.get(id);
      return r ? [toGameWord(r)] : [];
    });
  }
}
