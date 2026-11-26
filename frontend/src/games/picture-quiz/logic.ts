import type { GameWord, Level } from '@novel/shared';
import { shuffle } from '../shared/random';

export interface PictureQuestion {
  word: GameWord;
  /** Các từ để chọn, đã trộn; luôn chứa đúng một từ khớp với hình. */
  options: GameWord[];
}

/** Cấp 1: 3 lựa chọn; cấp 2–3: 4 lựa chọn. */
export const optionCount = (level: Level) => (level === 1 ? 3 : 4);

/** Sau bấm sai lần thứ mấy thì hiện đáp án và sang câu tiếp. */
export const MAX_ATTEMPTS = 2;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Từ này có làm đáp án nhiễu cho hình của `target` được không. Bỏ những từ cũng "đúng"
 * với hình: trùng chữ, dùng chung hình, hoặc cùng nghĩa (mum / mom).
 */
const canDistract = (target: GameWord, other: GameWord) =>
  norm(other.word) !== norm(target.word) &&
  norm(other.meaning) !== norm(target.meaning) &&
  !(!!other.imageUrl && other.imageUrl === target.imageUrl);

/**
 * Hai từ trông giống nhau đến đâu: cùng chữ đầu, cùng chữ cuối, dài gần bằng nhau.
 * Cấp 3 ưu tiên đáp án nhiễu giống từ đúng để em phải đọc kỹ (cat / car / cap).
 */
export function lookAlike(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  let score = 0;
  if (x[0] === y[0]) score += 2;
  if (x.at(-1) === y.at(-1)) score += 1;
  if (Math.abs(x.length - y.length) <= 1) score += 1;
  return score;
}

/**
 * Mỗi từ một câu hỏi: hình của từ đó + các từ khác trong lượt làm đáp án nhiễu
 * (không lặp chữ, không có từ nào cũng đúng với hình). Cấp 1–2 chọn nhiễu ngẫu nhiên;
 * cấp 3 chọn những từ trông giống từ đúng nhất.
 */
export function buildQuestions(
  words: GameWord[],
  level: Level,
  random: () => number = Math.random,
): PictureQuestion[] {
  const want = optionCount(level);
  return words.map((word) => {
    let pool = shuffle(
      words.filter((o) => canDistract(word, o)),
      random,
    );
    if (level === 3) {
      // sort ổn định: cùng điểm thì giữ thứ tự đã trộn.
      pool = pool.sort(
        (a, b) => lookAlike(word.word, b.word) - lookAlike(word.word, a.word),
      );
    }
    const seen = new Set<string>();
    const distractors: GameWord[] = [];
    for (const other of pool) {
      if (distractors.length >= want - 1) break;
      const key = norm(other.word);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(other);
    }
    return { word, options: shuffle([word, ...distractors], random) };
  });
}

/** So theo chữ, không theo id: hai từ cùng ghi "orange" thì chọn cái nào cũng đúng. */
export const isCorrect = (q: PictureQuestion, option: GameWord) =>
  option.id === q.word.id || norm(option.word) === norm(q.word.word);
