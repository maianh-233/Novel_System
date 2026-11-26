import type { GameWord, Level, Stage } from '@novel/shared';
import { shuffle } from '../shared/random';
import { sentenceTokens } from '../shared/sentence';

/** Xếp sai bao nhiêu lần thì hiện cả từ và sang từ tiếp. */
export const MAX_ATTEMPTS = 3;

export interface WordBuilderProfile {
  /** Cho sẵn chữ đầu tiên (từ dài hơn 2 chữ). */
  giveFirst: boolean;
  /** Số chữ nhiễu thêm vào đống chữ. */
  decoys: number;
  /** Xếp các từ của câu ví dụ thành câu (từ không có câu hợp lệ thì xếp chữ như thường). */
  sentence: boolean;
}

/**
 * Bộ độ khó (docs/PLAN-CAP2.md mục 3).
 * Tiểu học: cấp 1 cho sẵn chữ đầu; chỉ cấp 3 có 2 chữ nhiễu.
 * Cấp 2: không cho sẵn chữ nào, chữ nhiễu ở mọi cấp độ (1/2/3); cấp độ 3 xếp từ thành câu.
 */
export function wordBuilderProfile(
  stage: Stage,
  level: Level,
): WordBuilderProfile {
  if (stage === 'primary') {
    return {
      giveFirst: level === 1,
      decoys: level === 3 ? 2 : 0,
      sentence: false,
    };
  }
  return { giveFirst: false, decoys: level, sentence: level === 3 };
}

export interface Slot {
  /** Ký tự gốc trong từ (chế độ câu: một từ của câu). */
  char: string;
  /** false = dấu cách, gạch nối… hiện sẵn, không cần xếp. */
  isLetter: boolean;
  /** true = chữ cho sẵn (cấp 1: chữ đầu tiên). */
  given: boolean;
}

export interface Tile {
  id: number;
  /** Ký tự như trong từ (giữ hoa thường), để từ xếp xong trông giống từ gốc. */
  letter: string;
  decoy: boolean;
}

export interface Puzzle {
  word: GameWord;
  /** letter: xếp chữ thành từ; word: xếp từ thành câu ví dụ. */
  unit: 'letter' | 'word';
  slots: Slot[];
  /** Các chữ để xếp (không gồm chữ cho sẵn), đã trộn. */
  tiles: Tile[];
}

const isLetter = (c: string) => /\p{L}/u.test(c);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function buildPuzzle(
  word: GameWord,
  level: Level,
  random: () => number = Math.random,
  stage: Stage = 'primary',
): Puzzle {
  const profile = wordBuilderProfile(stage, level);
  const tokens = profile.sentence ? sentenceTokens(word.example) : null;
  if (tokens) return buildSentencePuzzle(word, tokens, random);

  const chars = [...word.word.trim()];
  const letterCount = chars.filter(isLetter).length;
  let firstGiven = profile.giveFirst && letterCount > 2;
  const slots: Slot[] = chars.map((char) => {
    const letter = isLetter(char);
    const given = letter && firstGiven;
    if (given) firstGiven = false;
    return { char, isLetter: letter, given };
  });

  const answer = slots.filter((s) => s.isLetter && !s.given).map((s) => s.char);
  const inWord = new Set(answer.map((c) => c.toLowerCase()));
  const upper = answer.length > 0 && answer.every((c) => c === c.toUpperCase());
  const decoys = shuffle(
    ALPHABET.filter((l) => !inWord.has(l)),
    random,
  )
    .slice(0, profile.decoys)
    .map((l) => (upper ? l.toUpperCase() : l));

  const letters = shuffle(
    [
      ...answer.map((letter) => ({ letter, decoy: false })),
      ...decoys.map((letter) => ({ letter, decoy: true })),
    ],
    random,
  );
  unscrambleGuard(letters, answer);
  return {
    word,
    unit: 'letter',
    slots,
    tiles: letters.map((t, id) => ({ id, ...t })),
  };
}

/** Chế độ câu: mỗi ô là một từ của câu ví dụ, đống chữ là các từ đã trộn (không có từ nhiễu). */
function buildSentencePuzzle(
  word: GameWord,
  tokens: string[],
  random: () => number,
): Puzzle {
  const letters = shuffle(
    tokens.map((letter) => ({ letter, decoy: false })),
    random,
  );
  unscrambleGuard(letters, tokens);
  return {
    word,
    unit: 'word',
    slots: tokens.map((char) => ({ char, isLetter: true, given: false })),
    tiles: letters.map((t, id) => ({ id, ...t })),
  };
}

/** Đáp án đầy đủ để hiện cho em: từ, hoặc cả câu ở chế độ câu. */
export const answerText = (p: Puzzle) =>
  p.unit === 'word' ? p.slots.map((s) => s.char).join(' ') : p.word.word;

/**
 * Trộn xong mà các chữ thật vẫn đúng thứ tự của từ thì đổi chỗ hai chữ khác nhau,
 * để em luôn phải xếp lại (trừ từ chỉ gồm một loại chữ, như "zz").
 */
function unscrambleGuard(
  letters: { letter: string; decoy: boolean }[],
  answer: string[],
) {
  const real = letters.flatMap((t, i) => (t.decoy ? [] : [i]));
  const inOrder = real.every((i, k) => letters[i].letter === answer[k]);
  if (!inOrder) return;
  for (let a = 0; a < real.length; a++) {
    for (let b = a + 1; b < real.length; b++) {
      const [i, j] = [real[a], real[b]];
      if (letters[i].letter === letters[j].letter) continue;
      [letters[i], letters[j]] = [letters[j], letters[i]];
      return;
    }
  }
}

export const buildPuzzles = (
  words: GameWord[],
  level: Level,
  random: () => number = Math.random,
  stage: Stage = 'primary',
) => words.map((w) => buildPuzzle(w, level, random, stage));

/** Vị trí các ô em phải xếp, từ trái sang phải. */
export const openSlots = (p: Puzzle) =>
  p.slots.flatMap((s, i) => (s.isLetter && !s.given ? [i] : []));

/** Chữ có đúng cho ô không. So theo chữ, nên hai chữ "p" trong "apple" đổi chỗ cho nhau vẫn đúng. */
export const fitsSlot = (p: Puzzle, slot: number, tile: Tile) =>
  same(p.slots[slot]?.char ?? '', tile.letter);

/** Ô nào đang xếp sai (khi đã xếp kín). `placed`: vị trí ô → id chữ. */
export function wrongSlots(p: Puzzle, placed: Record<number, number>) {
  const byId = new Map(p.tiles.map((t) => [t.id, t]));
  return openSlots(p).filter((slot) => {
    const tile = byId.get(placed[slot]);
    return !tile || !fitsSlot(p, slot, tile);
  });
}
