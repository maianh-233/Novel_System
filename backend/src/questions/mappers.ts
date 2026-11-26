import {
  questionKind,
  type QuestionAdmin,
  type QuestionData,
  type Level,
} from '@novel/shared';
import type { Prisma } from '../generated/prisma/client.js';

export const questionInclude = {
  passage: { select: { id: true, title: true } },
  _count: { select: { lessons: true } },
} satisfies Prisma.QuestionInclude;

export type QuestionRow = Prisma.QuestionGetPayload<{
  include: typeof questionInclude;
}>;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Cột `answers`: dạng chọn lưu [vị trí đúng]; dạng gõ / sắp xếp lưu các đáp án chấp nhận. */
export function toQuestionAdmin(q: QuestionRow): QuestionAdmin {
  const choice = questionKind(q.type) === 'choice';
  const answers: unknown[] = Array.isArray(q.answers) ? q.answers : [];
  const correct = choice && typeof answers[0] === 'number' ? answers[0] : null;
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    hint: q.hint,
    options: strings(q.options),
    correct,
    accepted: choice ? [] : strings(answers),
    explanation: q.explanation,
    grammarTag: q.grammarTag,
    level: q.level as Level,
    stage: q.stage,
    passage: q.passage,
    status: q.status,
    lessonCount: q._count.lessons,
    updatedAt: q.updatedAt.toISOString(),
  };
}

/** Dữ liệu đã kiểm tra (questionInputSchema) → cột database. */
export function toQuestionColumns(d: QuestionData) {
  return {
    type: d.type,
    prompt: d.prompt,
    hint: d.hint,
    options: d.options,
    answers: d.correct !== null ? [d.correct] : d.accepted,
    explanation: d.explanation,
    grammarTag: d.grammarTag,
    level: d.level,
    stage: d.stage,
    passageId: d.passageId,
  } satisfies Omit<Prisma.QuestionUncheckedCreateInput, 'id'>;
}
