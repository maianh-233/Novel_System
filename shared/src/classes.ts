/**
 * Lớp học và cấp học (C0 — docs/PLAN-CAP2.md).
 * Mỗi lớp thuộc một khối (1–9); khối quyết định cấp học. Em chưa xếp lớp thì coi là tiểu học.
 */
import { z } from 'zod';

export const STAGES = ['primary', 'secondary'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  primary: 'Tiểu học',
  secondary: 'Cấp 2',
};

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
/** Khối cao nhất của tiểu học; từ khối 6 là cấp 2. */
export const PRIMARY_MAX_GRADE = 5;

export const stageOfGrade = (grade: number): Stage =>
  grade <= PRIMARY_MAX_GRADE ? 'primary' : 'secondary';

/** Người đang chơi, như game và trang chọn bài cần biết. */
export interface Learner {
  stage: Stage;
  /** null = chưa xếp lớp. */
  grade: number | null;
}

export const UNASSIGNED_LEARNER: Learner = { stage: 'primary', grade: null };

export const learnerOf = (classGroup: { grade: number } | null): Learner =>
  classGroup
    ? { stage: stageOfGrade(classGroup.grade), grade: classGroup.grade }
    : UNASSIGNED_LEARNER;

/**
 * Bài học có hiện cho em không. `stage` null = bài dùng cho cả hai cấp học;
 * `grade` null = mọi khối của cấp học đó. Em chưa xếp lớp thấy mọi bài tiểu học.
 */
export function isLessonForLearner(
  lesson: { stage: Stage | null; grade: number | null },
  learner: Learner,
): boolean {
  if (lesson.stage !== null && lesson.stage !== learner.stage) return false;
  return (
    lesson.grade === null ||
    learner.grade === null ||
    lesson.grade === learner.grade
  );
}

/** null = hợp lệ; ngược lại là lý do khối không khớp cấp học của bài. */
export function lessonAudienceError(
  stage: Stage | null,
  grade: number | null,
): string | null {
  if (grade === null) return null;
  if (stage === null) return 'Bài dùng cho cả hai cấp học thì không chọn khối';
  if (stageOfGrade(grade) !== stage)
    return `Khối ${grade} không thuộc ${STAGE_LABEL[stage].toLowerCase()}`;
  return null;
}

// ───────────── Quản trị lớp ─────────────

const id = z.string().min(1).max(40);

export const gradeSchema = z.coerce.number().int().min(1).max(9);

const classFields = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nhập tên lớp')
    .max(20, 'Tên lớp tối đa 20 ký tự'),
  grade: gradeSchema,
});

export const classCreateSchema = classFields;
export type ClassCreate = z.input<typeof classCreateSchema>;

export const classUpdateSchema = classFields.partial().extend({
  isArchived: z.boolean().optional(),
});
export type ClassUpdate = z.input<typeof classUpdateSchema>;

export interface ClassGroupAdmin {
  id: string;
  name: string;
  grade: number;
  stage: Stage;
  isArchived: boolean;
  studentCount: number;
}

/** Lớp gọn, gắn kèm thông tin học sinh. */
export interface ClassGroupRef {
  id: string;
  name: string;
  grade: number;
  stage: Stage;
  isArchived: boolean;
}

/** Xếp nhiều em vào một lớp; `classId` null = bỏ khỏi lớp. */
export const assignClassSchema = z.object({
  studentIds: z
    .array(id)
    .min(1, 'Chọn ít nhất một học sinh')
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'Có học sinh bị trùng'),
  classId: id.nullable(),
});
export type AssignClassRequest = z.infer<typeof assignClassSchema>;

export type ClassErrorCode =
  'class_name_taken' | 'class_not_empty' | 'class_archived' | 'unknown_class';
