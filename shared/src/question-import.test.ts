import { describe, expect, it } from 'vitest';
import {
  parseQuestionText,
  questionTypeFromName,
  splitOptionLine,
  type ImportDefaults,
} from './question-import.js';

const DEFAULTS: ImportDefaults = {
  stage: 'secondary',
  level: 2,
  grammarTag: null,
};
const parse = (text: string) => parseQuestionText(text, DEFAULTS);

describe('splitOptionLine', () => {
  it('tách nhiều lựa chọn trên một dòng', () => {
    expect(splitOptionLine('A. go   B. goes\tC. going  D. gone', 0)).toEqual([
      'go',
      'goes',
      'going',
      'gone',
    ]);
    expect(splitOptionLine('A) on B) in', 0)).toEqual(['on', 'in']);
  });

  it('không cắt ở chữ viết tắt trong lựa chọn', () => {
    expect(splitOptionLine('A. at 7 a.m.   B. in the U.S.', 0)).toEqual([
      'at 7 a.m.',
      'in the U.S.',
    ]);
  });

  it('tiếp tục từ chữ cái đang chờ', () => {
    expect(splitOptionLine('C. going', 2)).toEqual(['going']);
    expect(splitOptionLine('A. going', 2)).toEqual([]);
  });
});

describe('questionTypeFromName', () => {
  it('nhận tên tiếng Việt có/không dấu, tiếng Anh và mã', () => {
    expect(questionTypeFromName('Chia động từ')).toBe('verb_form');
    expect(questionTypeFromName('CHIA DONG TU')).toBe('verb_form');
    expect(questionTypeFromName('Word form')).toBe('word_form');
    expect(questionTypeFromName('true_false')).toBe('true_false');
    expect(questionTypeFromName('Sắp xếp câu')).toBe('reorder');
    expect(questionTypeFromName('linh tinh')).toBeNull();
  });
});

describe('parseQuestionText', () => {
  it('đọc câu trắc nghiệm theo mẫu đề Word', () => {
    const r = parse(`1. She ___ to school every day.
A. go   B. goes   C. going   D. gone
Đáp án: B
Giải thích: Hiện tại đơn, chủ ngữ số ít → động từ thêm -s/-es.

Câu 2: They ___ football now.
A. play
B. are playing
C. plays
D. played
Answer: b
Chủ điểm: Present continuous`);
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toMatchObject({
      line: 1,
      number: 1,
      data: {
        type: 'mcq',
        prompt: 'She ___ to school every day.',
        options: ['go', 'goes', 'going', 'gone'],
        correct: 1,
        explanation: 'Hiện tại đơn, chủ ngữ số ít → động từ thêm -s/-es.',
        level: 2,
        stage: 'secondary',
      },
    });
    expect(r.questions[1].data).toMatchObject({
      options: ['play', 'are playing', 'plays', 'played'],
      correct: 1,
      grammarTag: 'Present continuous',
    });
  });

  it('đổi dạng câu bằng dòng "#", đọc đáp án gõ có nhiều cách', () => {
    const r = parse(`# Word form
1. He is very ___ (friend).
Đáp án: friendly
# Chia động từ
2. She ___ (go) to school yesterday.
Đáp án: went | did go
# Viết lại câu
3. I started learning English 3 years ago.
Gợi ý: I have ...
Đáp án: I have learned English for 3 years. | I have been learning English for 3 years.`);
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => q.data.type)).toEqual([
      'word_form',
      'verb_form',
      'rewrite',
    ]);
    expect(r.questions[1].data.accepted).toEqual(['went', 'did go']);
    expect(r.questions[2].data).toMatchObject({
      hint: 'I have ...',
      accepted: [
        'I have learned English for 3 years.',
        'I have been learning English for 3 years.',
      ],
    });
  });

  it('đọc tìm lỗi sai, phát âm, đúng/sai, sắp xếp', () => {
    const r = parse(`# Tìm lỗi sai
1. She [go] to [school] [every] [day].
Đáp án: A
# Phát âm
2. Chọn từ có phần gạch chân phát âm khác.
A. c[a]t  B. h[a]t  C. n[a]me  D. m[a]p
Đáp án: C
# Đúng sai
3. Lan lives in Hanoi.
Đáp án: Sai
# Sắp xếp câu
4. to school / I / go / every day
Đáp án: I go to school every day.`);
    expect(r.errors).toEqual([]);
    const [err, pron, tf, re] = r.questions.map((q) => q.data);
    expect(err).toMatchObject({
      options: ['go', 'school', 'every', 'day'],
      correct: 0,
    });
    expect(pron.correct).toBe(2);
    expect(tf).toMatchObject({ options: ['True', 'False'], correct: 1 });
    expect(re).toMatchObject({
      options: ['to school', 'I', 'go', 'every day'],
      accepted: ['I go to school every day.'],
    });
  });

  it('đoạn văn: các câu sau đoạn văn trỏ về đoạn đó, tới "# Hết đoạn văn"', () => {
    const r = parse(`# Đoạn văn: My school
My school is big. It has (1) ___ classrooms.

We (2) ___ English on Monday.
1. A. many  B. much  C. a lot  D. lots
Đáp án: A
# Điền từ
2.
Đáp án: learn | study
# Hết đoạn văn
3. Another one ___ .
A. x  B. y
Đáp án: A`);
    expect(r.errors).toEqual([]);
    expect(r.passages).toEqual([
      {
        key: 0,
        line: 1,
        title: 'My school',
        text: 'My school is big. It has (1) ___ classrooms.\n\nWe (2) ___ English on Monday.',
      },
    ]);
    expect(r.questions.map((q) => q.passageKey)).toEqual([0, 0, null]);
    expect(r.questions[0].data).toMatchObject({
      prompt: '(1)',
      options: ['many', 'much', 'a lot', 'lots'],
    });
  });

  it('báo lỗi theo số dòng, không bỏ qua câu nào', () => {
    const r = parse(`1. She ___ to school.
A. go  B. goes
Đáp án: E
2. Missing answer
A. a  B. b
3. Fine
A. a  B. b
Đáp án: A
lạc dòng
# Linh tinh`);
    expect(r.errors).toEqual([
      { line: 1, message: 'Câu 1: Đáp án E nhưng câu chỉ có 2 lựa chọn' },
      { line: 4, message: 'Câu 2: Thiếu dòng "Đáp án:"' },
      expect.objectContaining({ line: 9 }),
      expect.objectContaining({ line: 10 }),
    ]);
    expect(r.questions).toHaveLength(1);
  });

  it('văn bản trống hoặc chữ nằm ngoài câu hỏi thì báo lỗi', () => {
    expect(parse('').errors).toEqual([
      { line: 1, message: 'Chưa có câu hỏi nào' },
    ]);
    expect(parse('Hello').errors[0].line).toBe(1);
  });

  it('cấp độ / cấp học trên từng câu ghi đè mặc định', () => {
    const r = parse(`1. x ___
A. a  B. b
Đáp án: A
Cấp độ: 3`);
    expect(r.questions[0].data.level).toBe(3);
  });
});
