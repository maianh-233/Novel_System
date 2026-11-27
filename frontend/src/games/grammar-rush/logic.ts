/** Điểm mỗi câu đúng. */
export const BASE_POINTS = 10;

/** Thưởng chuỗi: từ câu đúng thứ 3 liên tiếp +5, từ câu thứ 5 +10. */
export function streakBonus(streak: number): number {
  if (streak >= 5) return 10;
  if (streak >= 3) return 5;
  return 0;
}

/** Sau một câu: chuỗi mới và điểm của câu đó (sai thì mất chuỗi, 0 điểm). */
export function rushStep(
  streak: number,
  correct: boolean,
): { streak: number; points: number } {
  if (!correct) return { streak: 0, points: 0 };
  const next = streak + 1;
  return { streak: next, points: BASE_POINTS + streakBonus(next) };
}
