/**
 * Ngân hàng câu hỏi (C1 — docs/PLAN-CAP2.md mục 4).
 * Dùng chung cho game ngữ pháp, bài tập và đề thi. Thư viện chấm điểm ở đây là nguồn duy nhất:
 * máy chủ chấm bài thi và màn xem trước của giáo viên đều gọi `gradeQuestion`.
 */
import { z } from 'zod';
import { STAGES, type Stage } from './classes.js';
import type { Level } from './vocabulary.js';

// ───────────── Các dạng câu hỏi ─────────────

export const QUESTION_TYPES = [
  'mcq',
  'pronunciation',
  'stress',
  'error',
  'true_false',
  'verb_form',
  'word_form',
  'fill',
  'rewrite',
  'reorder',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** choice: chọn một đáp án · typed: gõ đáp án · reorder: sắp xếp các cụm từ. */
export type QuestionKind = 'choice' | 'typed' | 'reorder';

export const QUESTION_TYPE_INFO: Record<
  QuestionType,
  { label: string; kind: QuestionKind; hint: string }
> = {
  mcq: {
    label: 'Trắc nghiệm',
    kind: 'choice',
    hint: 'Chọn đáp án đúng A/B/C/D.',
  },
  pronunciation: {
    label: 'Phát âm',
    kind: 'choice',
    hint: 'Đặt phần gạch chân trong ngoặc vuông: c[a]t, h[a]t.',
  },
  stress: {
    label: 'Trọng âm',
    kind: 'choice',
    hint: 'Chọn từ có trọng âm khác các từ còn lại.',
  },
  error: {
    label: 'Tìm lỗi sai',
    kind: 'choice',
    hint: 'Đặt các phần A, B, C, D trong ngoặc vuông: She [go] to [school] ...',
  },
  true_false: {
    label: 'Đúng / Sai',
    kind: 'choice',
    hint: 'Câu nhận định về bài đọc; đáp án Đúng hoặc Sai.',
  },
  verb_form: {
    label: 'Chia động từ',
    kind: 'typed',
    hint: 'Ghi động từ trong ngoặc: She ___ (go) to school.',
  },
  word_form: {
    label: 'Word form',
    kind: 'typed',
    hint: 'Ghi từ gốc trong ngoặc: He is very ___ (friend).',
  },
  fill: {
    label: 'Điền từ',
    kind: 'typed',
    hint: 'Gõ từ còn thiếu (vd: chỗ trống trong đoạn văn).',
  },
  rewrite: {
    label: 'Viết lại câu',
    kind: 'typed',
    hint: 'Viết lại câu cùng nghĩa; có thể cho sẵn phần đầu câu.',
  },
  reorder: {
    label: 'Sắp xếp câu',
    kind: 'reorder',
    hint: 'Các cụm từ cách nhau bằng dấu /: to school / I / go / every day',
  },
};

export const questionKind = (t: QuestionType) => QUESTION_TYPE_INFO[t].kind;

export const QUESTION_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const TRUE_FALSE_OPTIONS = ['True', 'False'] as const;

// ───────────── Đánh dấu trong câu: [phần gạch chân] ─────────────

const BRACKET = /\[([^[\]]+)\]/g;

/** Các phần đặt trong ngoặc vuông, theo thứ tự. */
export const bracketSegments = (text: string) =>
  [...text.matchAll(BRACKET)].map((m) => m[1].trim());

/** Tách chữ thường và phần đánh dấu để hiển thị (gạch chân / đánh chữ A, B, C, D). */
export function splitMarked(
  text: string,
): Array<{ text: string; marked: boolean }> {
  const parts: Array<{ text: string; marked: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(BRACKET)) {
    if (m.index > last)
      parts.push({ text: text.slice(last, m.index), marked: false });
    parts.push({ text: m[1], marked: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), marked: false });
  return parts;
}

/** Bỏ dấu ngoặc đánh dấu: "c[a]t" → "cat". */
export const plainText = (s: string) =>
  splitMarked(s)
    .map((p) => p.text)
    .join('');

// ───────────── Chuẩn hoá câu gõ ─────────────

/**
 * Chuẩn hoá câu em gõ trước khi so với đáp án: bỏ hoa thường và khoảng trắng thừa,
 * quy dấu nháy cong về nháy thẳng, bỏ khoảng trắng trước dấu câu, bỏ dấu chấm cuối câu.
 */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ ([.,!?;:])/g, '$1')
    .trim()
    .replace(/\.+$/, '')
    .trim();
}

