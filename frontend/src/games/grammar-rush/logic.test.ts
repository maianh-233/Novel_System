import { describe, expect, it } from 'vitest';
import { rushStep, streakBonus } from './logic';

describe('Grammar Rush', () => {
  it('thưởng chuỗi đúng liên tiếp', () => {
    expect([1, 2, 3, 4, 5, 9].map(streakBonus)).toEqual([0, 0, 5, 5, 10, 10]);
  });

  it('sai thì mất chuỗi và không có điểm', () => {
    let streak = 0;
    const points: number[] = [];
    for (const ok of [true, true, true, false, true]) {
      const s = rushStep(streak, ok);
      streak = s.streak;
      points.push(s.points);
    }
    expect(points).toEqual([10, 10, 15, 0, 10]);
    expect(streak).toBe(1);
  });
});
