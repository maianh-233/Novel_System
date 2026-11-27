import type { Stage } from './classes.js';
import type { QuestionPublic, QuestionResponse } from './questions.js';
import type { GameWord, Level } from './vocabulary.js';

export type GameGroup = 'typing' | 'vocabulary' | 'grammar' | 'battle' | 'fun';

/** Dữ liệu cần có ở mỗi từ để game dùng được từ đó. */
export type WordRequirement = 'image' | 'audio';

/** Nền tảng đưa cho game khi bắt đầu một lượt chơi. */
export interface GameContent {
  sessionId: string;
  lessonId: string;
  level: Level;
  /** Cấp học của em đang chơi — game chọn bộ độ khó theo cấp học + cấp độ. */
  stage: Stage;
  /** Game từ vựng: các từ của lượt. Game ngữ pháp: []. */
  words: GameWord[];
  /** Game ngữ pháp (C4): các câu hỏi của lượt, theo thứ tự gốc. Game từ vựng: []. */
  questions: GameQuestion[];
}

/**
 * Câu hỏi như game ngữ pháp nhận được: kèm đáp án để em thấy đúng/sai ngay (đây là luyện tập,
 * không phải đề thi). Máy chủ vẫn chấm lại khi nhận kết quả, nên sửa kết quả gửi lên không có tác dụng.
 */
export interface GameQuestion extends QuestionPublic {
  /** Vị trí đáp án đúng (dạng chọn). */
  correct: number | null;
  /** Các đáp án chấp nhận (dạng gõ, sắp xếp). */
  accepted: string[];
  explanation: string | null;
}

/** Câu trả lời một câu hỏi, theo thứ tự lựa chọn GỐC (máy chủ chấm lại bằng `gradeQuestion`). */
export interface GameQuestionAnswer {
  questionId: string;
  response: QuestionResponse;
  attempts: number;
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
  /** Game ngữ pháp: câu trả lời từng câu hỏi. */
  questionAnswers?: GameQuestionAnswer[];
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
