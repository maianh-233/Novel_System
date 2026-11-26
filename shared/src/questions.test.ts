import { describe, expect, it } from 'vitest';
import {
  bracketSegments,
  gradeQuestion,
  normalizeAnswer,
  questionInputSchema,
  reorderSentence,
  splitMarked,
  type GradableQuestion,
} from './questions.js';

const choice = (type: GradableQuestion['type'], correct: number) =>
  ({
    type,
    options: ['a', 'b', 'c', 'd'],
    correct,
    accepted: [],
  }) satisfies GradableQuestion;

const typed = (type: GradableQuestion['type'], ...accepted: string[]) =>
  ({ type, options: [], correct: null, accepted }) satisfies GradableQuestion;

describe('normalizeAnswer', () => {
  it('bỏ hoa thường, khoảng trắng thừa và dấu chấm cuối câu', () => {
    expect(normalizeAnswer('  She   GOES to school. ')).toBe(
      'she goes to school',
    );
    expect(normalizeAnswer('Done...')).toBe('done');
  });

  it('quy nháy cong về nháy thẳng', () => {
    expect(normalizeAnswer('It’s my friend’s book')).toBe(
      "it's my friend's book",
    );
    expect(normalizeAnswer('“Hi”')).toBe('"hi"');
  });

  it('bỏ khoảng trắng trước dấu câu, giữ dấu hỏi / chấm than', () => {
    expect(normalizeAnswer('Where are you ?')).toBe('where are you?');
    expect(normalizeAnswer('Yes , I do .')).toBe('yes, i do');
  });
});

describe('gradeQuestion — dạng chọn', () => {
  for (const type of [
    'mcq',
    'pronunciation',
    'stress',
    'error',
    'true_false',
  ] as const) {
    it(`${type}: đúng khi chọn đúng vị trí`, () => {
      const q = choice(type, 2);
      expect(gradeQuestion(q, 2)).toBe(true);
      expect(gradeQuestion(q, 1)).toBe(false);
      expect(gradeQuestion(q, null)).toBe(false);
      expect(gradeQuestion(q, '2')).toBe(false);
    });
  }
});

describe('gradeQuestion — dạng gõ', () => {
  for (const type of ['verb_form', 'word_form', 'fill'] as const) {
    it(`${type}: so với mọi đáp án chấp nhận, sau khi chuẩn hoá`, () => {
      const q = typed(type, 'goes', 'is going');
      expect(gradeQuestion(q, 'goes')).toBe(true);
      expect(gradeQuestion(q, ' Is  Going ')).toBe(true);
      expect(gradeQuestion(q, 'go')).toBe(false);
      expect(gradeQuestion(q, '')).toBe(false);
      expect(gradeQuestion(q, 2)).toBe(false);
    });
  }

  it('viết lại câu: nhiều đáp án, bỏ qua dấu chấm cuối và nháy cong', () => {
    const q = typed(
      'rewrite',
      'She has learned English for 3 years.',
      "She's learned English for 3 years.",
    );
    expect(gradeQuestion(q, 'she has learned English for 3 years')).toBe(true);
    expect(gradeQuestion(q, 'She’s learned English for 3 years.')).toBe(true);
    expect(gradeQuestion(q, 'She learned English for 3 years.')).toBe(false);
  });

  it('không chấm từng phần: thiếu một chữ là sai', () => {
    expect(gradeQuestion(typed('fill', 'beautiful'), 'beautifu')).toBe(false);
  });
});

describe('gradeQuestion — sắp xếp câu', () => {
  const q: GradableQuestion = {
    type: 'reorder',
    options: ['to school', 'I', 'go', 'every day.'],
    correct: null,
    accepted: ['I go to school every day.', 'Every day I go to school.'],
  };

  it('đúng khi thứ tự cụm từ ra một câu được chấp nhận', () => {
    expect(gradeQuestion(q, [1, 2, 0, 3])).toBe(true);
  });

  it('sai khi thứ tự khác, thiếu, thừa hoặc lặp cụm từ', () => {
    expect(gradeQuestion(q, [2, 1, 0, 3])).toBe(false);
    expect(gradeQuestion(q, [1, 2, 0])).toBe(false);
    expect(gradeQuestion(q, [1, 1, 0, 3])).toBe(false);
    expect(gradeQuestion(q, [1, 2, 0, 9])).toBe(false);
    expect(gradeQuestion(q, 'I go to school every day')).toBe(false);
  });

  it('reorderSentence ghép cụm từ theo thứ tự', () => {
    expect(reorderSentence(['b', 'a'], [1, 0])).toBe('a b');
    expect(reorderSentence(['b', 'a'], [0, 0])).toBeNull();
  });
});

