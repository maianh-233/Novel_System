import type { GameWord, Level } from '@novel/shared';
import { describe, expect, it } from 'vitest';
import { blankPositions, buildPuzzle, fits } from './logic';

const w = (word: string): GameWord => ({ id: word, word, meaning: 'nghĩa' });
const LEVELS: Level[] = [1, 2, 3];

const missingLetters = (p: ReturnType<typeof buildPuzzle>) =>
  p.slots.filter((s) => s.hidden).map((s) => s.char.toLowerCase());

describe('buildPuzzle', () => {
  it('cấp 1 thiếu 1 chữ, cấp 2 thiếu 2, cấp 3 thiếu 3', () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 30; i++) {
        expect(missingLetters(buildPuzzle(w('elephant'), level))).toHaveLength(
          level,
        );
      }
    }
  });

  it('giữ nguyên từ gốc, chỉ đánh dấu ô trống', () => {
    const p = buildPuzzle(w('Butterfly'), 3);
    expect(p.slots.map((s) => s.char).join('')).toBe('Butterfly');
  });

  it('từ ngắn vẫn chừa lại ít nhất một chữ', () => {
    for (let i = 0; i < 30; i++) {
      const p = buildPuzzle(w('cat'), 3);
      expect(missingLetters(p)).toHaveLength(2);
      expect(
        buildPuzzle(w('go'), 3).slots.filter((s) => s.hidden),
      ).toHaveLength(1);
    }
  });

  it('từ một chữ cái thì che chính chữ đó', () => {
    const p = buildPuzzle(w('A'), 2);
    expect(p.slots).toEqual([{ char: 'A', hidden: true }]);
    expect(p.tiles.map((t) => t.letter)).toContain('a');
  });

  it('cấp 1–2 không che chữ đầu; cấp 3 có thể che', () => {
    const firstHidden = (level: Level) =>
      Array.from({ length: 200 }, () => buildPuzzle(w('rabbit'), level)).some(
        (p) => p.slots[0].hidden,
      );
    expect(firstHidden(1)).toBe(false);
    expect(firstHidden(2)).toBe(false);
    expect(firstHidden(3)).toBe(true);
  });

  it('không che dấu cách hay gạch nối', () => {
    for (let i = 0; i < 50; i++) {
      const p = buildPuzzle(w("go to school t-shirt it's"), 3);
      for (const s of p.slots) {
        if (!/\p{L}/u.test(s.char)) expect(s.hidden).toBe(false);
      }
    }
  });

  it('bàn phím có đủ chữ còn thiếu (kể cả chữ lặp) và chữ nhiễu không trùng', () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 30; i++) {
        const p = buildPuzzle(w('apple'), level);
        const missing = missingLetters(p).sort();
        const letters = p.tiles.map((t) => t.letter);
        const decoys = [...letters];
        for (const m of missing) decoys.splice(decoys.indexOf(m), 1);
        expect(decoys).toHaveLength(level + 1);
        expect(decoys.some((d) => missing.includes(d))).toBe(false);
        expect(new Set(decoys).size).toBe(decoys.length);
        expect(new Set(p.tiles.map((t) => t.id)).size).toBe(p.tiles.length);
      }
    }
  });
});

describe('fits / blankPositions', () => {
  it('kiểm tra theo từng ô, không phân biệt hoa thường', () => {
    const p = buildPuzzle(w('Dog'), 3, () => 0);
    const blanks = blankPositions(p);
    expect(blanks.length).toBeGreaterThan(0);
    for (const pos of blanks) {
      expect(fits(p, pos, p.slots[pos].char.toUpperCase())).toBe(true);
      expect(fits(p, pos, p.slots[pos].char.toLowerCase())).toBe(true);
      expect(fits(p, pos, 'z')).toBe(false);
    }
    expect(blanks).toEqual([...blanks].sort((a, b) => a - b));
  });
});
