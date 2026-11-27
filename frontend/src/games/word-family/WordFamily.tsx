import type { GameProps } from '@novel/shared';
import { QuestionGame } from '../shared/QuestionGame';
import { promptWithoutRoot, rootWord } from './logic';

/** Word Family — gốc từ hiện thành thẻ to, em gõ dạng đúng (danh / động / tính / trạng từ). */
export function WordFamily(props: GameProps) {
  return (
    <QuestionGame
      {...props}
      options={{
        task: (rq) => {
          const root = rootWord(rq.shown.prompt);
          return root ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              Gốc từ:
              <span className="sticker bg-sun px-3 py-1 font-display text-2xl font-extrabold text-ink">
                {root}
              </span>
            </span>
          ) : (
            'Gõ dạng đúng của từ'
          );
        },
        showPrompt: (rq) => promptWithoutRoot(rq.shown.prompt),
        points: ({ correct }) => (correct ? 10 : 0),
      }}
    />
  );
}
