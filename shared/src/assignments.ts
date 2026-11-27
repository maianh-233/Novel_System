/**
 * Bài tập về nhà (C3 — docs/PLAN-CAP2.md).
 * Không lưu tiến độ riêng: em đã làm hay chưa được tính từ lượt chơi (`PlaySession`)
 * và bài thi (`ExamAttempt`) có sẵn.
 */
import { z } from 'zod';
import type { Stage } from './classes.js';
import type { ExamState } from './exams.js';

export const ASSIGNMENT_KINDS = ['lesson_game', 'exam'] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export const ASSIGNMENT_KIND_LABEL: Record<AssignmentKind, string> = {
  lesson_game: 'Chơi game theo Unit',
  exam: 'Làm đề',
};

const id = z.string().min(1).max(40);
const isoDate = z.string().datetime({
  offset: true,
  message: 'Ngày giờ không hợp lệ',
});

const assignmentFields = z.object({
  title: z.string().trim().min(1, 'Nhập tên bài tập').max(120),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .nullish()
    .transform((v) => v ?? null),
  kind: z.enum(ASSIGNMENT_KINDS),
  lessonId: id.nullable(),
  gameSlug: z.string().trim().min(1).max(40).nullable(),
  examId: id.nullable(),
  /** Bài game: đạt ít nhất bấy nhiêu sao trong một lượt thì tính là xong. */
  minStars: z.coerce.number().int().min(1).max(3),
  /** true = giao cho mọi học sinh (đúng cấp học của nội dung); bỏ qua `classIds`. */
  forAll: z.boolean(),
  classIds: z
    .array(id)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, 'Có lớp bị trùng'),
  dueAt: isoDate,
});

type Fields = z.infer<typeof assignmentFields>;

/** Kiểm tra các trường phụ thuộc nhau (bài game cần Unit + game; bài đề cần đề; cần đối tượng). */
function checkShape(v: Partial<Fields>, ctx: z.RefinementCtx) {
  if (v.kind === 'lesson_game') {
    if (!v.lessonId)
      ctx.addIssue({
        code: 'custom',
        path: ['lessonId'],
        message: 'Chọn Unit',
      });
    if (!v.gameSlug)
      ctx.addIssue({
        code: 'custom',
        path: ['gameSlug'],
        message: 'Chọn trò chơi',
      });
  }
  if (v.kind === 'exam' && !v.examId)
    ctx.addIssue({ code: 'custom', path: ['examId'], message: 'Chọn đề' });
  if (v.forAll === false && v.classIds?.length === 0)
    ctx.addIssue({
      code: 'custom',
      path: ['classIds'],
      message: 'Chọn ít nhất một lớp, hoặc giao cho tất cả',
    });
}

/** Bỏ các trường không thuộc loại bài (vd: bài đề thì không có Unit / game). */
function normalize<T extends Partial<Fields>>(v: T): T {
  if (v.kind === 'lesson_game') return { ...v, examId: null };
  if (v.kind === 'exam') return { ...v, lessonId: null, gameSlug: null };
  return v;
}

export const assignmentCreateSchema = assignmentFields
  .extend({
    lessonId: id.nullable().default(null),
    gameSlug: assignmentFields.shape.gameSlug.default(null),
    examId: id.nullable().default(null),
    minStars: assignmentFields.shape.minStars.default(1),
    forAll: z.boolean().default(false),
    classIds: assignmentFields.shape.classIds.default([]),
  })
  .superRefine(checkShape)
  .transform(normalize);
export type AssignmentCreate = z.input<typeof assignmentCreateSchema>;

/**
 * Sửa bài tập. Gửi `kind` thì phải gửi kèm Unit + game hoặc đề tương ứng (máy chủ
 * ghép với giá trị cũ rồi kiểm tra lại cả bài).
 */
export const assignmentUpdateSchema = assignmentFields.partial();
export type AssignmentUpdate = z.input<typeof assignmentUpdateSchema>;

/** Ghép bản sửa vào bài hiện có rồi kiểm tra lại như lúc tạo. */
export const assignmentMergedSchema = assignmentFields
  .superRefine(checkShape)
  .transform(normalize);

// ───────────── Tiến độ ─────────────

/**
 * - `todo`: chưa xong, còn hạn
 * - `done`: xong trước hạn
 * - `late`: xong sau hạn
 * - `overdue`: quá hạn mà chưa xong
 */
export type AssignmentStatus = 'todo' | 'done' | 'late' | 'overdue';

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  todo: 'Chưa làm',
  done: 'Đã xong',
  late: 'Nộp muộn',
  overdue: 'Quá hạn',
};

/** Một lần em làm: một lượt chơi đã kết thúc hoặc một bài thi đã nộp. */
export interface Completion {
  at: Date;
  /** Số sao (bài game) hoặc điểm thang 10 (bài đề). */
  value: number;
}

export interface Progress {
  status: AssignmentStatus;
  /** Lần đầu đạt yêu cầu. */
  doneAt: Date | null;
  /** Sao / điểm cao nhất trong mọi lần làm (kể cả lần chưa đạt). */
  best: number | null;
  /** Số lần làm tính vào bài tập. */
  tries: number;
}