describe('đánh dấu trong ngoặc vuông', () => {
  it('lấy các phần trong ngoặc và tách để hiển thị', () => {
    expect(bracketSegments('She [go] to [school] [every] day.')).toEqual([
      'go',
      'school',
      'every',
    ]);
    expect(splitMarked('c[a]t')).toEqual([
      { text: 'c', marked: false },
      { text: 'a', marked: true },
      { text: 't', marked: false },
    ]);
  });
});

describe('questionInputSchema', () => {
  const base = { prompt: 'She ___ to school.', stage: 'secondary' as const };

  it('trắc nghiệm: cần 2–6 lựa chọn khác nhau và một đáp án', () => {
    expect(
      questionInputSchema.safeParse({
        ...base,
        type: 'mcq',
        options: ['go', 'goes'],
        correct: 1,
      }).success,
    ).toBe(true);
    expect(
      questionInputSchema.safeParse({
        ...base,
        type: 'mcq',
        options: ['go', 'Go'],
        correct: 1,
      }).success,
    ).toBe(false);
    expect(
      questionInputSchema.safeParse({
        ...base,
        type: 'mcq',
        options: ['go', 'goes'],
        correct: 2,
      }).success,
    ).toBe(false);
  });

  it('câu gõ: bỏ lựa chọn, giữ đáp án chấp nhận', () => {
    const r = questionInputSchema.parse({
      ...base,
      type: 'verb_form',
      options: ['x'],
      correct: 0,
      accepted: ['goes', ''],
    });
    expect(r).toMatchObject({ options: [], correct: null, accepted: ['goes'] });
  });

  it('tìm lỗi sai: lựa chọn lấy từ các phần trong ngoặc', () => {
    const r = questionInputSchema.parse({
      type: 'error',
      prompt: 'She [go] to [school] every [day].',
      correct: 0,
    });
    expect(r.options).toEqual(['go', 'school', 'day']);
    expect(
      questionInputSchema.safeParse({
        type: 'error',
        prompt: 'No brackets here',
        correct: 0,
      }).success,
    ).toBe(false);
  });

  it('phát âm: mỗi lựa chọn có đúng một phần gạch chân', () => {
    const ok = {
      type: 'pronunciation',
      prompt: 'Chọn từ có phần gạch chân phát âm khác.',
      options: ['c[a]t', 'h[a]t', 'n[a]me', 'm[a]p'],
      correct: 2,
    };
    expect(questionInputSchema.safeParse(ok).success).toBe(true);
    expect(
      questionInputSchema.safeParse({ ...ok, options: ['cat', 'h[a]t'] })
        .success,
    ).toBe(false);
  });

  it('đúng/sai: lựa chọn cố định True/False', () => {
    const r = questionInputSchema.parse({
      type: 'true_false',
      prompt: 'Lan lives in Hanoi.',
      correct: 1,
    });
    expect(r.options).toEqual(['True', 'False']);
  });

  it('sắp xếp: đáp án phải dùng đúng và đủ các cụm từ', () => {
    const q = {
      type: 'reorder',
      prompt: 'Sắp xếp',
      options: ['to school', 'I', 'go'],
    };
    expect(
      questionInputSchema.safeParse({ ...q, accepted: ['I go to school.'] })
        .success,
    ).toBe(true);
    const bad = questionInputSchema.safeParse({
      ...q,
      accepted: ['I go to the school.'],
    });
    expect(bad.success).toBe(false);
  });

  it('mặc định: cấp 2, cấp độ 1', () => {
    const r = questionInputSchema.parse({
      type: 'fill',
      prompt: 'x',
      accepted: ['y'],
    });
    expect(r).toMatchObject({ stage: 'secondary', level: 1, passageId: null });
  });
});
