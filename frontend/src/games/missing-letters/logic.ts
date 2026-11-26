import type { GameWord, Level, Stage } from '@novel/shared';
import { shuffle } from '../shared/random';

/** Bấm sai bao nhiêu lần trong một từ thì hiện cả từ và sang từ tiếp. */
export const MAX_MISSES = 3;

export interface MissingLettersProfile {
  /** Số chữ cần che, tính theo số chữ cái của từ. */
  blanks: (letterCount: number) => number;
  /** Số chữ nhiễu thêm vào bàn phím, ngoài các chữ còn thiếu. */
  decoys: number;
  /** Không che chữ đầu tiên (nếu còn chỗ khác để che). */
  keepFirst: boolean;
  /** Hiện hình minh hoạ. */
  showImage: boolean;
  /** Tự đọc to từ khi sang từ mới. */
  readAloud: boolean;
}

/** Cấp 2: che theo tỉ lệ số chữ (từ dài thiếu nhiều chữ hơn), ít nhất 2 chữ. */
const SECONDARY_RATIO: Record<Level, number> = { 1: 0.3, 2: 0.45, 3: 0.6 };

/**
 * Bộ độ khó (docs/PLAN-CAP2.md mục 3).
 * Tiểu học: cấp 1 thiếu 1 chữ, cấp 3 thiếu 3 chữ; cấp 1–2 giữ chữ đầu; có hình; cấp 1 tự đọc to.
 * Cấp 2: thiếu nhiều chữ hơn (kể cả chữ đầu), thêm chữ nhiễu, không có hình, không tự đọc.
 */
export function missingLettersProfile(
  stage: Stage,
  level: Level,
): MissingLettersProfile {
  if (stage === 'primary') {
    return {
      blanks: () => level,
      decoys: level + 1,
      keepFirst: level < 3,
      showImage: true,
      readAloud: level === 1,
    };
  }
  return {
    blanks: (n) => Math.max(2, Math.round(n * SECONDARY_RATIO[level])),
    decoys: level + 2,
    keepFirst: false,
    showImage: false,
    readAloud: false,
  };
}

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
 * `keepFirst`: không che chữ đầu tiên nếu còn chỗ khác để che.
 */
function pickHidden(
  letterIdx: number[],
  profile: MissingLettersProfile,
  random: () => number,
): Set<number> {
  const want = Math.max(
    1,
    Math.min(profile.blanks(letterIdx.length), letterIdx.length - 1),
  );
  const keepFirst = profile.keepFirst && letterIdx.length - 1 >= want;
  const pool = keepFirst ? letterIdx.slice(1) : letterIdx;
  return new Set(shuffle(pool, random).slice(0, want));
}

export function buildPuzzle(
  word: GameWord,
  level: Level,
  random: () => number = Math.random,
  stage: Stage = 'primary',
): Puzzle {
  const profile = missingLettersProfile(stage, level);
  const chars = [...word.word.trim()];
  const letterIdx = chars.flatMap((c, i) => (isLetter(c) ? [i] : []));
  const hidden = pickHidden(letterIdx, profile, random);
  const slots = chars.map((char, i) => ({ char, hidden: hidden.has(i) }));

  const missing = slots
    .filter((s) => s.hidden)
    .map((s) => s.char.toLowerCase());
  const missingSet = new Set(missing);
  const decoys = shuffle(
    ALPHABET.filter((l) => !missingSet.has(l)),
    random,
  ).slice(0, profile.decoys);
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
  stage: Stage = 'primary',
) => words.map((w) => buildPuzzle(w, level, random, stage));

/** Vị trí các ô trống, theo thứ tự từ trái sang phải — em điền lần lượt. */
export const blankPositions = (p: Puzzle) =>
  p.slots.flatMap((s, i) => (s.hidden ? [i] : []));

/** Chữ `letter` có đúng cho ô ở vị trí `position` không (không phân biệt hoa thường). */
export const fits = (p: Puzzle, position: number, letter: string) =>
  p.slots[position]?.char.toLowerCase() === letter.toLowerCase();
