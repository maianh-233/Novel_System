import type { GameProps } from '@novel/shared';
import { QuestionGame } from '../shared/QuestionGame';
import { huntPoints, partCount } from './logic';

/** Error Hunter — chạm vào phần sai trong câu; tìm nhanh được thưởng. */
export function ErrorHunter(props: GameProps) {
  return (
    <QuestionGame
      {...props}
      options={{
        checkOnPick: true,
        task: (rq) =>
          `Chạm vào phần sai (1 trong ${partCount(rq.shown.prompt)} phần gạch chân)`,
        points: ({ correct, elapsedMs }) => huntPoints(correct, elapsedMs),
      }}
    />
  );
}