/**
 * Tiến độ của một em. Chỉ tính những lần làm từ lúc giao bài (bài game: lượt chơi cũ của
 * cùng Unit không tính). `passes` = lần làm nào đạt yêu cầu (bài game: đủ sao; đề: đã nộp).
 */
export function assignmentProgress(
  completions: readonly Completion[],
  a: { assignedAt: Date; dueAt: Date },
  passes: (c: Completion) => boolean,
  now: Date,
): Progress {
  const counted = completions.filter((c) => c.at >= a.assignedAt);
  let best: number | null = null;
  let doneAt: Date | null = null;
  for (const c of counted) {
    if (best === null || c.value > best) best = c.value;
    if (passes(c) && (doneAt === null || c.at < doneAt)) doneAt = c.at;
  }
  const status: AssignmentStatus = doneAt
    ? doneAt <= a.dueAt
      ? 'done'
      : 'late'
    : now > a.dueAt
      ? 'overdue'
      : 'todo';
  return { status, doneAt, best, tries: counted.length };
}

/** Thứ tự trên trang chủ của em: việc cần làm (quá hạn trước, rồi theo hạn), xong để cuối. */
export function sortForStudent<
  T extends { status: AssignmentStatus; dueAt: string },
>(items: readonly T[]): T[] {
  const rank: Record<AssignmentStatus, number> = {
    overdue: 0,
    todo: 1,
    late: 2,
    done: 2,
  };
  return [...items].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      // Việc chưa làm: hạn gần trước. Việc đã xong: hạn mới nhất trước.
      (rank[a.status] < 2 ? 1 : -1) * a.dueAt.localeCompare(b.dueAt),
  );
}

/** Bài tập hạn đã qua quá lâu thì không hiện cho em nữa. */
export const STUDENT_HISTORY_DAYS = 14;

// ───────────── Giáo viên ─────────────

/** Nội dung được giao, như giáo viên thấy. */
export type AssignmentTarget =
  | {
      kind: 'lesson_game';
      lesson: { id: string; title: string };
      game: { slug: string; name: string };
      minStars: number;
    }
  | {
      kind: 'exam';
      exam: { id: string; title: string };
    };

export interface AssignmentSummary {
  id: string;
  title: string;
  note: string | null;
  target: AssignmentTarget;
  forAll: boolean;
  classes: Array<{ id: string; name: string }>;
  assignedAt: string;
  dueAt: string;
  /** Số em được giao (tài khoản đang hoạt động) và số em đã xong (kể cả nộp muộn). */
  studentCount: number;
  doneCount: number;
}

export interface AssignmentProgressRow {
  student: {
    id: string;
    displayName: string;
    username: string;
    classId: string | null;
    className: string | null;
  };
  status: AssignmentStatus;
  doneAt: string | null;
  best: number | null;
  tries: number;
}

export interface AssignmentDetail extends AssignmentSummary {
  rows: AssignmentProgressRow[];
}

/** Thứ tự bảng tiến độ của giáo viên: em chưa làm lên đầu, rồi theo lớp và tên. */
export function sortProgressRows<T extends AssignmentProgressRow>(
  rows: readonly T[],
): T[] {
  const rank: Record<AssignmentStatus, number> = {
    overdue: 0,
    todo: 0,
    late: 1,
    done: 2,
  };
  return [...rows].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.student.className ?? '').localeCompare(
        b.student.className ?? '',
        'vi',
      ) ||
      a.student.displayName.localeCompare(b.student.displayName, 'vi'),
  );
}

/** Lựa chọn khi giao bài game: Unit đã công khai và các game đã gán cho Unit đó. */
export interface AssignableLesson {
  id: string;
  title: string;
  stage: Stage | null;
  grade: number | null;
  games: Array<{ slug: string; name: string }>;
}

// ───────────── Học sinh ─────────────

export interface PlayAssignment {
  id: string;
  title: string;
  note: string | null;
  dueAt: string;
  status: AssignmentStatus;
  doneAt: string | null;
  best: number | null;
  /**
   * Cách mở bài: bài game → trang chơi đúng Unit; bài đề → bắt đầu / làm tiếp đề.
   * `null` = hiện chưa làm được (vd: đề chưa tới giờ mở), lý do ở `unavailable`.
   */
  open:
    | { kind: 'lesson_game'; gameSlug: string; lessonId: string }
    | { kind: 'exam'; examId: string }
    | null;
  unavailable: string | null;
  target: AssignmentTarget;
  /** Bài đề: trạng thái đề. */
  examState: ExamState | null;
  /** Bài đề: lượt nộp gần nhất, để xem lại điểm. */
  attemptId: string | null;
}

export type AssignmentErrorCode =
  | 'invalid_assignment'
  | 'unknown_lesson'
  | 'lesson_unpublished'
  | 'unknown_game'
  | 'game_not_in_lesson'
  | 'unknown_exam'
  | 'exam_unpublished'
  | 'unknown_class'
  | 'audience_mismatch';
