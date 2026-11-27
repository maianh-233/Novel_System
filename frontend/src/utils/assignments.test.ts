import { describe, expect, it } from 'vitest';
import { audienceLabel, defaultDueAt, targetLabel } from './assignments';

describe('nhãn bài tập', () => {
  it('mô tả nội dung giao', () => {
    expect(
      targetLabel({
        target: {
          kind: 'lesson_game',
          lesson: { id: 'l', title: 'Unit 3' },
          game: { slug: 'word-builder', name: 'Word Builder' },
          minStars: 2,
        },
      }),
    ).toBe('Unit 3 · Word Builder · tối thiểu 2 sao');
    expect(
      targetLabel({
        target: { kind: 'exam', exam: { id: 'e', title: '15 phút' } },
      }),
    ).toBe('Đề: 15 phút');
  });

  it('mô tả đối tượng', () => {
    expect(audienceLabel({ forAll: true, classes: [] })).toBe(
      'Tất cả học sinh',
    );
    expect(
      audienceLabel({
        forAll: false,
        classes: [
          { id: 'a', name: '7A' },
          { id: 'b', name: '7B' },
        ],
      }),
    ).toBe('7A, 7B');
  });

  it('hạn mặc định: 7 giờ sáng ba ngày sau (tối thứ Hai → sáng thứ Năm)', () => {
    const due = new Date(defaultDueAt(new Date(2026, 10, 30, 20, 0)));
    expect([
      due.getDate(),
      due.getMonth(),
      due.getHours(),
      due.getDay(),
    ]).toEqual([3, 11, 7, 4]);
  });
});
