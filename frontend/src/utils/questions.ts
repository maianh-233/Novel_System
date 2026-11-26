import {
  questionKind,
  splitMarked,
  type GradableQuestion,
} from '@novel/shared';

const LETTERS = 'ABCDEF';
const TF_LABEL: Record<string, string> = { True: 'Đúng', False: 'Sai' };

/** Bỏ dấu ngoặc đánh dấu: "c[a]t" → "cat". */
export const plainText = (s: string) =>
  splitMarked(s)
    .map((p) => p.text)
    .join('');

/** Đáp án đúng để hiện cho em / giáo viên: "B. goes", "Sai", "friendly / friendlier". */
export function answerText(q: GradableQuestion): string {
  const kind = questionKind(q.type);
  if (kind === 'choice') {
    if (q.correct === null) return '';
    const opt = q.options[q.correct] ?? '';
    if (q.type === 'true_false') return TF_LABEL[opt] ?? opt;
    return `${LETTERS[q.correct]}. ${plainText(opt)}`;
  }
  if (kind === 'reorder') return q.accepted[0] ?? '';
  return q.accepted.join(' / ');
}
