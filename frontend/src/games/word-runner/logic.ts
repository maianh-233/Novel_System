import type { Level } from '@novel/shared';

/**
 * Chữ em phải gõ cho một từ: chữ thường, gộp dấu cách thừa. Dấu cách phải gõ
 * ("go to school"); các ký tự khác chữ/số/dấu cách (gạch nối, nháy…) máy tự điền.
 */
export const typingTarget = (word: string) =>
  word.trim().toLowerCase().replace(/\s+/g, ' ');

const mustType = (ch: string) => /[a-z0-9 ]/.test(ch);

/** Bỏ qua các ký tự máy tự điền, trả về vị trí ô em cần gõ tiếp theo. */
export function skipAuto(target: string, pos: number) {
  let i = pos;
  while (i < target.length && !mustType(target[i])) i++;
  return i;
}

export type KeyResult = 'ok' | 'wrong' | 'ignore';

/**
 * Chấm một ký tự em vừa gõ. Ký tự không phải chữ/số/dấu cách thì bỏ qua (không tính sai).
 * Dấu cách ở chỗ không cần cũng bỏ qua — em lỡ tay gõ thêm cách thì không bị trừ.
 */
export function checkKey(target: string, pos: number, key: string): KeyResult {
  if (key.length !== 1) return 'ignore';
  const ch = key.toLowerCase();
  if (!mustType(ch)) return 'ignore';
  if (target[pos] === ch) return 'ok';
  if (ch === ' ') return 'ignore';
  return 'wrong';
}

/** Gõ đúng một ký tự: vị trí mới sau khi tự điền các ký tự đặc biệt phía sau. */
export const advance = (target: string, pos: number) =>
  skipAuto(target, pos + 1);

export const isDone = (target: string, pos: number) => pos >= target.length;

/**
 * Thời gian (ms) để chướng ngại vật chạy từ mép phải tới chỗ bạn nhỏ: một khoảng
 * để đọc từ + thêm cho mỗi ký tự phải gõ. Cấp càng cao càng nhanh.
 */
const PACE: Record<Level, { readMs: number; perCharMs: number }> = {
  1: { readMs: 3000, perCharMs: 1300 },
  2: { readMs: 2300, perCharMs: 950 },
  3: { readMs: 1700, perCharMs: 700 },
};

export function travelMs(word: string, level: Level) {
  const target = typingTarget(word);
  const chars = [...target].filter(mustType).length;
  const { readMs, perCharMs } = PACE[level];
  return readMs + perCharMs * chars;
}

/** Số lần thử ghi vào kết quả: 1 + số phím sai, trong giới hạn máy chủ nhận (1–99). */
export const attemptsFor = (wrongKeys: number) =>
  Math.min(99, Math.max(1, wrongKeys + 1));
