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

describe('cấp 2', () => {
  const words: GameWord[] = [
    { id: 'cat', word: 'cat', meaning: 'con mèo', example: 'My cat is black.' },
    { id: 'dog', word: 'dog', meaning: 'con chó', example: 'The dog runs.' },
    { id: 'go', word: 'go', meaning: 'đi', example: 'She goes home.' },
    { id: 'mum', word: 'mum', meaning: 'mẹ' },
    { id: 'mom', word: 'mom', meaning: 'Mẹ' },
    { id: 'pig', word: 'pig', meaning: 'con lợn' },
  ];

  it('luôn có 4 lựa chọn, kể cả cấp độ 1', () => {
    for (const level of [1, 2, 3] as const) {
      for (const q of buildQuestions(words, level, Math.random, 'secondary')) {
        expect(q.options).toHaveLength(4);
        expect(q.options.filter((o) => isCorrect(q, o))).toHaveLength(1);
      }
    }
  });

  it('cấp độ 1 hỏi nghĩa; cấp độ 2 xen kẽ Anh → Việt và Việt → Anh', () => {
    const l1 = buildQuestions(words, 1, Math.random, 'secondary');
    expect(l1.every((q) => q.mode === 'meaning')).toBe(true);
    const l2 = buildQuestions(words, 2, Math.random, 'secondary');
    expect(l2.map((q) => q.mode)).toEqual([
      'meaning',
      'word',
      'meaning',
      'word',
      'meaning',
      'word',
    ]);
    for (const q of l2.filter((x) => x.mode === 'word')) {
      expect(q.answer).toBe(q.word.word);
    }
  });

  it('cấp độ 3 điền từ vào câu ví dụ; không có câu hợp lệ thì hỏi Việt → Anh', () => {
    const qs = buildQuestions(words, 3, Math.random, 'secondary');
    const byId = Object.fromEntries(qs.map((q) => [q.word.id, q]));
    expect(byId.cat.mode).toBe('cloze');
    expect(byId.cat.cloze).toEqual({
      before: 'My ',
      answer: 'cat',
      after: ' is black.',
    });
    expect(byId.go.mode).toBe('word'); // câu chỉ có "goes"
    expect(byId.pig.mode).toBe('word'); // không có câu
  });

  it('hỏi từ thì không lấy từ cùng nghĩa làm đáp án nhiễu (mum / mom)', () => {
    for (let i = 0; i < 30; i++) {
      for (const q of buildQuestions(words, 3, Math.random, 'secondary')) {
        if (q.word.id === 'mum') expect(q.options).not.toContain('mom');
        if (q.word.id === 'mom') expect(q.options).not.toContain('mum');
      }
    }
  });

  it('tiểu học giữ nguyên: chỉ hỏi nghĩa', () => {
    for (const level of [1, 2, 3] as const) {
      expect(
        buildQuestions(words, level).every((q) => q.mode === 'meaning'),
      ).toBe(true);
    }
  });
});