const tokensOf = (s: string) =>
  normalizeAnswer(s)
    .replace(/[.,!?;:]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

// ───────────── Chấm điểm ─────────────

/** Phần câu hỏi cần để chấm (máy chủ có; học sinh không bao giờ nhận được trước khi nộp). */
export interface GradableQuestion {
  type: QuestionType;
  options: string[];
  /** Vị trí đáp án đúng (dạng chọn). */
  correct: number | null;
  /** Các đáp án chấp nhận (dạng gõ, sắp xếp). */
  accepted: string[];
}

/** Câu trả lời của em: số = vị trí lựa chọn; chuỗi = câu gõ; mảng số = thứ tự các cụm từ. */
export type QuestionResponse = number | string | number[] | null;

/** null = câu trả lời đúng kiểu với dạng câu; ngược lại là lý do. */
export function responseProblem(
  type: QuestionType,
  response: QuestionResponse,
  optionCount: number,
): string | null {
  if (response === null) return null;
  switch (questionKind(type)) {
    case 'choice':
      return typeof response === 'number' && response < optionCount
        ? null
        : 'Câu chọn đáp án cần một lựa chọn hợp lệ';
    case 'typed':
      return typeof response === 'string' ? null : 'Câu này cần gõ đáp án';
    case 'reorder':
      return Array.isArray(response) &&
        response.length <= optionCount &&
        response.every((i) => i < optionCount)
        ? null
        : 'Thứ tự cụm từ không hợp lệ';
  }
}

/** Câu sắp xếp em xếp ra; null = không phải một cách xếp hợp lệ (thiếu/thừa/lặp cụm từ). */
export function reorderSentence(
  fragments: readonly string[],
  order: readonly number[],
): string | null {
  if (order.length !== fragments.length) return null;
  const seen = new Set<number>();
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= fragments.length || seen.has(i))
      return null;
    seen.add(i);
  }
  return order.map((i) => fragments[i]).join(' ');
}

export function gradeQuestion(
  q: GradableQuestion,
  response: QuestionResponse,
): boolean {
  if (response === null) return false;
  switch (questionKind(q.type)) {
    case 'choice':
      return typeof response === 'number' && response === q.correct;
    case 'typed': {
      if (typeof response !== 'string') return false;
      const given = normalizeAnswer(response);
      return (
        given !== '' && q.accepted.some((a) => normalizeAnswer(a) === given)
      );
    }
    case 'reorder': {
      if (!Array.isArray(response)) return false;
      const sentence = reorderSentence(q.options, response);
      if (sentence === null) return false;
      const given = normalizeAnswer(sentence);
      return q.accepted.some((a) => normalizeAnswer(a) === given);
    }
  }
}

const ANSWER_LETTERS = 'ABCDEF';
const TF_LABEL: Record<string, string> = { True: 'Đúng', False: 'Sai' };

/** Đáp án đúng để hiện cho em / giáo viên: "B. goes", "Sai", "went / did go". */
export function answerText(q: GradableQuestion): string {
  const kind = questionKind(q.type);
  if (kind === 'choice') {
    if (q.correct === null) return '';
    const opt = q.options[q.correct] ?? '';
    if (q.type === 'true_false') return TF_LABEL[opt] ?? opt;
    return `${ANSWER_LETTERS[q.correct]}. ${plainText(opt)}`;
  }
  if (kind === 'reorder') return q.accepted[0] ?? '';
  return q.accepted.join(' / ');
}

// ───────────── Schema nhập / sửa câu hỏi ─────────────

const id = z.string().min(1).max(40);
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish()
    .transform((v) => v ?? null);

const levelSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(3) as unknown as z.ZodType<Level>;

export const QUESTION_LIMITS = {
  prompt: 1000,
  option: 200,
  minOptions: 2,
  maxOptions: 6,
  maxAccepted: 10,
  maxFragments: 12,
} as const;

const questionFields = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: text(QUESTION_LIMITS.prompt),
  /** Gợi ý (vd: phần đầu câu viết lại). */
  hint: optionalText(200),
  options: z.array(text(QUESTION_LIMITS.option)).max(20).default([]),
  correct: z.number().int().min(0).max(20).nullable().default(null),
  accepted: z.array(text(500)).max(20).default([]),
  explanation: optionalText(1000),
  grammarTag: optionalText(60),
  level: levelSchema.default(1),
  /** null = dùng cho cả hai cấp học. */
  stage: z.enum(STAGES).nullable().default('secondary'),
  passageId: id.nullish().transform((v) => v ?? null),
});

/**
 * Câu hỏi giáo viên gửi lên. Kiểm tra theo từng dạng, rồi dọn các trường dạng đó không dùng
 * (vd: câu gõ không giữ lựa chọn) để dữ liệu lưu luôn gọn và chấm được.
 */
