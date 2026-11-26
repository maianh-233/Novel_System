import { describe, expect, it } from 'vitest';
import {
  advance,
  attemptsFor,
  checkKey,
  isDone,
  runnerProfile,
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

describe('độ khó theo cấp học', () => {
  it('cấp 2 nhanh hơn tiểu học ở mọi cấp độ, trên cùng một từ', () => {
    for (const level of [1, 2, 3] as const) {
      for (const word of ['cat', 'elephant', 'take care of']) {
        expect(travelMs(word, level, 'secondary')).toBeLessThan(
          travelMs(word, level, 'primary'),
        );
      }
    }
  });

  it('cấp độ càng cao càng nhanh, ở cả hai cấp học', () => {
    for (const stage of ['primary', 'secondary'] as const) {
      expect(travelMs('school', 2, stage)).toBeLessThan(
        travelMs('school', 1, stage),
      );
      expect(travelMs('school', 3, stage)).toBeLessThan(
        travelMs('school', 2, stage),
      );
    }
  });

  it('cấp 2 không đọc to; tiểu học chỉ đọc to ở cấp độ 1', () => {
    for (const level of [1, 2, 3] as const) {
      expect(runnerProfile('secondary', level).readAloud).toBe(false);
      expect(runnerProfile('primary', level).readAloud).toBe(level === 1);
    }
  });

  it('mặc định là tiểu học như trước', () => {
    expect(travelMs('cat', 1)).toBe(3000 + 1300 * 3);
  });
});
