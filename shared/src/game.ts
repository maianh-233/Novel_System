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

/**
 * Props mọi mini-game nhận từ khung chơi. Game chỉ cần đọc `content` và gọi `onFinish` một lần
 * khi xong; nền tảng lo phần lưu kết quả, tính sao và màn kết quả.
 */
export interface GameProps {
  content: GameContent;
  /** Giây; 0 = không giới hạn. */
  timeLimitSec: number;
  onFinish: (result: GameResult) => void;
}
