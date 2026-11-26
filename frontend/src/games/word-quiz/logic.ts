import type { GameWord, Level, Stage } from '@novel/shared';
import { shuffle } from '../shared/random';
import { clozeOf, type Cloze } from '../shared/sentence';

/**
 * - meaning: đọc từ tiếng Anh → chọn nghĩa tiếng Việt (tiểu học, cấp 2 cấp độ 1).
 * - word: đọc nghĩa tiếng Việt → chọn từ tiếng Anh (chiều Việt → Anh).
 * - cloze: đọc câu ví dụ có chỗ trống → chọn từ điền vào.
 */
export type QuizMode = 'meaning' | 'word' | 'cloze';

export interface QuizQuestion {
  word: GameWord;
  mode: QuizMode;
  /** Câu có chỗ trống (chỉ ở chế độ cloze). */
  cloze?: Cloze;
  /** Các lựa chọn, đã trộn; luôn chứa đúng một đáp án. */
  options: string[];
  answer: string;
}

/**
 * Bộ độ khó (docs/PLAN-CAP2.md mục 3).
 * Tiểu học: luôn chọn nghĩa; cấp 1 có 3 lựa chọn, cấp 2–3 có 4.
 * Cấp 2: luôn 4 lựa chọn; cấp độ 1 chọn nghĩa, cấp độ 2 xen kẽ Anh → Việt / Việt → Anh,
 * cấp độ 3 điền từ vào câu ví dụ (từ không có câu ví dụ hợp lệ thì hỏi Việt → Anh).
 */
export function quizProfile(stage: Stage, level: Level) {
  if (stage === 'primary') {
    return {
      optionCount: level === 1 ? 3 : 4,
      modeAt: (): QuizMode => 'meaning',
    };
  }
  return {
    optionCount: 4,
    modeAt: (index: number): QuizMode =>
      level === 1
        ? 'meaning'
        : level === 2
          ? index % 2 === 0
            ? 'meaning'
            : 'word'
          : 'cloze',
  };
}

/** Sau bấm sai lần thứ mấy thì hiện đáp án và sang câu tiếp. */
export const MAX_ATTEMPTS = 2;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Mỗi từ một câu hỏi. Đáp án nhiễu lấy từ các từ khác trong lượt, không lặp, không có cái nào
 * cũng "đúng": hỏi nghĩa thì bỏ nghĩa trùng; hỏi từ thì bỏ từ trùng chữ hoặc cùng nghĩa (mum / mom).
 */
export function buildQuestions(
  words: GameWord[],
  level: Level,
  random: () => number = Math.random,
  stage: Stage = 'primary',
): QuizQuestion[] {
  const { optionCount: want, modeAt } = quizProfile(stage, level);
  return words.map((word, index) => {
    let mode = modeAt(index);
    const cloze = mode === 'cloze' ? clozeOf(word.example, word.word) : null;
    if (mode === 'cloze' && !cloze) mode = 'word';

    const askMeaning = mode === 'meaning';
    const answer = askMeaning ? word.meaning : word.word;
    const seen = new Set([norm(answer)]);
    const distractors: string[] = [];
    for (const other of shuffle(words, random)) {
      if (distractors.length >= want - 1) break;
      if (!askMeaning && norm(other.meaning) === norm(word.meaning)) continue;
      const option = askMeaning ? other.meaning : other.word;
      const key = norm(option);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(option);
    }
    return {
      word,
      mode,
      ...(cloze && { cloze }),
      options: shuffle([answer, ...distractors], random),
      answer,
    };
  });
}

export const isCorrect = (q: QuizQuestion, option: string) =>
  norm(option) === norm(q.answer);
