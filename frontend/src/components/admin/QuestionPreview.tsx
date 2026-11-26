import {
  gradeQuestion,
  toPublicQuestion,
  type GradableQuestion,
  type QuestionResponse,
  type QuestionType,
} from '@novel/shared';
import { useMemo, useState } from 'react';
import { shuffle } from '../../games/shared/random';
import { answerText } from '../../utils/questions';
import { QuestionView } from '../question/QuestionView';
import { Button } from './ui';

export interface PreviewQuestion extends GradableQuestion {
  type: QuestionType;
  prompt: string;
  hint: string | null;
  explanation: string | null;
}

/**
 * Xem trước đúng như học sinh thấy (giao diện cấp 2), làm thử và chấm bằng chính
 * `gradeQuestion` mà máy chủ dùng. Câu sắp xếp được trộn cụm từ như khi phát cho em.
 */
export function QuestionPreview({
  question,
  passage,
  number,
}: {
  question: PreviewQuestion;
  passage?: { title: string; text: string } | null;
  number?: number;
}) {
  const [response, setResponse] = useState<QuestionResponse>(null);
  const [checked, setChecked] = useState(false);

  // Câu sắp xếp: trộn cụm từ một lần; chấm theo đúng thứ tự đã trộn.
  const optionsKey = `${question.type}|${question.options.join('|')}`;
  const options = useMemo(
    () =>
      question.type === 'reorder'
        ? shuffle(question.options)
        : question.options,
    // Chỉ trộn lại khi danh sách cụm từ đổi, không phải mỗi lần form vẽ lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionsKey],
  );
  const shown: PreviewQuestion = { ...question, options };
  const pub = toPublicQuestion({ ...shown, id: 'preview' });

  return (
    <div
      data-stage="secondary"
      className="rounded-xl border border-admin-line bg-paper p-4 text-base"
    >
      <QuestionView
        question={pub}
        number={number}
        passage={passage}
        response={response}
        onChange={(r) => {
          setResponse(r);
          setChecked(false);
        }}
        feedback={
          checked
            ? {
                correct: gradeQuestion(shown, response),
                answer: answerText(shown),
                explanation: shown.explanation,
                correctIndex: shown.correct,
              }
            : null
        }
      />
      <div className="mt-4 flex gap-2">
        {checked ? (
          <Button
            onClick={() => {
              setResponse(null);
              setChecked(false);
            }}
          >
            Làm lại
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={response === null || response === ''}
            onClick={() => setChecked(true)}
          >
            Kiểm tra thử
          </Button>
        )}
      </div>
    </div>
  );
}
