import type { ExamResults } from '@novel/shared';

const cell = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Bảng điểm ra CSV (có BOM để Excel mở đúng tiếng Việt). Điểm ghi dấu chấm để Excel tính được. */
export function examResultsCsv(
  r: ExamResults,
  formatTime: (iso: string) => string,
): string {
  const header = [
    'Lớp',
    'Học sinh',
    'Tên đăng nhập',
    'Điểm (thang 10)',
    `Số câu đúng (/${r.questionCount})`,
    'Số lần làm',
    'Nộp lúc',
    'Ghi chú',
  ];
  const lines = r.rows.map((row) =>
    [
      row.student.className,
      row.student.displayName,
      row.student.username,
      row.score,
      row.submittedAt ? row.correctCount : null,
      row.attemptCount,
      row.submittedAt ? formatTime(row.submittedAt) : null,
      !row.submittedAt
        ? 'Đang làm'
        : row.autoSubmitted
          ? 'Hết giờ, máy tự nộp'
          : '',
    ]
      .map(cell)
      .join(','),
  );
  return '﻿' + [header.map(cell).join(','), ...lines].join('\r\n');
}

export function downloadText(
  filename: string,
  text: string,
  type = 'text/csv',
) {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
