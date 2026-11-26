import { describe, expect, it } from 'vitest';
import {
  advance,
  attemptsFor,
  checkKey,
  isDone,
  skipAuto,
  travelMs,
  typingTarget,
} from './logic';

/** Gõ cả chuỗi, trả về vị trí cuối và số phím sai. */
function typeAll(word: string, keys: string) {
  const target = typingTarget(word);
  let pos = skipAuto(target, 0);
  let wrong = 0;
  for (const k of keys) {
    const r = checkKey(target, pos, k);
    if (r === 'ok') pos = advance(target, pos);
    if (r === 'wrong') wrong++;
  }
  return { done: isDone(target, pos), pos, wrong };
}

describe('gõ từ', () => {
  it('gõ đúng hết thì xong, không phân biệt hoa thường', () => {
    expect(typeAll('Apple', 'apple')).toEqual({ done: true, pos: 5, wrong: 0 });
    expect(typeAll('cat', 'CAT').done).toBe(true);
  });

  it('phím sai không làm mất chữ đã gõ, được tính là sai', () => {
    expect(typeAll('cat', 'cxat')).toEqual({ done: true, pos: 3, wrong: 1 });
  });

  it('cụm từ phải gõ dấu cách; dấu cách thừa thì bỏ qua', () => {
    expect(typeAll('go  to school', 'gotoschool').done).toBe(false);
    expect(typeAll('go  to school', 'go to school').done).toBe(true);
    expect(typeAll('go to school', ' g o to school')).toMatchObject({
      done: true,
      wrong: 0,
    });
  });

  it('gạch nối, dấu nháy được tự điền', () => {
    expect(typeAll('T-shirt', 'tshirt').done).toBe(true);
    expect(typeAll("it's", 'its').done).toBe(true);
  });

  it('phím đặc biệt (Shift, Enter, dấu chấm) không tính là sai', () => {
    const target = typingTarget('cat');
    expect(checkKey(target, 0, 'Shift')).toBe('ignore');
    expect(checkKey(target, 0, '.')).toBe('ignore');
    expect(checkKey(target, 0, 'x')).toBe('wrong');
  });
});

describe('travelMs', () => {
  it('từ dài có thêm thời gian, cấp cao chạy nhanh hơn', () => {
    expect(travelMs('elephant', 1)).toBeGreaterThan(travelMs('cat', 1));
    expect(travelMs('cat', 1)).toBeGreaterThan(travelMs('cat', 2));
    expect(travelMs('cat', 2)).toBeGreaterThan(travelMs('cat', 3));
  });

  it('chỉ tính ký tự phải gõ', () => {
    expect(travelMs('T-shirt', 2)).toBe(travelMs('tshirt', 2));
  });
});

it('attemptsFor nằm trong 1–99', () => {
  expect(attemptsFor(0)).toBe(1);
  expect(attemptsFor(3)).toBe(4);
  expect(attemptsFor(500)).toBe(99);
});
