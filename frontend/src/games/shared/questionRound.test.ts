import type { GameQuestion } from '@novel/shared';
import { describe, expect, it } from 'vitest';
import { checkRoundQuestion, isReady, prepareRound } from './questionRound';

const mcq: GameQuestion = {
  id: 'q1',
  type: 'mcq',
  prompt: 'She ___ to school.',
  hint: null,
  options: ['go', 'goes', 'going', 'gone'],
  passageId: null,
  correct: 1,
  accepted: [],
  explanation: 'Chủ ngữ số ít.',
};
const reorder: GameQuestion = {
  id: 'q2',
  type: 'reorder',
  prompt: 'Sắp xếp',
  hint: null,
  options: ['I', 'go', 'to school'],
  passageId: null,
  correct: null,
  accepted: ['I go to school'],
  explanation: null,
};
const error: GameQuestion = {
  ...mcq,
  id: 'q3',
  type: 'error',
  prompt: 'She [go] to [school] [every] [day].',
  options: ['go', 'school', 'every', 'day'],
  correct: 0,
};

/** Random cố định để test lặp lại được. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('prepareRound', () => {
  it('trộn lựa chọn trắc nghiệm nhưng vẫn giữ đủ các lựa chọn', () => {
    const [rq] = prepareRound([mcq], seq(0.1, 0.7, 0.3));
    expect(rq.order).not.toBeNull();
    expect([...rq.shown.options].sort()).toEqual([...mcq.options].sort());
    expect(rq.shown.options).toEqual(rq.order!.map((i) => mcq.options[i]));
  });

  it('cụm từ câu sắp xếp không bao giờ ra đúng thứ tự gốc', () => {
    for (let k = 0; k < 20; k++) {
      const [rq] = prepareRound([reorder], seq(0.99, 0.99, 0.99));
      expect(rq.shown.options).not.toEqual(reorder.options);
    }
  });

  it('tìm lỗi sai giữ nguyên thứ tự A–D (các phần nằm trong câu)', () => {
    const [rq] = prepareRound([error]);
    expect(rq.order).toBeNull();
    expect(rq.shown.options).toEqual(error.options);
  });
});

describe('checkRoundQuestion', () => {
  it('chấm theo thứ tự em thấy, gửi về theo thứ tự gốc', () => {
    const [rq] = prepareRound([mcq], seq(0.1, 0.7, 0.3));
    const shownIndex = rq.shown.options.indexOf('goes');
    const ok = checkRoundQuestion(rq, shownIndex);
    expect(ok).toMatchObject({ correct: true, original: 1 });
    expect(ok.feedback).toMatchObject({
      correct: true,
      correctIndex: shownIndex,
      explanation: 'Chủ ngữ số ít.',
    });
    // Chữ cái đáp án theo thứ tự em thấy.
    expect(ok.feedback.answer).toContain('goes');

    const wrong = checkRoundQuestion(rq, rq.shown.options.indexOf('go'));
    expect(wrong).toMatchObject({ correct: false, original: 0 });
  });

  it('câu sắp xếp: xếp đúng câu là đúng, dù cụm từ đã bị trộn', () => {
    const [rq] = prepareRound([reorder], seq(0.5, 0.2));
    const pos = (f: string) => rq.shown.options.indexOf(f);
    const r = checkRoundQuestion(rq, [pos('I'), pos('go'), pos('to school')]);
    expect(r).toMatchObject({ correct: true, original: [0, 1, 2] });
  });
});

describe('isReady', () => {
  it('chọn / gõ / xếp đủ mới kiểm tra được', () => {
    expect(isReady(mcq, null)).toBe(false);
    expect(isReady(mcq, 2)).toBe(true);
    const typed = { ...mcq, type: 'verb_form' as const, options: [] };
    expect(isReady(typed, '  ')).toBe(false);
    expect(isReady(typed, 'goes')).toBe(true);
    expect(isReady(reorder, [0, 1])).toBe(false);
    expect(isReady(reorder, [2, 0, 1])).toBe(true);
  });
});
