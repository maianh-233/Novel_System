/**
 * Vòng lặp chơi của học sinh (Giai đoạn 3): chọn bài học → bắt đầu lượt → game chạy → gửi kết quả.
 */
import { z } from 'zod';
import type { GameAnswer, GameContent } from './game.js';
import { questionResponseSchema } from './exams.js';
import type { GameWord, Level } from './vocabulary.js';

const id = z.string().min(1).max(40);

export const startSessionSchema = z.object({
  gameSlug: z.string().trim().min(1).max(40),
  lessonId: id,
});
export type StartSessionRequest = z.infer<typeof startSessionSchema>;

/** Thân request khi kết thúc lượt (sessionId nằm trên URL). */
export const finishSessionSchema = z.object({
  score: z.number().int().min(0).max(1_000_000),
  durationMs: z.number().int().min(0).max(3_600_000),
  answers: z
    .array(
      z.object({
        vocabularyId: id,
        correct: z.boolean(),
        attempts: z.number().int().min(1).max(99),
      }),
    )
    .max(200),
  /** Game ngữ pháp: câu trả lời từng câu hỏi (theo thứ tự lựa chọn gốc). */
  questionAnswers: z
    .array(
      z.object({
        questionId: id,
        response: questionResponseSchema,
        attempts: z.number().int().min(1).max(99),
      }),
    )
    .max(100)
    .optional(),
});
export type FinishSessionRequest = z.infer<typeof finishSessionSchema>;

/** Bài học học sinh chọn được cho một game. */
export interface PlayLesson {
  id: string;
  title: string;
  description: string | null;
  level: Level;
  /** Số từ game dùng được trong bài (đã bỏ từ thiếu hình, ngừng dùng…). */
  wordCount: number;
  /** Game ngữ pháp: số câu hỏi game dùng được trong Unit. */
  questionCount: number;
}

export interface PlayGameInfo {
  slug: string;
  name: string;
  isEnabled: boolean;
  /** Giây; 0 = không giới hạn. */
  timeLimitSec: number;
  lessons: PlayLesson[];
}

export interface StartSessionResponse {
  content: GameContent;
  timeLimitSec: number;
}

export interface FinishSessionResponse {
  stars: 0 | 1 | 2 | 3;
  correctCount: number;
  wrongCount: number;
  /** Số từ tính vào kết quả (mẫu số của tỉ lệ đúng). */
  totalWords: number;
  /** Tổng số sao của học sinh sau lượt này. */
  totalStars: number;
  /** Từ trả lời sai hoặc chưa trả lời — hiện lại kèm gợi ý. */
  mistakes: GameWord[];
}

export type PlayErrorCode =
  | 'game_unavailable'
  | 'lesson_unavailable'
  | 'not_enough_words'
  | 'session_finished'
  | 'session_expired'
  | 'invalid_answers';

export interface RoundRating {
  stars: 0 | 1 | 2 | 3;
  correctCount: number;
  wrongCount: number;
  totalWords: number;
}

/**
 * Chấm một lượt chơi. Sao theo tỉ lệ đúng: 3 sao ≥ 90%, 2 sao ≥ 70%, 1 sao khi hoàn thành.
 *
 * - Game không giới hạn thời gian: mẫu số là toàn bộ từ được phát — từ bỏ qua tính là sai,
 *   để không thể lấy 3 sao bằng cách chỉ trả lời 1 từ.
 * - Game tính giờ: danh sách từ là "kho" để chơi tới khi hết giờ, mẫu số là số từ đã trả lời.
 *
 * Gọi sau khi đã kiểm tra `answers` chỉ chứa từ được phát và không trùng (xem `checkAnswers`).
 */
export function rateRound(
  issuedCount: number,
  answers: GameAnswer[],
  timed: boolean,
): RoundRating {
  const correctCount = answers.filter((a) => a.correct).length;
  const answeredWrong = answers.length - correctCount;
  const totalWords = timed ? answers.length : issuedCount;
  const wrongCount = timed ? answeredWrong : totalWords - correctCount;
  if (totalWords === 0 || answers.length === 0) {
    return { stars: 0, correctCount, wrongCount, totalWords };
  }
  const ratio = correctCount / totalWords;
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1;
  return { stars, correctCount, wrongCount, totalWords };
}

/** null = hợp lệ; ngược lại là lý do từ chối (câu hỏi không thuộc lượt, gửi trùng). */
export function checkQuestionAnswers(
  issuedIds: readonly string[],
  answers: ReadonlyArray<{ questionId: string }>,
): string | null {
  const issued = new Set(issuedIds);
  const seen = new Set<string>();
  for (const a of answers) {
    if (!issued.has(a.questionId))
      return 'Có câu hỏi không thuộc lượt chơi này';
    if (seen.has(a.questionId)) return 'Một câu hỏi được gửi kết quả hai lần';
    seen.add(a.questionId);
  }
  return null;
}

/** null = hợp lệ; ngược lại là lý do từ chối. */
export function checkAnswers(
  issuedIds: readonly string[],
  answers: GameAnswer[],
): string | null {
  const issued = new Set(issuedIds);
  const seen = new Set<string>();
  for (const a of answers) {
    if (!issued.has(a.vocabularyId)) return 'Có từ không thuộc lượt chơi này';
    if (seen.has(a.vocabularyId)) return 'Một từ được gửi kết quả hai lần';
    seen.add(a.vocabularyId);
  }
  return null;
}
