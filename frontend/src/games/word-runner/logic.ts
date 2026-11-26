import type { Level, Stage } from '@novel/shared';

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

export interface RunnerProfile {
  /** Khoảng để đọc từ trước khi phải gõ (ms). */
  readMs: number;
  /** Thêm cho mỗi ký tự phải gõ (ms). */
  perCharMs: number;
  /** Đọc to từ khi nó xuất hiện. */
  readAloud: boolean;
}

/**
 * Bộ độ khó (docs/PLAN-CAP2.md mục 3). Cấp độ càng cao chướng ngại vật chạy càng nhanh.
 * Tiểu học: chậm, cấp 1 đọc to từ. Cấp 2: nhanh hơn ở mọi cấp độ, không đọc to.
 */
const PACE: Record<Stage, Record<Level, RunnerProfile>> = {
  primary: {
    1: { readMs: 3000, perCharMs: 1300, readAloud: true },
    2: { readMs: 2300, perCharMs: 950, readAloud: false },
    3: { readMs: 1700, perCharMs: 700, readAloud: false },
  },
  secondary: {
    1: { readMs: 1800, perCharMs: 650, readAloud: false },
    2: { readMs: 1400, perCharMs: 500, readAloud: false },
    3: { readMs: 1100, perCharMs: 380, readAloud: false },
  },
};

export const runnerProfile = (stage: Stage, level: Level): RunnerProfile =>
  PACE[stage][level];

/**
 * Thời gian (ms) để chướng ngại vật chạy từ mép phải tới chỗ bạn nhỏ: một khoảng
 * để đọc từ + thêm cho mỗi ký tự phải gõ.
 */
export function travelMs(word: string, level: Level, stage: Stage = 'primary') {
  const target = typingTarget(word);
  const chars = [...target].filter(mustType).length;
  const { readMs, perCharMs } = runnerProfile(stage, level);
  return readMs + perCharMs * chars;
}

/** Số lần thử ghi vào kết quả: 1 + số phím sai, trong giới hạn máy chủ nhận (1–99). */
export const attemptsFor = (wrongKeys: number) =>
  Math.min(99, Math.max(1, wrongKeys + 1));
