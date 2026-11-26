import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatScore,
  fromLocalInput,
  toLocalInput,
} from './datetime';

describe('datetime-local', () => {
  it('đổi qua lại giữ nguyên thời điểm (theo giờ máy)', () => {
    const iso = new Date(2026, 11, 1, 8, 5).toISOString();
    expect(toLocalInput(iso)).toBe('2026-12-01T08:05');
    expect(fromLocalInput('2026-12-01T08:05')).toBe(iso);
    expect(fromLocalInput('')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });
});

describe('formatCountdown', () => {
  it('mm:ss, có giờ thì h:mm:ss, không âm', () => {
    expect(formatCountdown(65_000)).toBe('01:05');
    expect(formatCountdown(3_600_000 + 5_000)).toBe('1:00:05');
    expect(formatCountdown(-5)).toBe('00:00');
    expect(formatCountdown(1)).toBe('00:01');
  });
});

describe('formatScore', () => {
  it('dấu phẩy thập phân', () => {
    expect(formatScore(7.5)).toBe('7,5');
    expect(formatScore(10)).toBe('10');
  });
});
