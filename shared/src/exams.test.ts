import { describe, expect, it } from 'vitest';
import {
  attemptDeadline,
  buildAttemptOrder,
  detailsVisible,
  displayedCorrect,
  displayedOptions,
  examCreateSchema,
  examState,
  examStructureSchema,
  isPastGrace,
  scoreOutOf10,
  shufflesOptions,
  toOriginalResponse,
} from './exams.js';
import { gradeQuestion, type GradableQuestion } from './questions.js';

const at = (s: string) => new Date(`2026-12-01T${s}:00Z`);

describe('examState / attemptDeadline / isPastGrace', () => {
  const e = { opensAt: at('08:00'), closesAt: at('09:00') };

  it('trước giờ mở, trong giờ, sau giờ đóng', () => {
    expect(examState(e, at('07:59'))).toBe('upcoming');
    expect(examState(e, at('08:00'))).toBe('open');
    expect(examState(e, at('09:00'))).toBe('closed');
    expect(examState({ opensAt: null, closesAt: null }, at('23:00'))).toBe(
      'open',
    );
  });

  it('hạn nộp = hết giờ làm hoặc giờ đóng đề, cái nào sớm hơn', () => {
    expect(attemptDeadline(at('08:00'), 40, e.closesAt)).toEqual(at('08:40'));
    expect(attemptDeadline(at('08:30'), 40, e.closesAt)).toEqual(at('09:00'));
    expect(attemptDeadline(at('08:30'), 40, null)).toEqual(at('09:10'));
  });

  it('cho thêm 30 giây sau hạn nộp', () => {
    const deadline = at('08:40');
    expect(isPastGrace(deadline, new Date(deadline.getTime() + 30_000))).toBe(
      false,
    );
    expect(isPastGrace(deadline, new Date(deadline.getTime() + 30_001))).toBe(
      true,
    );
  });
});

describe('scoreOutOf10', () => {
  it('quy về thang 10, làm tròn 2 chữ số', () => {
    expect(scoreOutOf10(30, 40)).toBe(7.5);
    expect(scoreOutOf10(1, 3)).toBe(3.33);
    expect(scoreOutOf10(0, 0)).toBe(0);
  });
});

describe('detailsVisible', () => {
  it('luyện tập: xem ngay; thi: chỉ sau giờ đóng (không có giờ đóng thì không)', () => {
    expect(
      detailsVisible(
        { showResult: 'after_submit', closesAt: null },
        at('08:00'),
      ),
    ).toBe(true);
    const exam = { showResult: 'after_close' as const, closesAt: at('09:00') };
    expect(detailsVisible(exam, at('08:59'))).toBe(false);
    expect(detailsVisible(exam, at('09:00'))).toBe(true);
    expect(
      detailsVisible(
        { showResult: 'after_close', closesAt: null },
        at('23:00'),
      ),
    ).toBe(false);
  });
});

