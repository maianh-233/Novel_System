import type { ExamResults } from '@novel/shared';
import { describe, expect, it } from 'vitest';
import { examResultsCsv } from './examCsv';

const row = (over: Partial<ExamResults['rows'][number]>) => ({
  attemptId: 'a',
  student: {
    id: 's',
    displayName: 'Lê "Bé" An',
    username: 'an1',
    className: '7A',
    classId: 'c',
  },
  attemptCount: 1,
  startedAt: '2026-12-01T08:00:00Z',
  submittedAt: '2026-12-01T08:30:00Z',
  autoSubmitted: false,
  score: 7.5,
  correctCount: 30,
  ...over,
});

describe('examResultsCsv', () => {
  it('có BOM, tiêu đề, thoát dấu nháy, ghi chú lượt tự nộp / đang làm', () => {
    const csv = examResultsCsv(
      {
        questionCount: 40,
        rows: [
          row({}),
          row({ autoSubmitted: true }),
          row({ submittedAt: null, score: null }),
        ],
      } as unknown as ExamResults,
      () => 'T',
    );
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(
      'Lớp,Học sinh,Tên đăng nhập,Điểm (thang 10),Số câu đúng (/40),Số lần làm,Nộp lúc,Ghi chú',
    );
    expect(lines[1]).toBe('7A,"Lê ""Bé"" An",an1,7.5,30,1,T,');
    expect(lines[2].endsWith(',Hết giờ, máy tự nộp')).toBe(false);
    expect(lines[2].endsWith(',"Hết giờ, máy tự nộp"')).toBe(true);
    expect(lines[3]).toBe('7A,"Lê ""Bé"" An",an1,,,1,,Đang làm');
  });
});
