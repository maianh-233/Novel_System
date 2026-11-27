import type { AssignmentSummary } from '@novel/shared';

/** "Unit 3 · Word Builder · ≥ 2 sao" hoặc "Đề: Kiểm tra 15 phút". */
export function targetLabel(a: Pick<AssignmentSummary, 'target'>): string {
  const t = a.target;
  return t.kind === 'exam'
    ? `Đề: ${t.exam.title}`
    : `${t.lesson.title} · ${t.game.name} · tối thiểu ${t.minStars} sao`;
}

export function audienceLabel(
  a: Pick<AssignmentSummary, 'forAll' | 'classes'>,
): string {
  if (a.forAll) return 'Tất cả học sinh';
  return a.classes.map((c) => c.name).join(', ') || '—';
}

/** Hạn mặc định: 7 giờ sáng ba ngày sau (giao tối thứ Hai → hạn sáng thứ Năm). */
export function defaultDueAt(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 3);
  d.setHours(7, 0, 0, 0);
  return d.toISOString();
}
