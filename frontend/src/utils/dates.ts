const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "26/11/2026 14:05" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** 75000 → "1 phút 15 giây" */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m} phút ${s} giây` : `${s} giây`;
}
