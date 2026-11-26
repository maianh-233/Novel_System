import type { GameWord, Level } from '@novel/shared';
import { shuffle } from '../shared/random';

/** Bấm sai bao nhiêu lần trong một từ thì hiện cả từ và sang từ tiếp. */
export const MAX_MISSES = 3;

/** Số chữ bị che theo cấp độ (cấp 1 thiếu 1 chữ, cấp 3 thiếu 3 chữ). */
export const blanksFor = (level: Level) => level;

/** Số chữ nhiễu thêm vào bàn phím, ngoài các chữ còn thiếu. */
export const decoysFor = (level: Level) => level + 1;

export interface Slot {
  /** Ký tự gốc trong từ (giữ nguyên hoa thường). */
  char: string;
  /** true = ô trống em phải điền. Dấu cách, gạch nối… không bao giờ bị che. */
  hidden: boolean;
}

export interface Tile {
  id: number;
  /** Chữ thường. */
  letter: string;
}

export interface Puzzle {
  word: GameWord;
  slots: Slot[];
  /** Bàn phím: đủ các chữ còn thiếu (kể cả chữ lặp) + chữ nhiễu, đã trộn. */
  tiles: Tile[];
}

const isLetter = (c: string) => /\p{L}/u.test(c);
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Chọn vị trí che: luôn chừa lại ít nhất một chữ để em có chỗ bám (trừ từ chỉ có một chữ).
 * Cấp 1–2 không che chữ đầu tiên nếu còn chỗ khác để che.
 */
function pickHidden(
  letterIdx: number[],
  level: Level,
  random: () => number,
): Set<number> {
  const want = Math.max(1, Math.min(blanksFor(level), letterIdx.length - 1));
  const keepFirst = level < 3 && letterIdx.length - 1 >= want;
  const pool = keepFirst ? letterIdx.slice(1) : letterIdx;
  return new Set(shuffle(pool, random).slice(0, want));
}

export function buildPuzzle(
  word: GameWord,
  level: Level,
  random: () => number = Math.random,
): Puzzle {
  const chars = [...word.word.trim()];
  const letterIdx = chars.flatMap((c, i) => (isLetter(c) ? [i] : []));
  const hidden = pickHidden(letterIdx, level, random);
  const slots = chars.map((char, i) => ({ char, hidden: hidden.has(i) }));

  const missing = slots
    .filter((s) => s.hidden)
    .map((s) => s.char.toLowerCase());
  const missingSet = new Set(missing);
  const decoys = shuffle(
    ALPHABET.filter((l) => !missingSet.has(l)),
    random,
  ).slice(0, decoysFor(level));
  const tiles = shuffle([...missing, ...decoys], random).map((letter, id) => ({
    id,
    letter,
  }));
  return { word, slots, tiles };
}

export const buildPuzzles = (
  words: GameWord[],
  level: Level,
  random: () => number = Math.random,
) => words.map((w) => buildPuzzle(w, level, random));

/** Vị trí các ô trống, theo thứ tự từ trái sang phải — em điền lần lượt. */
export const blankPositions = (p: Puzzle) =>
  p.slots.flatMap((s, i) => (s.hidden ? [i] : []));

/** Chữ `letter` có đúng cho ô ở vị trí `position` không (không phân biệt hoa thường). */
export const fits = (p: Puzzle, position: number, letter: string) =>
  p.slots[position]?.char.toLowerCase() === letter.toLowerCase();
