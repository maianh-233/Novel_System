import type { GameWord } from '@novel/shared';
import { describe, expect, it } from 'vitest';
import { buildQuestions, isCorrect, lookAlike } from './logic';

const w = (id: string, meaning: string, imageUrl = `/img/${id}`): GameWord => ({
  id,
  word: id,
  meaning,
  imageUrl,
});

const WORDS = [
  w('cat', 'con mèo'),
  w('dog', 'con chó'),
  w('bee', 'con ong'),
  w('cow', 'con bò'),
  w('pig', 'con lợn'),
];

describe('buildQuestions', () => {
  it('mỗi từ một câu, luôn có từ đúng, đủ số lựa chọn theo cấp độ', () => {
    for (const level of [1, 2, 3] as const) {
      const qs = buildQuestions(WORDS, level);
      expect(qs.map((q) => q.word.id)).toEqual(WORDS.map((x) => x.id));
      for (const q of qs) {
        expect(q.options).toHaveLength(level === 1 ? 3 : 4);
        expect(q.options.filter((o) => isCorrect(q, o))).toHaveLength(1);
        expect(new Set(q.options.map((o) => o.word)).size).toBe(
          q.options.length,
        );
      }
    }
  });

  it('không lấy từ cũng đúng với hình làm đáp án nhiễu', () => {
    const words = [
      w('mum', 'mẹ', '/img/mother'),
      w('mom', 'mẹ', '/img/mother-2'),
      w('mother', 'người mẹ', '/img/mother'),
      w('Orange', 'quả cam', '/img/orange'),
      w('orange', 'màu cam', '/img/orange-color'),
      w('dad', 'bố'),
      w('sis', 'chị'),
      w('bro', 'anh'),
    ];
    for (let i = 0; i < 20; i++) {
      for (const q of buildQuestions(words, 2)) {
        const others = q.options.filter((o) => o.id !== q.word.id);
        for (const o of others) {
          expect(o.word.toLowerCase()).not.toBe(q.word.word.toLowerCase());
          expect(o.meaning).not.toBe(q.word.meaning);
          expect(o.imageUrl).not.toBe(q.word.imageUrl);
        }
      }
    }
  });

  it('cấp 3 ưu tiên đáp án nhiễu trông giống từ đúng', () => {
    const words = [
      w('cat', 'con mèo'),
      w('car', 'xe hơi'),
      w('cap', 'mũ lưỡi trai'),
      w('cot', 'cũi'),
      w('elephant', 'con voi'),
      w('banana', 'quả chuối'),
      w('umbrella', 'cái ô'),
    ];
    const cat = buildQuestions(words, 3).find((q) => q.word.id === 'cat')!;
    expect(cat.options.map((o) => o.id).sort()).toEqual(
      ['cap', 'car', 'cat', 'cot'].sort(),
    );
  });

  it('ít từ thì ít lựa chọn hơn, không bị lặp', () => {
    const qs = buildQuestions(WORDS.slice(0, 2), 3);
    expect(qs[0].options).toHaveLength(2);
  });
});

describe('lookAlike', () => {
  it('cùng chữ đầu, chữ cuối, độ dài thì giống hơn', () => {
    expect(lookAlike('cat', 'Cap')).toBeGreaterThan(lookAlike('cat', 'dog'));
    expect(lookAlike('cat', 'cot')).toBe(4);
    expect(lookAlike('cat', 'banana')).toBe(0);
  });
});
