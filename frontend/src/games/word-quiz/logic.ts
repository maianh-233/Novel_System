import type { GameWord, Level } from '@novel/shared';
import { shuffle } from '../shared/random';

export interface QuizQuestion {
  word: GameWord;
  /** Các nghĩa để chọn, đã trộn; luôn chứa nghĩa đúng. */
  options: string[];
}

/** Cấp 1: 3 lựa chọn; cấp 2–3: 4 lựa chọn. */
export const optionCount = (level: Level) => (level === 1 ? 3 : 4);

/** Sau bấm sai lần thứ mấy thì hiện đáp án và sang câu tiếp. */
export const MAX_ATTEMPTS = 2;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Mỗi từ một câu hỏi: nghĩa đúng + nghĩa của các từ khác trong lượt làm đáp án nhiễu
 * (không lặp, không trùng nghĩa đúng — kể cả khác hoa thường).
 */
export function buildQuestions(
  words: GameWord[],
  level: Level,
  random: () => number = Math.random,
): QuizQuestion[] {
  const want = optionCount(level);
  return words.map((word) => {
    const seen = new Set([norm(word.meaning)]);
    const distractors: string[] = [];
    for (const other of shuffle(words, random)) {
      if (distractors.length >= want - 1) break;
      const key = norm(other.meaning);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(other.meaning);
    }
    return { word, options: shuffle([word.meaning, ...distractors], random) };
  });
}

export const isCorrect = (q: QuizQuestion, option: string) =>
  norm(option) === norm(q.word.meaning);
