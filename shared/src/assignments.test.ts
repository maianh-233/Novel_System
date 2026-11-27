import { describe, expect, it } from 'vitest';
import {
  assignmentCreateSchema,
  assignmentMergedSchema,
  assignmentProgress,
  sortForStudent,
  sortProgressRows,
  type AssignmentProgressRow,
  type Completion,
} from './assignments.js';

const d = (s: string) => new Date(`2026-12-${s}+07:00`);

// Giao tối thứ Hai 30/11, hạn sáng thứ Năm 03/12 (theo ví dụ trong PLAN-CAP2).
const window = {
  assignedAt: new Date('2026-11-30T20:00:00+07:00'),
  dueAt: d('03T07:00:00'),
};
const stars = (min: number) => (c: Completion) => c.value >= min;

describe('assignmentProgress', () => {
  it('chưa làm: còn hạn là "todo", qua hạn là "overdue"', () => {
    expect(assignmentProgress([], window, stars(2), d('02T12:00:00'))).toEqual({
      status: 'todo',
      doneAt: null,
      best: null,
      tries: 0,
    });
    expect(
      assignmentProgress([], window, stars(2), d('03T07:00:01')).status,
    ).toBe('overdue');
  });

  it('đủ sao trước hạn là "done", ghi lần đầu đạt', () => {
    const p = assignmentProgress(
      [
        { at: d('01T19:00:00'), value: 1 },
        { at: d('01T19:10:00'), value: 2 },
        { at: d('02T19:00:00'), value: 3 },
      ],
      window,
      stars(2),
      d('03T08:00:00'),
    );
    expect(p).toEqual({
      status: 'done',
      doneAt: d('01T19:10:00'),
      best: 3,
      tries: 3,
    });
  });

  it('làm đúng lúc hạn vẫn tính đúng hạn; sau hạn là "late"', () => {
    expect(
      assignmentProgress(
        [{ at: window.dueAt, value: 2 }],
        window,
        stars(2),
        d('04T00:00:00'),
      ).status,
    ).toBe('done');
    expect(
      assignmentProgress(
        [
          { at: d('02T19:00:00'), value: 1 },
          { at: d('03T20:00:00'), value: 3 },
        ],
        window,
        stars(2),
        d('04T00:00:00'),
      ),
    ).toMatchObject({ status: 'late', best: 3, tries: 2 });
  });

  it('chưa đủ sao thì chưa xong, nhưng vẫn ghi sao cao nhất', () => {
    expect(
      assignmentProgress(
        [{ at: d('01T19:00:00'), value: 1 }],
        window,
        stars(2),
        d('02T00:00:00'),
      ),
    ).toMatchObject({ status: 'todo', best: 1, tries: 1 });
  });

  it('lượt chơi trước lúc giao bài không tính', () => {
    expect(
      assignmentProgress(
        [{ at: new Date('2026-11-29T10:00:00+07:00'), value: 3 }],
        window,
        stars(1),
        d('01T00:00:00'),
      ),
    ).toEqual({ status: 'todo', doneAt: null, best: null, tries: 0 });
  });

  it('thứ tự lần làm không ảnh hưởng kết quả', () => {
    const p = assignmentProgress(
      [
        { at: d('02T10:00:00'), value: 6 },
        { at: d('01T10:00:00'), value: 8.5 },
      ],
      window,
      () => true,
      d('02T11:00:00'),
    );
    expect(p).toMatchObject({ doneAt: d('01T10:00:00'), best: 8.5 });
  });
});

