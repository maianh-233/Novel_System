import type { GameWord, Level } from './vocabulary.js';

export type GameGroup = 'typing' | 'vocabulary' | 'battle' | 'fun';

/** Dữ liệu cần có ở mỗi từ để game dùng được từ đó. */
export type WordRequirement = 'image' | 'audio';

/** Nền tảng đưa cho game khi bắt đầu một lượt chơi. */
export interface GameContent {
  sessionId: string;
  lessonId: string;
  level: Level;
  words: GameWord[];
}

/** Kết quả của một từ trong lượt chơi. */
export interface GameAnswer {
  vocabularyId: string;
  correct: boolean;
  attempts: number;
}

/** Game trả lại cho nền tảng khi kết thúc lượt chơi. */
export interface GameResult {
  sessionId: string;
  score: number;
  durationMs: number;
  answers: GameAnswer[];
}

/** Số sao (0–3) theo tỉ lệ trả lời đúng. Dùng chung cho FE (hiển thị) và BE (lưu). */
export function starsFor(answers: GameAnswer[]): 0 | 1 | 2 | 3 {
  if (answers.length === 0) return 0;
  const ratio = answers.filter((a) => a.correct).length / answers.length;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  return 1;
}
