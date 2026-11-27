import { bracketSegments } from '@novel/shared';

/** Tìm ra lỗi nhanh (dưới 8 giây) được thưởng thêm. */
export const QUICK_MS = 8_000;

export function huntPoints(correct: boolean, elapsedMs: number): number {
  if (!correct) return 0;
  return elapsedMs <= QUICK_MS ? 15 : 10;
}

/** Số phần có thể sai trong câu (các phần trong ngoặc vuông A, B, C, D). */
export const partCount = (prompt: string) => bracketSegments(prompt).length;
