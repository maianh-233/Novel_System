import {
  answerText,
  displayedCorrect,
  displayedOptions,
  toPublicQuestion,
  type AttemptItemView,
  type AttemptOrder,
  type AttemptResultItem,
  type ExamSummary,
  type QuestionResponse,
} from '@novel/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { toGradable } from '../questions/mappers.js';

export const examSummaryInclude = {
  sections: { select: { items: { select: { points: true } } } },
  _count: { select: { attempts: true } },
} satisfies Prisma.ExamInclude;

type SummaryRow = Prisma.ExamGetPayload<{ include: typeof examSummaryInclude }>;

export function toExamSummary(e: SummaryRow): ExamSummary {
  const items = e.sections.flatMap((s) => s.items);
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    mode: e.mode,
    durationMin: e.durationMin,
    opensAt: e.opensAt?.toISOString() ?? null,
    closesAt: e.closesAt?.toISOString() ?? null,
    maxAttempts: e.maxAttempts,
    shuffle: e.shuffle,
    showResult: e.showResult,
    stage: e.stage,
    grade: e.grade,
    isPublished: e.isPublished,
    questionCount: items.length,
    totalPoints: items.reduce((sum, i) => sum + i.points, 0),
    attemptCount: e._count.attempts,
    updatedAt: e.updatedAt.toISOString(),
  };
}

/** Đề kèm các câu hỏi (cả đáp án) — chỉ dùng trên máy chủ để dựng bài và chấm. */
export const examContentInclude = {
  sections: {
    orderBy: { order: 'asc' },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { question: { include: { passage: true } } },
      },
    },
  },
} satisfies Prisma.ExamInclude;

export type ExamContent = Prisma.ExamGetPayload<{
  include: typeof examContentInclude;
}>;
type ItemRow = ExamContent['sections'][number]['items'][number];

export const attemptInclude = {
  answers: true,
  exam: { include: examContentInclude },
} satisfies Prisma.ExamAttemptInclude;

export type AttemptRow = Prisma.ExamAttemptGetPayload<{
  include: typeof attemptInclude;
}>;

/** Một câu trong lượt làm, theo đúng thứ tự (câu, lựa chọn) đã trộn cho lượt đó. */
export interface LaidOutItem {
  item: ItemRow;
  sectionTitle: string;
  number: number;
  optionOrder: number[] | null;
}

const isOrder = (v: unknown): v is AttemptOrder =>
  !!v && typeof v === 'object' && Array.isArray((v as AttemptOrder).sections);

/** Dựng các phần / câu của một lượt từ `order` đã lưu. Câu không còn trong đề thì bỏ qua. */
export function layOut(attempt: AttemptRow): {
  sections: Array<{ title: string; items: LaidOutItem[] }>;
  all: LaidOutItem[];
} {
  const order = isOrder(attempt.order) ? attempt.order : { sections: [] };
  const sectionById = new Map(attempt.exam.sections.map((s) => [s.id, s]));
  let n = 0;
  const sections = order.sections.flatMap((os) => {
    const section = sectionById.get(os.sectionId);
    if (!section) return [];
    const itemById = new Map(section.items.map((i) => [i.id, i]));
    const items = os.items.flatMap((oi) => {
      const item = itemById.get(oi.itemId);
      if (!item) return [];
      n++;
      return [
        {
          item,
          sectionTitle: section.title,
          number: n,
          optionOrder: oi.options,
        },
      ];
    });
    return [{ title: section.title, items }];
  });
  return { sections, all: sections.flatMap((s) => s.items) };
}

/** Câu như em thấy: lựa chọn theo thứ tự của lượt, không có đáp án. */
export function toItemView(l: LaidOutItem): AttemptItemView {
  const q = l.item.question;
  const gradable = toGradable(q);
  return {
    itemId: l.item.id,
    number: l.number,
    points: l.item.points,
    question: toPublicQuestion({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      hint: q.hint,
      options: displayedOptions(gradable.options, l.optionOrder),
      passageId: q.passageId,
    }),
  };
}

export function passagesOf(items: LaidOutItem[]) {
  const passages: Record<string, { title: string; text: string }> = {};
  for (const { item } of items) {
    const p = item.question.passage;
    if (p) passages[p.id] = { title: p.title, text: p.text };
  }
  return passages;
}

export function toResultItem(
  l: LaidOutItem,
  answer:
    | { response: unknown; correct: boolean | null; points: number | null }
    | undefined,
): AttemptResultItem {
  const gradable = toGradable(l.item.question);
  // Chữ cái đáp án theo thứ tự em đã thấy (lựa chọn có thể đã trộn).
  const correctIndex = displayedCorrect(gradable, l.optionOrder);
  const shown = {
    ...gradable,
    options: displayedOptions(gradable.options, l.optionOrder),
    correct: correctIndex,
  };
  return {
    ...toItemView(l),
    sectionTitle: l.sectionTitle,
    earned: answer?.points ?? 0,
    correct: answer?.correct ?? false,
    response: (answer?.response ?? null) as QuestionResponse,
    answer: answerText(shown),
    correctIndex,
    explanation: l.item.question.explanation,
  };
}
