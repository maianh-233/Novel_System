/**
 * Luyện đề và thi (C2 — docs/PLAN-CAP2.md).
 * Máy chủ chấm; đáp án không bao giờ gửi xuống máy học sinh trước khi được phép xem.
 */
import { z } from 'zod';
import { gradeSchema, STAGES, type Stage } from './classes.js';
import {
  questionKind,
  type GradableQuestion,
  type QuestionAdmin,
  type QuestionPublic,
  type QuestionResponse,
  type QuestionType,
} from './questions.js';

export const EXAM_MODES = ['practice', 'exam'] as const;
export type ExamMode = (typeof EXAM_MODES)[number];

export const EXAM_MODE_LABEL: Record<ExamMode, string> = {
  practice: 'Luyện tập',
  exam: 'Thi',
};

/** Khi nào em được xem đáp án + giải thích. Điểm thì luôn xem được ngay khi nộp. */
export const RESULT_VISIBILITY = ['after_submit', 'after_close'] as const;
export type ResultVisibility = (typeof RESULT_VISIBILITY)[number];

/** Mặc định đã chốt: đề thi xem đáp án sau giờ đóng, đề luyện tập xem ngay. */
export const defaultShowResult = (mode: ExamMode): ResultVisibility =>
  mode === 'exam' ? 'after_close' : 'after_submit';

/** Cho thêm 30 giây sau hạn nộp vì mạng chậm. */
export const SUBMIT_GRACE_MS = 30_000;

// ───────────── Quản trị đề ─────────────

const id = z.string().min(1).max(40);
const isoDate = z
  .string()
  .datetime({ offset: true, message: 'Ngày giờ không hợp lệ' })
  .nullable();

const examFields = z.object({
  title: z.string().trim().min(1, 'Nhập tên đề').max(120),
  description: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => v || null)
    .nullish()
    .transform((v) => v ?? null),
  mode: z.enum(EXAM_MODES),
  durationMin: z.coerce
    .number()
    .int()
    .min(1, 'Ít nhất 1 phút')
    .max(300, 'Tối đa 300 phút'),
  opensAt: isoDate,
  closesAt: isoDate,
  /** 0 = không giới hạn số lần làm. */
  maxAttempts: z.coerce.number().int().min(0).max(20),
  /** Trộn thứ tự câu trong mỗi phần và thứ tự lựa chọn. */
  shuffle: z.boolean(),
  showResult: z.enum(RESULT_VISIBILITY),
  /** null = cả hai cấp học. */
  stage: z.enum(STAGES).nullable(),
  /** null = mọi khối. */
  grade: gradeSchema.nullable(),
  isPublished: z.boolean(),
});

const windowOk = (v: { opensAt?: string | null; closesAt?: string | null }) =>
  !v.opensAt || !v.closesAt || new Date(v.closesAt) > new Date(v.opensAt);
const windowIssue = {
  path: ['closesAt'],
  message: 'Giờ đóng phải sau giờ mở',
};

export const examCreateSchema = examFields
  .extend({
    mode: z.enum(EXAM_MODES).default('exam'),
    durationMin: examFields.shape.durationMin.default(40),
    opensAt: isoDate.default(null),
    closesAt: isoDate.default(null),
    maxAttempts: examFields.shape.maxAttempts.default(1),
    shuffle: z.boolean().default(true),
    showResult: z.enum(RESULT_VISIBILITY).optional(),
    stage: z.enum(STAGES).nullable().default('secondary'),
    grade: gradeSchema.nullable().default(null),
    isPublished: z.boolean().default(false),
  })
  .refine(windowOk, windowIssue)
  .transform((v) => ({
    ...v,
    showResult: v.showResult ?? defaultShowResult(v.mode),
  }));
export type ExamCreate = z.input<typeof examCreateSchema>;

export const examUpdateSchema = examFields
  .partial()
  .refine(windowOk, windowIssue);
export type ExamUpdate = z.input<typeof examUpdateSchema>;

export const EXAM_LIMITS = { sections: 20, items: 200 } as const;

/** Cấu trúc đề: các phần, mỗi phần các câu (từ ngân hàng) kèm điểm. Gửi cả đề một lần. */
export const examStructureSchema = z
  .object({
    sections: z
      .array(
        z.object({
          title: z.string().trim().min(1, 'Nhập tên phần').max(120),
          items: z
            .array(
              z.object({
                questionId: id,
                points: z.coerce
                  .number()
                  .min(0.25, 'Điểm ít nhất 0,25')
                  .max(100),
              }),
            )
            .max(EXAM_LIMITS.items),
        }),
      )
      .max(EXAM_LIMITS.sections, `Tối đa ${EXAM_LIMITS.sections} phần`),
  })
  .superRefine((v, ctx) => {
    const ids = v.sections.flatMap((s) => s.items.map((i) => i.questionId));
    if (ids.length > EXAM_LIMITS.items)
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message: `Một đề tối đa ${EXAM_LIMITS.items} câu`,
      });
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message: 'Một câu hỏi nằm ở hai chỗ trong đề',
      });
  });
