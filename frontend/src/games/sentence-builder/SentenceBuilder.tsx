import type { GameProps } from '@novel/shared';
import { QuestionGame } from '../shared/QuestionGame';
import { sentencePoints } from './logic';

/** Sentence Builder — chạm các cụm từ theo thứ tự để xếp thành câu đúng, rồi bấm "Kiểm tra". */
export function SentenceBuilder(props: GameProps) {
  return (
    <QuestionGame
      {...props}
      options={{
        task: () => 'Chạm các cụm từ theo thứ tự để xếp thành câu đúng',
        points: ({ rq, correct }) =>
          sentencePoints(rq.shown.options.length, correct),
      }}
    />
  );
}
