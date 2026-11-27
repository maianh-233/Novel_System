import { Injectable } from '@nestjs/common';
import {
  checkAnswers,
  checkQuestionAnswers,
  findGame,
  gradeQuestion,
  responseProblem,
  usesQuestions,
  isGameForLearner,
  isLessonForLearner,
  learnerOf,
  rateRound,
  type FinishSessionRequest,
  type FinishSessionResponse,
  type GameDefinition,
  type Learner,
  type Level,
  type PlayErrorCode,
  type PlayGameInfo,
  type PlayLesson,
  type PlaySessionSummary,
  type StartSessionResponse,
} from '@novel/shared';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { mergeConfig } from '../content/games.service.js';
import {
  lessonQuestionCandidates,
  selectQuestionsForGame,
} from '../content/question-selection.js';
import { selectWordsForGame, toGameWord } from '../content/word-selection.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toGradable } from '../questions/mappers.js';
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

/** Bài học kèm từ và câu hỏi — đủ để biết game nào chơi được bài này. */
const lessonContentInclude = {
  words: { orderBy: { order: 'asc' }, include: { vocabulary: true } },
  questions: { orderBy: { order: 'asc' }, include: { question: true } },
} satisfies Prisma.LessonInclude;

type LessonContent = Prisma.LessonGetPayload<{
  include: typeof lessonContentInclude;
}>;

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

  /** Cấp học + khối của em, theo lớp em đang ở. */
  async learner(studentId: string): Promise<Learner> {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { classGroup: { select: { grade: true } } },
    });
    return learnerOf(s?.classGroup ?? null);
  }

  /**
   * Thông tin game + những bài học em chọn được (đã công khai, đã gán cho game, đủ từ,
   * đúng cấp học của em). Game không dành cho khối của em thì coi như đang tạm nghỉ.
   */
  async gameInfo(studentId: string, slug: string): Promise<PlayGameInfo> {
    const def = findGame(slug);
    const learner = await this.learner(studentId);
    const row = def
      ? await this.prisma.game.findUnique({
          where: { slug },
          include: {
            lessons: {
              where: { lesson: { isPublished: true } },
              include: { lesson: { include: lessonContentInclude } },
            },
          },
        })
      : null;
    if (!def || !row) throw notFound('Không tìm thấy trò chơi');

    const enabled = row.isEnabled && isGameForLearner(def, learner);
    const lessons: PlayLesson[] = [];
    if (enabled) {
      for (const { lesson } of row.lessons) {
        if (!isLessonForLearner(lesson, learner)) continue;
        const sel = this.select(def, lesson);
        if (!sel.playable) continue;
        lessons.push({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          level: lesson.level as Level,
          wordCount: sel.words.length,
          questionCount: sel.questionCount,
        });
      }
      lessons.sort(
        (a, b) => a.level - b.level || a.title.localeCompare(b.title, 'vi'),
      );
    }

    return {
      slug: def.slug,
      name: def.name,
      isEnabled: enabled,
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
    const learner = await this.learner(studentId);
    if (!def || !game || !game.isEnabled || !isGameForLearner(def, learner)) {
      throw playError('game_unavailable', 'Trò chơi này đang tạm nghỉ');
    }
    const link = await this.prisma.gameLesson.findUnique({
      where: { gameId_lessonId: { gameId: game.id, lessonId } },
      include: { lesson: { include: lessonContentInclude } },
    });
    if (
      !link ||
      !link.lesson.isPublished ||
      !isLessonForLearner(link.lesson, learner)
    ) {
      throw playError(
        'lesson_unavailable',
        'Bài học này chưa dùng được cho trò chơi',
      );
    }

    const config = mergeConfig(def.defaultConfig, game.config);
    const sel = this.select(def, link.lesson);
    if (!sel.playable) {
      throw playError(
        'not_enough_words',
        usesQuestions(def)
          ? 'Unit này chưa đủ câu hỏi để chơi trò chơi này'
          : 'Bài học này chưa đủ từ để chơi trò chơi này',
      );
    }
    const words = shuffle(sel.words).slice(0, config.wordsPerRound);
    const questions = shuffle(sel.questions).slice(0, config.wordsPerRound);

    const session = await this.prisma.playSession.create({
      data: {
        studentId,
        gameId: game.id,
        lessonId,
        level: link.lesson.level,
        stage: learner.stage,
        wordIds: words.map((w) => w.id),
        questionIds: questions.map((q) => q.id),
        timeLimitSec: config.timeLimitSec,
      },
    });

    return {
      content: {
        sessionId: session.id,
        lessonId,
        level: link.lesson.level as Level,
        stage: learner.stage,
        words,
        questions,
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
    const graded = await this.gradeQuestions(
      session.questionIds,
      result.questionAnswers ?? [],
    );

    // Game ngữ pháp: sao tính trên câu máy chủ chấm lại, không tin cờ đúng/sai từ máy em.
    const rating = graded
      ? rateRound(
          session.questionIds.length,
          graded.map((g) => ({
            vocabularyId: g.questionId,
            correct: g.correct,
            attempts: g.attempts,
          })),
          session.timeLimitSec > 0,
        )
      : rateRound(
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
      if (graded?.length) {
        await tx.playQuestionAnswer.createMany({
          data: graded.map((g) => ({
            sessionId,
            questionId: g.questionId,
            response: g.response ?? undefined,
            correct: g.correct,
            attempts: g.attempts,
          })),
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

  /**
   * Chấm lại câu trả lời game ngữ pháp bằng `gradeQuestion` (cùng thư viện với đề thi).
   * Lượt không có câu hỏi (game từ vựng) trả về null; lượt từ vựng mà gửi câu hỏi thì bị từ chối.
   */
  private async gradeQuestions(
    issued: string[],
    answers: NonNullable<FinishSessionRequest['questionAnswers']>,
  ) {
    const invalid = checkQuestionAnswers(issued, answers);
    if (invalid) throw badRequest('invalid_answers', invalid);
    if (issued.length === 0) return null;
    const rows = await this.prisma.question.findMany({
      where: { id: { in: answers.map((a) => a.questionId) } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return answers.map((a) => {
      const q = byId.get(a.questionId);
      if (!q) throw badRequest('invalid_answers', 'Có câu hỏi không tồn tại');
      const gradable = toGradable(q);
      const problem = responseProblem(
        q.type,
        a.response,
        gradable.options.length,
      );
      if (problem) throw badRequest('invalid_answers', problem);
      return {
        questionId: a.questionId,
        response: a.response,
        attempts: a.attempts,
        correct: gradeQuestion(gradable, a.response),
      };
    });
  }

  /** Từ (game từ vựng) hoặc câu hỏi (game ngữ pháp) của bài học mà game dùng được. */
  private select(def: GameDefinition, lesson: LessonContent) {
    if (usesQuestions(def))
      return selectQuestionsForGame(
        def,
        lessonQuestionCandidates(lesson.questions),
      );
    return {
      ...selectWordsForGame(
        def,
        lesson.words.map((w) => w.vocabulary),
      ),
      questions: [],
    };
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