export type ExamStructure = z.infer<typeof examStructureSchema>;

export interface ExamSummary {
  id: string;
  title: string;
  description: string | null;
  mode: ExamMode;
  durationMin: number;
  opensAt: string | null;
  closesAt: string | null;
  maxAttempts: number;
  shuffle: boolean;
  showResult: ResultVisibility;
  stage: Stage | null;
  grade: number | null;
  isPublished: boolean;
  questionCount: number;
  totalPoints: number;
  /** Số lượt làm (kể cả đang làm). Có lượt rồi thì không sửa cấu trúc đề được nữa. */
  attemptCount: number;
  updatedAt: string;
}

export interface ExamDetail extends ExamSummary {
  sections: Array<{
    id: string;
    title: string;
    items: Array<{ id: string; points: number; question: QuestionAdmin }>;
  }>;
}

// ───────────── Thời gian, trạng thái, điểm ─────────────

export type ExamState = 'upcoming' | 'open' | 'closed';

export function examState(
  e: { opensAt: Date | string | null; closesAt: Date | string | null },
  now: Date,
): ExamState {
  if (e.opensAt && now < new Date(e.opensAt)) return 'upcoming';
  if (e.closesAt && now >= new Date(e.closesAt)) return 'closed';
  return 'open';
}

/** Hạn nộp của một lượt: hết thời gian làm bài, hoặc giờ đóng đề nếu sớm hơn. */
export function attemptDeadline(
  startedAt: Date,
  durationMin: number,
  closesAt: Date | string | null,
): Date {
  const byDuration = startedAt.getTime() + durationMin * 60_000;
  const byClose = closesAt
    ? new Date(closesAt).getTime()
    : Number.POSITIVE_INFINITY;
  return new Date(Math.min(byDuration, byClose));
}

/** Quá hạn (kể cả 30 giây cho thêm) thì không nhận câu trả lời nữa. */
export const isPastGrace = (deadlineAt: Date, now: Date) =>
  now.getTime() > deadlineAt.getTime() + SUBMIT_GRACE_MS;

/** Quy về thang 10, làm tròn 2 chữ số. */
export function scoreOutOf10(earned: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((earned / max) * 1000) / 100;
}

/** Em được xem đáp án + giải thích chưa. */
export function detailsVisible(
  e: { showResult: ResultVisibility; closesAt: Date | string | null },
  now: Date,
): boolean {
  if (e.showResult === 'after_submit') return true;
  // Đề không có giờ đóng thì "sau khi đóng" không bao giờ tới: chỉ hiện điểm.
  return !!e.closesAt && now >= new Date(e.closesAt);
}

// ───────────── Trộn câu / lựa chọn cho từng lượt ─────────────

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Lựa chọn có được trộn không. Không trộn: Đúng/Sai (thứ tự cố định) và tìm lỗi sai
 * (các phần A–D nằm trong câu). Cụm từ câu sắp xếp thì luôn trộn, kể cả khi đề không bật trộn.
 */
export function shufflesOptions(type: QuestionType, examShuffle: boolean) {
  if (questionKind(type) === 'reorder') return true;
  if (type === 'true_false' || type === 'error') return false;
  return examShuffle && questionKind(type) === 'choice';
}

/** Thứ tự của một lượt làm: mỗi phần giữ nguyên, câu trong phần và lựa chọn có thể trộn. */
export interface AttemptOrder {
  sections: Array<{
    sectionId: string;
    items: Array<{
      itemId: string;
      /** options[vị trí hiển thị] = vị trí gốc; null = giữ nguyên thứ tự. */
      options: number[] | null;
    }>;
  }>;
}

export function buildAttemptOrder(
  sections: Array<{
    id: string;
    items: Array<{ id: string; type: QuestionType; optionCount: number }>;
  }>,
  shuffle: boolean,
  random: () => number = Math.random,
): AttemptOrder {
  return {
    sections: sections.map((s) => ({
      sectionId: s.id,
      items: (shuffle ? shuffled(s.items, random) : s.items).map((it) => {
        if (!shufflesOptions(it.type, shuffle) || it.optionCount < 2)
          return { itemId: it.id, options: null };
        const idx = Array.from({ length: it.optionCount }, (_, i) => i);
        let perm = shuffled(idx, random);
        // Câu sắp xếp mà trộn ra đúng thứ tự gốc thì xoay một vòng.
        if (
          questionKind(it.type) === 'reorder' &&
          perm.every((v, i) => v === i)
        )
          perm = [...perm.slice(1), perm[0]];
        return { itemId: it.id, options: perm };
      }),
    })),
  };
}

/** Lựa chọn theo thứ tự em thấy. */
export const displayedOptions = (
  options: readonly string[],
  order: readonly number[] | null,
) => (order ? order.map((i) => options[i]) : [...options]);

