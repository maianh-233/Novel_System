import type { GameWord, Level } from '@novel/shared';
import { describe, expect, it } from 'vitest';
import { buildPuzzle, fitsSlot, openSlots, wrongSlots } from './logic';

const w = (word: string): GameWord => ({ id: word, word, meaning: 'nghĩa' });
const LEVELS: Level[] = [1, 2, 3];

const realLetters = (p: ReturnType<typeof buildPuzzle>) =>
  p.tiles.filter((t) => !t.decoy).map((t) => t.letter);

describe('buildPuzzle', () => {
  it('đống chữ có đúng các chữ của từ (trừ chữ cho sẵn)', () => {
    for (const level of LEVELS) {
      const p = buildPuzzle(w('banana'), level);
      const expected = level === 1 ? 'anana' : 'banana';
      expect(realLetters(p).sort().join('')).toBe(
        [...expected].sort().join(''),
      );
      expect(openSlots(p)).toHaveLength(expected.length);
    }
  });

  it('cấp 1 cho sẵn chữ đầu; cấp 2–3 không cho', () => {
    expect(buildPuzzle(w('tiger'), 1).slots[0].given).toBe(true);
    expect(buildPuzzle(w('tiger'), 2).slots.some((s) => s.given)).toBe(false);
    expect(buildPuzzle(w('tiger'), 3).slots.some((s) => s.given)).toBe(false);
  });

  it('từ quá ngắn thì không cho sẵn chữ nào', () => {
    expect(buildPuzzle(w('go'), 1).slots.some((s) => s.given)).toBe(false);
  });

  it('chỉ cấp 3 có chữ nhiễu, và chữ nhiễu không có trong từ', () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 20; i++) {
        const p = buildPuzzle(w('apple'), level);
        const decoys = p.tiles.filter((t) => t.decoy).map((t) => t.letter);
        expect(decoys).toHaveLength(level === 3 ? 2 : 0);
        for (const d of decoys) expect('apple').not.toContain(d);
      }
    }
  });

  it('chữ nhiễu viết hoa khi từ viết hoa', () => {
    const p = buildPuzzle(w('ABC'), 3);
    for (const t of p.tiles) expect(t.letter).toBe(t.letter.toUpperCase());
  });

  it('dấu cách không phải ô để xếp', () => {
    const p = buildPuzzle(w('ice cream'), 2);
    expect(p.slots[3]).toMatchObject({ char: ' ', isLetter: false });
    expect(openSlots(p)).not.toContain(3);
    expect(p.tiles.some((t) => t.letter === ' ')).toBe(false);
  });

  it('không bao giờ trộn ra đúng thứ tự của từ', () => {
    // random luôn trả 0 / 0.99 → trộn ra thứ tự cố định, có thể trùng thứ tự gốc.
    for (const random of [() => 0, () => 0.99, Math.random]) {
      for (const word of ['cat', 'dog', 'apple', 'go to school']) {
        for (const level of LEVELS) {
          const p = buildPuzzle(w(word), level, random);
          const answer = openSlots(p)
            .map((i) => p.slots[i].char)
            .join('');
          expect(realLetters(p).join('')).not.toBe(answer);
        }
      }
    }
  });
});

describe('wrongSlots / fitsSlot', () => {
  it('chữ lặp đổi chỗ cho nhau vẫn đúng', () => {
    const p = buildPuzzle(w('apple'), 2);
    const open = openSlots(p);
    // Xếp đúng: với mỗi ô, lấy một chữ khớp chưa dùng.
    const left = [...p.tiles];
    const placed: Record<number, number> = {};
    for (const slot of open) {
      const k = left.findIndex((t) => fitsSlot(p, slot, t));
      placed[slot] = left[k].id;
      left.splice(k, 1);
    }
    expect(wrongSlots(p, placed)).toEqual([]);
    // Đổi chỗ hai chữ "p" (ô 1 và 2) vẫn đúng.
    [placed[1], placed[2]] = [placed[2], placed[1]];
    expect(wrongSlots(p, placed)).toEqual([]);
    // Đổi chỗ "a" và "e" thì sai đúng hai ô đó.
    [placed[0], placed[4]] = [placed[4], placed[0]];
    expect(wrongSlots(p, placed)).toEqual([0, 4]);
  });

  it('ô trống tính là sai', () => {
    const p = buildPuzzle(w('cat'), 2);
    expect(wrongSlots(p, {})).toEqual([0, 1, 2]);
  });
});
