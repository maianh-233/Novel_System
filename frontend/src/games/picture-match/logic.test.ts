import type { GameWord } from '@novel/shared';
import { describe, expect, it } from 'vitest';
import { buildBoards, isMatch, pairsPerBoard } from './logic';

const w = (
  id: string,
  word = id,
  imageUrl = `/uploads/${id}.webp`,
): GameWord => ({
  id,
  word,
  meaning: `nghĩa ${id}`,
  imageUrl,
});

const words = (n: number) => Array.from({ length: n }, (_, i) => w(`w${i}`));

describe('buildBoards', () => {
  it('dùng mọi từ đúng một lần, cả ở cột hình lẫn cột chữ', () => {
    const list = words(8);
    const boards = buildBoards(list, 2);
    const ids = (pick: 'pictures' | 'labels') =>
      boards.flatMap((b) => b[pick].map((x) => x.id)).sort();
    const all = list.map((x) => x.id).sort();
    expect(ids('pictures')).toEqual(all);
    expect(ids('labels')).toEqual(all);
    for (const b of boards) {
      expect(b.labels.map((x) => x.id).sort()).toEqual(
        b.pictures.map((x) => x.id).sort(),
      );
    }
  });

  it('số cặp mỗi màn theo cấp độ', () => {
    for (const level of [1, 2, 3] as const) {
      const size = pairsPerBoard(level);
      const boards = buildBoards(words(size * 2), level);
      expect(boards.map((b) => b.pictures.length)).toEqual([size, size]);
    }
  });

  it('chia đều, không để một màn chỉ còn một cặp', () => {
    expect(buildBoards(words(6), 3).map((b) => b.pictures.length)).toEqual([
      3, 3,
    ]);
    expect(buildBoards(words(7), 1).map((b) => b.pictures.length)).toEqual([
      3, 2, 2,
    ]);
  });

  it('tách từ trùng chữ hoặc trùng hình sang màn khác khi được', () => {
    const list = [
      w('orange-fruit', 'orange'),
      w('a'),
      w('b'),
      w('orange-color', 'Orange'),
      w('c'),
      w('d', 'd', '/uploads/a.webp'),
    ];
    for (let i = 0; i < 20; i++) {
      for (const b of buildBoards(list, 1)) {
        const ids = b.pictures.map((x) => x.id);
        expect(
          ids.includes('orange-fruit') && ids.includes('orange-color'),
        ).toBe(false);
        expect(ids.includes('a') && ids.includes('d')).toBe(false);
      }
    }
  });

  it('thẻ chữ không xếp thẳng hàng với hình của nó', () => {
    // random luôn trả 0 → hai lần trộn ra cùng một thứ tự, mọi thẻ đều thẳng hàng lúc đầu.
    for (const random of [() => 0, () => 0.99, Math.random]) {
      for (const b of buildBoards(words(5), 3, random)) {
        const aligned = b.labels.filter((x, j) => x.id === b.pictures[j].id);
        expect(aligned).toHaveLength(0);
      }
    }
  });

  it('không có từ thì không có màn', () => {
    expect(buildBoards([], 1)).toEqual([]);
  });
});

describe('isMatch', () => {
  it('đúng khi cùng từ hoặc cùng chữ, sai khi khác chữ', () => {
    expect(isMatch(w('a'), w('a'))).toBe(true);
    expect(isMatch(w('x', 'Orange'), w('y', 'orange '))).toBe(true);
    expect(isMatch(w('cat'), w('dog'))).toBe(false);
  });
});