/** Câu trả lời (theo thứ tự em thấy) → theo thứ tự gốc, để chấm bằng `gradeQuestion`. */
export function toOriginalResponse(
  type: QuestionType,
  response: QuestionResponse,
  order: readonly number[] | null,
): QuestionResponse {
  if (!order || response === null) return response;
  const kind = questionKind(type);
  if (kind === 'choice' && typeof response === 'number')
    return order[response] ?? -1;
  if (kind === 'reorder' && Array.isArray(response))
    return response.map((i) => order[i] ?? -1);
  return response;
}

/** Vị trí đáp án đúng theo thứ tự em thấy (để tô xanh khi xem kết quả). */
export function displayedCorrect(
  q: GradableQuestion,
  order: readonly number[] | null,
): number | null {
  if (q.correct === null) return null;
  return order ? order.indexOf(q.correct) : q.correct;
}

// ───────────── Học sinh làm bài ─────────────

/** Câu trả lời em gửi lên: số (chọn), chữ (gõ), dãy số (sắp xếp), null (bỏ trống). */
export const questionResponseSchema = z.union([
  z.number().int().min(0).max(20),
  z.string().max(2000),
  z.array(z.number().int().min(0).max(20)).max(20),
  z.null(),
]);

export const saveAnswerSchema = z.object({
  response: questionResponseSchema,
  flagged: z.boolean().default(false),
});
export type SaveAnswerRequest = z.input<typeof saveAnswerSchema>;

/** Một đề trong danh sách của em. */
export interface PlayExam {
  id: string;
  title: string;
  description: string | null;
  mode: ExamMode;
  durationMin: number;
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  maxAttempts: number;
  attemptsUsed: number;
  state: ExamState;
  /** Lượt đang làm dở (vào lại làm tiếp). */
  inProgressAttemptId: string | null;
  /** Lượt nộp gần nhất, để xem lại điểm. */
  lastAttempt: { id: string; score: number } | null;
}

export interface AttemptItemView {
  itemId: string;
  number: number;
  points: number;
  /** Lựa chọn đã theo thứ tự của lượt này; không có đáp án. */
  question: QuestionPublic;
}

/** Bài đang làm, như máy em nhận được. */
export interface AttemptView {
  id: string;
  exam: { id: string; title: string; mode: ExamMode };
  startedAt: string;
  deadlineAt: string;
  /** Giờ máy chủ lúc trả lời — để đồng hồ trên máy em không lệch. */
  serverNow: string;
  sections: Array<{ title: string; items: AttemptItemView[] }>;
  passages: Record<string, { title: string; text: string }>;
  answers: Record<string, { response: QuestionResponse; flagged: boolean }>;
}

export interface AttemptResultItem extends AttemptItemView {
  sectionTitle: string;
  earned: number;
  correct: boolean;
  response: QuestionResponse;
  /** Đáp án đúng để hiện, vd "B. goes". */
  answer: string;
  /** Vị trí lựa chọn đúng theo thứ tự em thấy. */
  correctIndex: number | null;
  explanation: string | null;
}

export interface AttemptResult {
  id: string;
  exam: { id: string; title: string; mode: ExamMode };
  submittedAt: string;
  /** true = hết giờ, máy tự nộp những câu đã lưu. */
  autoSubmitted: boolean;
  score: number;
  earned: number;
  maxPoints: number;
  correctCount: number;
  questionCount: number;
  /** null = chưa được xem đáp án (xem `detailsAt`). */
  items: AttemptResultItem[] | null;
  detailsAt: string | null;
  passages: Record<string, { title: string; text: string }>;
}

/** Nộp bài / mở bài đã nộp trả về kết quả; bài còn làm trả về bài đang làm. */
export type AttemptResponse =
  | { status: 'in_progress'; attempt: AttemptView }
  | { status: 'submitted'; result: AttemptResult };

// ───────────── Kết quả cho giáo viên ─────────────

export interface ExamResultRow {
  attemptId: string;
  student: {
    id: string;
    displayName: string;
    username: string;
    className: string | null;
    classId: string | null;
  };
  attemptCount: number;
  startedAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  score: number | null;
  correctCount: number;
}

export interface ExamResults {
  exam: ExamSummary;
  questionCount: number;
  /** Lượt nộp gần nhất của mỗi em (và lượt đang làm nếu em chưa nộp lượt nào). */
  rows: ExamResultRow[];
  /** Tỉ lệ đúng từng câu, tính trên lượt nộp gần nhất của mỗi em. */
  items: Array<{
    itemId: string;
    number: number;
    sectionTitle: string;
    prompt: string;
    type: QuestionType;
    grammarTag: string | null;
    answered: number;
    correct: number;
  }>;
  byType: Array<{ type: QuestionType; answered: number; correct: number }>;
  byTag: Array<{ tag: string; answered: number; correct: number }>;
}

export type ExamErrorCode =
  | 'exam_unavailable'
  | 'exam_not_open'
  | 'exam_closed'
  | 'exam_empty'
  | 'no_attempts_left'
  | 'attempt_submitted'
  | 'attempt_expired'
  | 'exam_has_attempts'
  | 'invalid_response';
