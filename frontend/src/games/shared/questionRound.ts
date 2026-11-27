import {
  answerText,
  buildAttemptOrder,
  displayedCorrect,
  displayedOptions,
  gradeQuestion,
  questionKind,
  reorderSentence,
  toOriginalResponse,
  type GameQuestion,
  type GradableQuestion,
  type QuestionPublic,
  type QuestionResponse,
} from '@novel/shared';
import type { QuestionFeedback } from '../../components/question/QuestionView';

/** Một câu hỏi đã sẵn sàng để hiện: lựa chọn / cụm từ đã trộn cho lượt này. */
export interface RoundQuestion {
  source: GameQuestion;
  /** Câu như em thấy (lựa chọn theo thứ tự đã trộn). */
  shown: QuestionPublic;
  /** options[vị trí hiển thị] = vị trí gốc; null = giữ nguyên. */
  order: number[] | null;
}

const gradableOf = (q: GameQuestion): GradableQuestion => ({
  type: q.type,
  options: q.options,
  correct: q.correct,
  accepted: q.accepted,
});

/**
 * Trộn lựa chọn của từng câu như màn làm đề: trắc nghiệm trộn A–D, cụm từ câu sắp xếp luôn
 * trộn (và không bao giờ ra đúng thứ tự gốc); Đúng/Sai và tìm lỗi sai giữ nguyên.
 */
export function prepareRound(
  questions: readonly GameQuestion[],
  random: () => number = Math.random,
): RoundQuestion[] {
  return questions.map((q) => {
    const [section] = buildAttemptOrder(
      [
        {
          id: 'round',
          items: [{ id: q.id, type: q.type, optionCount: q.options.length }],
        },
      ],
      true,
      random,
    ).sections;
    const order = section.items[0].options;
    return {
      source: q,
      order,
      shown: { ...q, options: displayedOptions(q.options, order) },
    };
  });
}

export interface CheckResult {
  correct: boolean;
  /** Câu trả lời theo thứ tự gốc — gửi về máy chủ để chấm lại. */
  original: QuestionResponse;
  feedback: QuestionFeedback;
}

/** Chấm câu em vừa làm (theo thứ tự em thấy) bằng cùng thư viện máy chủ dùng. */
export function checkRoundQuestion(
  rq: RoundQuestion,
  response: QuestionResponse,
): CheckResult {
  const gradable = gradableOf(rq.source);
  const original = toOriginalResponse(rq.source.type, response, rq.order);
  const correctIndex = displayedCorrect(gradable, rq.order);
  const correct = gradeQuestion(gradable, original);
  return {
    correct,
    original,
    feedback: {
      correct,
      answer: answerText({
        ...gradable,
        options: rq.shown.options,
        correct: correctIndex,
      }),
      explanation: rq.source.explanation,
      correctIndex,
    },
  };
}

/** Em đã làm đủ để bấm "Kiểm tra" chưa (chọn một lựa chọn / gõ chữ / xếp hết cụm từ). */
export function isReady(q: QuestionPublic, response: QuestionResponse) {
  switch (questionKind(q.type)) {
    case 'choice':
      return typeof response === 'number';
    case 'typed':
      return typeof response === 'string' && response.trim().length > 0;
    case 'reorder':
      return (
        Array.isArray(response) && reorderSentence(q.options, response) !== null
      );
  }
}
