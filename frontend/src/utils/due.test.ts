import { describe, expect, it } from 'vitest';
import { formatDue, isDueSoon } from './due';

// Giờ máy: dựng ngày bằng new Date(năm, tháng, ngày, giờ) để test không phụ thuộc múi giờ.
const at = (day: number, h: number, m = 0) =>
  new Date(2026, 11, day, h, m).toISOString();
const monday = new Date(2026, 10, 30, 20, 0); // Thứ Hai 30/11/2026, 20:00

describe('formatDue', () => {
  it('hôm nay / ngày mai / hôm qua', () => {
    expect(formatDue(new Date(2026, 10, 30, 21, 5).toISOString(), monday)).toBe(
      'Hôm nay 21:05',
    );
    expect(formatDue(at(1, 7), monday)).toBe('Ngày mai 07:00');
    expect(formatDue(new Date(2026, 10, 29, 7).toISOString(), monday)).toBe(
      'Hôm qua 07:00',
    );
  });

  it('xa hơn thì ghi thứ và ngày', () => {
    expect(formatDue(at(3, 7), monday)).toBe('Thứ Năm 03/12 07:00');
    expect(formatDue(at(6, 18, 30), monday)).toBe('Chủ nhật 06/12 18:30');
  });
});

describe('isDueSoon', () => {
  it('chỉ đúng khi còn dưới 24 giờ', () => {
    expect(isDueSoon(at(1, 7), monday)).toBe(true);
    expect(isDueSoon(at(3, 7), monday)).toBe(false);
    expect(isDueSoon(new Date(2026, 10, 30, 19).toISOString(), monday)).toBe(
      false,
    );
  });
});
