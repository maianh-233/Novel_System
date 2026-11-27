import type { GameProps } from '@novel/shared';
import { Volume2 } from 'lucide-react';
import { usePronounce } from '../../hooks/usePronounce';
import { QuestionGame } from '../shared/QuestionGame';
import { spokenForm, taskFor } from './logic';

/**
 * Sound & Stress — tìm từ phát âm / trọng âm khác. Mỗi từ có nút nghe đọc (giọng đọc của máy),
 * nghe bao nhiêu lần cũng được, kể cả sau khi đã chọn.
 */
export function SoundStress(props: GameProps) {
  const pronounce = usePronounce();
  return (
    <QuestionGame
      {...props}
      options={{
        checkOnPick: true,
        task: (rq) => taskFor(rq.shown.type, rq.shown.prompt),
        points: ({ correct }) => (correct ? 10 : 0),
        extra: (rq) => (
          <div className="flex flex-wrap gap-2" aria-label="Nghe từng từ">
            {rq.shown.options.map((opt, i) => {
              const word = spokenForm(opt);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pronounce(word)}
                  className="sticker pressable inline-flex cursor-pointer items-center gap-1.5 bg-white px-3 py-2"
                  aria-label={`Nghe đọc ${word}`}
                >
                  <Volume2 aria-hidden className="size-4" />
                  {word}
                </button>
              );
            })}
          </div>
        ),
      }}
    />
  );
}