describe('assignmentCreateSchema', () => {
  const base = {
    title: 'Unit 3 – Word Builder',
    dueAt: '2026-12-03T07:00:00+07:00',
    classIds: ['c1'],
  };

  it('bài game cần Unit + game, bỏ đề', () => {
    const ok = assignmentCreateSchema.parse({
      ...base,
      kind: 'lesson_game',
      lessonId: 'l1',
      gameSlug: 'word-builder',
      examId: 'e1',
      minStars: '2',
    });
    expect(ok).toMatchObject({ examId: null, minStars: 2, forAll: false });

    const bad = assignmentCreateSchema.safeParse({
      ...base,
      kind: 'lesson_game',
    });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => i.path[0])).toEqual([
      'lessonId',
      'gameSlug',
    ]);
  });

  it('bài đề cần đề, bỏ Unit / game', () => {
    expect(
      assignmentCreateSchema.parse({
        ...base,
        kind: 'exam',
        examId: 'e1',
        lessonId: 'l1',
        gameSlug: 'word-quiz',
      }),
    ).toMatchObject({ lessonId: null, gameSlug: null, examId: 'e1' });
    expect(
      assignmentCreateSchema.safeParse({ ...base, kind: 'exam' }).success,
    ).toBe(false);
  });

  it('cần chọn lớp, trừ khi giao cho tất cả', () => {
    const exam = { ...base, kind: 'exam', examId: 'e1' } as const;
    expect(
      assignmentCreateSchema.safeParse({ ...exam, classIds: [] }).success,
    ).toBe(false);
    expect(
      assignmentCreateSchema.safeParse({ ...exam, classIds: [], forAll: true })
        .success,
    ).toBe(true);
    expect(
      assignmentCreateSchema.safeParse({ ...exam, classIds: ['a', 'a'] })
        .success,
    ).toBe(false);
  });

  it('hạn nộp phải là ngày giờ', () => {
    expect(
      assignmentCreateSchema.safeParse({
        ...base,
        kind: 'exam',
        examId: 'e1',
        dueAt: 'thứ Năm',
      }).success,
    ).toBe(false);
  });

  it('bản sửa ghép với bài cũ được kiểm tra lại cả bài', () => {
    const current = {
      ...base,
      note: null,
      kind: 'exam' as const,
      lessonId: null,
      gameSlug: null,
      examId: 'e1',
      minStars: 1,
      forAll: false,
    };
    // Đổi sang bài game mà không chọn Unit → lỗi
    expect(
      assignmentMergedSchema.safeParse({ ...current, kind: 'lesson_game' })
        .success,
    ).toBe(false);
    expect(
      assignmentMergedSchema.parse({
        ...current,
        kind: 'lesson_game',
        lessonId: 'l1',
        gameSlug: 'word-quiz',
      }),
    ).toMatchObject({ examId: null });
  });
});

describe('sắp xếp', () => {
  it('trang chủ của em: quá hạn, rồi việc cần làm theo hạn gần nhất, việc xong để cuối', () => {
    const items = [
      { id: 'done-old', status: 'done', dueAt: '2026-12-01T00:00:00Z' },
      { id: 'todo-late', status: 'todo', dueAt: '2026-12-09T00:00:00Z' },
      { id: 'late', status: 'late', dueAt: '2026-12-02T00:00:00Z' },
      { id: 'todo-soon', status: 'todo', dueAt: '2026-12-05T00:00:00Z' },
      { id: 'overdue', status: 'overdue', dueAt: '2026-12-02T00:00:00Z' },
    ] as const;
    expect(sortForStudent(items).map((i) => i.id)).toEqual([
      'overdue',
      'todo-soon',
      'todo-late',
      'late',
      'done-old',
    ]);
  });

  it('bảng của giáo viên: em chưa làm lên đầu, rồi theo lớp và tên', () => {
    const row = (
      name: string,
      className: string | null,
      status: AssignmentProgressRow['status'],
    ): AssignmentProgressRow => ({
      student: {
        id: name,
        displayName: name,
        username: name,
        classId: className,
        className,
      },
      status,
      doneAt: null,
      best: null,
      tries: 0,
    });
    const rows = [
      row('An', '7A', 'done'),
      row('Bình', '7B', 'overdue'),
      row('Chi', '7A', 'late'),
      row('Ánh', '7A', 'todo'),
    ];
    expect(sortProgressRows(rows).map((r) => r.student.displayName)).toEqual([
      'Ánh',
      'Bình',
      'Chi',
      'An',
    ]);
  });
});