describe('trộn câu và lựa chọn', () => {
  const sections = [
    {
      id: 's1',
      items: [
        { id: 'mcq', type: 'mcq' as const, optionCount: 4 },
        { id: 'tf', type: 'true_false' as const, optionCount: 2 },
        { id: 'err', type: 'error' as const, optionCount: 4 },
        { id: 'fill', type: 'fill' as const, optionCount: 0 },
        { id: 're', type: 'reorder' as const, optionCount: 3 },
      ],
    },
    { id: 's2', items: [{ id: 'x', type: 'stress' as const, optionCount: 4 }] },
  ];

  it('giữ nguyên thứ tự phần; câu và lựa chọn trộn khi bật trộn', () => {
    const order = buildAttemptOrder(sections, true);
    expect(order.sections.map((s) => s.sectionId)).toEqual(['s1', 's2']);
    const s1 = order.sections[0].items;
    expect(s1.map((i) => i.itemId).sort()).toEqual(
      ['err', 'fill', 're', 'mcq', 'tf'].sort(),
    );
    const byId = Object.fromEntries(s1.map((i) => [i.itemId, i.options]));
    expect([...byId.mcq!].sort()).toEqual([0, 1, 2, 3]);
    expect(byId.tf).toBeNull();
    expect(byId.err).toBeNull();
    expect(byId.fill).toBeNull();
    expect(byId.re).not.toEqual([0, 1, 2]);
  });

  it('không bật trộn: giữ thứ tự câu và lựa chọn, nhưng vẫn trộn cụm từ câu sắp xếp', () => {
    const order = buildAttemptOrder(sections, false, () => 0);
    expect(order.sections[0].items.map((i) => i.itemId)).toEqual([
      'mcq',
      'tf',
      'err',
      'fill',
      're',
    ]);
    expect(order.sections[0].items[0].options).toBeNull();
    const re = order.sections[0].items[4].options!;
    expect([...re].sort()).toEqual([0, 1, 2]);
    expect(re).not.toEqual([0, 1, 2]);
    expect(shufflesOptions('reorder', false)).toBe(true);
  });

  it('chọn đáp án theo thứ tự em thấy vẫn chấm đúng', () => {
    const q: GradableQuestion = {
      type: 'mcq',
      options: ['go', 'goes', 'going', 'gone'],
      correct: 1,
      accepted: [],
    };
    for (let k = 0; k < 20; k++) {
      const order = buildAttemptOrder(
        [{ id: 's', items: [{ id: 'q', type: 'mcq', optionCount: 4 }] }],
        true,
      ).sections[0].items[0].options;
      const shown = displayedOptions(q.options, order);
      const picked = shown.indexOf('goes');
      expect(displayedCorrect(q, order)).toBe(picked);
      expect(gradeQuestion(q, toOriginalResponse('mcq', picked, order))).toBe(
        true,
      );
      expect(
        gradeQuestion(
          q,
          toOriginalResponse('mcq', shown.indexOf('gone'), order),
        ),
      ).toBe(false);
    }
  });

  it('xếp cụm từ theo thứ tự em thấy vẫn chấm đúng', () => {
    const q: GradableQuestion = {
      type: 'reorder',
      options: ['to school', 'I', 'go'],
      correct: null,
      accepted: ['I go to school'],
    };
    const order = [2, 0, 1]; // em thấy: go, to school, I
    const shown = displayedOptions(q.options, order);
    const response = ['I', 'go', 'to school'].map((f) => shown.indexOf(f));
    expect(
      gradeQuestion(q, toOriginalResponse('reorder', response, order)),
    ).toBe(true);
  });

  it('câu gõ không đổi; câu trả lời ngoài phạm vi thì chấm sai', () => {
    expect(toOriginalResponse('fill', 'abc', [1, 0])).toBe('abc');
    expect(toOriginalResponse('mcq', 9, [1, 0])).toBe(-1);
  });
});

describe('schema đề', () => {
  it('mặc định: đề thi 40 phút, 1 lần làm, trộn, xem đáp án sau giờ đóng', () => {
    expect(examCreateSchema.parse({ title: 'Đề 1' })).toMatchObject({
      mode: 'exam',
      durationMin: 40,
      maxAttempts: 1,
      shuffle: true,
      showResult: 'after_close',
      isPublished: false,
    });
    expect(
      examCreateSchema.parse({ title: 'Luyện', mode: 'practice' }).showResult,
    ).toBe('after_submit');
  });

  it('giờ đóng phải sau giờ mở', () => {
    expect(
      examCreateSchema.safeParse({
        title: 'x',
        opensAt: '2026-12-01T09:00:00Z',
        closesAt: '2026-12-01T08:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('một câu hỏi không nằm hai chỗ trong đề', () => {
    const r = examStructureSchema.safeParse({
      sections: [
        { title: 'A', items: [{ questionId: 'q1', points: 1 }] },
        { title: 'B', items: [{ questionId: 'q1', points: 1 }] },
      ],
    });
    expect(r.success).toBe(false);
  });
});
