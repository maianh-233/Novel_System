import type { GameWord } from '@novel/shared';
import { describe, expect, it } from 'vitest';
import { buildQuestions, isCorrect } from './logic';

const w = (id: string, meaning: string): GameWord => ({
  id,
  word: id,
  meaning,
});

const WORDS = [
  w('cat', 'con mèo'),
  w('dog', 'con chó'),
  w('bee', 'con ong'),
  w('cow', 'con bò'),
  w('pig', 'con lợn'),
];

describe('buildQuestions', () => {
  it('mỗi từ một câu, luôn có nghĩa đúng, đủ số lựa chọn theo cấp độ', () => {
    for (const level of [1, 2, 3] as const) {
      const qs = buildQuestions(WORDS, level);
      expect(qs.map((q) => q.word.id)).toEqual(WORDS.map((x) => x.id));
      for (const q of qs) {
        expect(q.options).toHaveLength(level === 1 ? 3 : 4);
        expect(q.options).toContain(q.word.meaning);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
    }
  });

  it('không dùng nghĩa trùng với nghĩa đúng làm đáp án nhiễu', () => {
    const words = [
      w('mum', 'mẹ'),
      w('mom', 'Mẹ'),
      w('dad', 'bố'),
      w('sis', 'chị'),
      w('bro', 'anh'),
    ];
    for (const q of buildQuestions(words, 3)) {
      const same = q.options.filter((o) => isCorrect(q, o));
      expect(same).toHaveLength(1);
    }
  });

  it('ít từ thì ít lựa chọn hơn, không bị lặp', () => {
    const qs = buildQuestions(WORDS.slice(0, 2), 3);
    expect(qs[0].options).toHaveLength(2);
  });
});
