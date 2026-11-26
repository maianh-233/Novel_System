import { describe, expect, it } from 'vitest';
import { answerText, plainText } from './questions';

describe('answerText', () => {
  it('dạng chọn: chữ cái + lựa chọn, bỏ dấu gạch chân', () => {
    expect(
      answerText({
        type: 'pronunciation',
        options: ['c[a]t', 'n[a]me'],
        correct: 1,
        accepted: [],
      }),
    ).toBe('B. name');
  });

  it('đúng/sai hiện tiếng Việt', () => {
    expect(
      answerText({
        type: 'true_false',
        options: ['True', 'False'],
        correct: 1,
        accepted: [],
      }),
    ).toBe('Sai');
  });

  it('dạng gõ: liệt kê mọi đáp án; sắp xếp: câu đầu tiên', () => {
    const typed = { options: [], correct: null, accepted: ['went', 'did go'] };
    expect(answerText({ type: 'verb_form', ...typed })).toBe('went / did go');
    expect(answerText({ type: 'reorder', ...typed })).toBe('went');
  });

  it('plainText bỏ ngoặc vuông', () => {
    expect(plainText('She [go] to school')).toBe('She go to school');
  });
});
