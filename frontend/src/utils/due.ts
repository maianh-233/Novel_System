const WEEKDAY = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

const pad = (n: number) => String(n).padStart(2, '0');
const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Hạn nộp dễ đọc cho học sinh, theo giờ máy:
 * "Hôm nay 21:00", "Ngày mai 07:00", "Hôm qua 07:00", "Thứ Năm 03/12 07:00".
 */
export function formatDue(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const days = Math.round((dayStart(d) - dayStart(now)) / 86_400_000);
  if (days === 0) return `Hôm nay ${time}`;
  if (days === 1) return `Ngày mai ${time}`;
  if (days === -1) return `Hôm qua ${time}`;
  return `${WEEKDAY[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${time}`;
}

/** Còn dưới 24 giờ tới hạn (để tô màu nhắc). */
export const isDueSoon = (iso: string, now = new Date()) => {
  const left = new Date(iso).getTime() - now.getTime();
  return left > 0 && left < 86_400_000;
};