export const questionInputSchema = questionFields
  .superRefine((q, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (!q.prompt) issue('prompt', 'Nhập đề bài');
    const kind = questionKind(q.type);

    if (q.type === 'error') {
      const segs = bracketSegments(q.prompt);
      if (segs.length < 2 || segs.length > QUESTION_LIMITS.maxOptions)
        issue(
          'prompt',
          'Câu tìm lỗi sai cần 2–6 phần trong ngoặc vuông, vd: She [go] to [school].',
        );
      else if (q.correct === null || q.correct >= segs.length)
        issue('correct', 'Chọn phần sai');
      return;
    }
    if (q.type === 'true_false') {
      if (q.correct !== 0 && q.correct !== 1)
        issue('correct', 'Chọn Đúng hoặc Sai');
      return;
    }
    if (kind === 'choice') {
      const opts = q.options.filter(Boolean);
      if (opts.length !== q.options.length)
        issue('options', 'Có lựa chọn đang trống');
      if (
        q.options.length < QUESTION_LIMITS.minOptions ||
        q.options.length > QUESTION_LIMITS.maxOptions
      )
        issue('options', 'Cần 2–6 lựa chọn');
      const keys = q.options.map(normalizeAnswer);
      if (new Set(keys).size !== keys.length)
        issue('options', 'Có hai lựa chọn giống nhau');
      if (q.correct === null || q.correct >= q.options.length)
        issue('correct', 'Chọn đáp án đúng');
      if (
        q.type === 'pronunciation' &&
        q.options.some((o) => bracketSegments(o).length !== 1)
      )
        issue(
          'options',
          'Mỗi từ cần đúng một phần gạch chân trong ngoặc vuông, vd: c[a]t',
        );
      return;
    }

    const accepted = q.accepted.filter(Boolean);
    if (accepted.length === 0) issue('accepted', 'Nhập ít nhất một đáp án');
    if (accepted.length > QUESTION_LIMITS.maxAccepted)
      issue('accepted', `Tối đa ${QUESTION_LIMITS.maxAccepted} đáp án`);

    if (kind === 'reorder') {
      const frags = q.options.filter(Boolean);
      if (frags.length < 2 || frags.length > QUESTION_LIMITS.maxFragments)
        issue('options', 'Cần 2–12 cụm từ để sắp xếp');
      const pool = tokensOf(frags.join(' '));
      const bad = accepted.find((a) => tokensOf(a) !== pool);
      if (bad)
        issue(
          'accepted',
          `Đáp án "${bad}" không dùng đúng và đủ các cụm từ đã cho`,
        );
    }
  })
  .transform((q) => {
    const kind = questionKind(q.type);
    const options =
      q.type === 'error'
        ? bracketSegments(q.prompt)
        : q.type === 'true_false'
          ? [...TRUE_FALSE_OPTIONS]
          : kind === 'typed'
            ? []
            : q.options.filter(Boolean);
    return {
      ...q,
      options,
      correct: kind === 'choice' ? q.correct : null,
      accepted: kind === 'choice' ? [] : q.accepted.filter(Boolean),
    };
  });
export type QuestionInput = z.input<typeof questionInputSchema>;
export type QuestionData = z.output<typeof questionInputSchema>;

export const questionStatusSchema = z.object({
  status: z.enum(QUESTION_STATUSES),
});

export const questionQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  grammarTag: z.string().trim().max(60).optional(),
  stage: z.enum([...STAGES, 'both']).optional(),
  level: levelSchema.optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  passageId: id.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type QuestionQuery = z.input<typeof questionQuerySchema>;

export interface QuestionAdmin extends GradableQuestion {
  id: string;
  prompt: string;
  hint: string | null;
  explanation: string | null;
  grammarTag: string | null;
  level: Level;
  stage: Stage | null;
  passage: { id: string; title: string } | null;
  status: QuestionStatus;
  /** Số Unit (bài học) đang dùng câu này. */
  lessonCount: number;
  updatedAt: string;
}

/** Câu hỏi như học sinh nhận được: không có đáp án, không có giải thích. */
export interface QuestionPublic {
  id: string;
  type: QuestionType;
  prompt: string;
  hint: string | null;
  /** Lựa chọn (dạng chọn) hoặc cụm từ (sắp xếp, đã trộn khi phát cho em). */
  options: string[];
  passageId: string | null;
}

export function toPublicQuestion(
  q: Pick<QuestionAdmin, 'id' | 'type' | 'prompt' | 'hint' | 'options'> & {
    passageId?: string | null;
  },
): QuestionPublic {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    hint: q.hint,
    options: [...q.options],
    passageId: q.passageId ?? null,
  };
}

// ───────────── Đoạn văn ─────────────

export const passageInputSchema = z.object({
  title: z.string().trim().min(1, 'Nhập tên đoạn văn').max(120),
  text: z.string().trim().min(1, 'Nhập nội dung đoạn văn').max(10_000),
});
export type PassageInput = z.infer<typeof passageInputSchema>;

export interface PassageAdmin {
  id: string;
  title: string;
  text: string;
  questionCount: number;
  updatedAt: string;
}

// ───────────── Gắn câu hỏi vào Unit ─────────────

export const lessonQuestionsSchema = z.object({
  questionIds: z
    .array(id)
    .max(300, 'Một Unit tối đa 300 câu hỏi')
    .refine((ids) => new Set(ids).size === ids.length, 'Có câu hỏi bị trùng'),
});
export type LessonQuestionsRequest = z.infer<typeof lessonQuestionsSchema>;

export type QuestionErrorCode =
  'question_in_use' | 'unknown_passage' | 'unknown_question' | 'passage_in_use';
