import { describe, expect, it } from 'vitest';
import { huntPoints, partCount, QUICK_MS } from './logic';

describe('Error Hunter', () => {
  it('tìm nhanh được thưởng; sai 0 điểm', () => {
    expect(huntPoints(true, 3000)).toBe(15);
    expect(huntPoints(true, QUICK_MS + 1)).toBe(10);
    expect(huntPoints(false, 1000)).toBe(0);
  });

  it('đếm các phần A–D trong câu', () => {
    expect(partCount('She [go] to [school] [every] [day].')).toBe(4);
  });
});
