import type { GameProps } from '@novel/shared';
import { Check, Lightbulb, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { GameHeader } from '../shared/GameHeader';
import { playSfx } from '../shared/sfx';
import { useGameRound } from '../shared/useGameRound';
import {
  buildQuestions,
  isCorrect,
  MAX_ATTEMPTS,
  type QuizMode,
  type QuizQuestion,
} from './logic';

const QUESTION_TEXT: Record<QuizMode, string> = {
  meaning: 'Từ này nghĩa là gì?',
  word: 'Từ tiếng Anh nào có nghĩa này?',
  cloze: 'Chọn từ điền vào chỗ trống',
};

const NEXT_DELAY_MS = { correct: 700, revealed: 1800 };

/**
 * Word Quiz — game thử của Giai đoạn 3: đọc từ tiếng Anh, chọn nghĩa đúng.
 * Sai lần đầu được gợi ý và thử lại; sai lần nữa thì hiện đáp án rồi sang câu tiếp.
 * Chỉ trả lời đúng ngay lần đầu mới tính là "đúng".
 */
export function WordQuiz(props: GameProps) {
  const { content, timeLimitSec } = props;
  const { record, finish, timeLeft } = useGameRound(props);
  const questions = useMemo(
    () =>
      buildQuestions(content.words, content.level, Math.random, content.stage),
    [content],
  );
  const pronounce = usePronounce();
  const [index, setIndex] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<'correct' | 'revealed' | null>(null);

  // Sau khi trả lời xong một câu: tự sang câu tiếp (hoặc kết thúc).
  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => {
      if (index + 1 >= questions.length) {
        finish();
        return;
      }
      setIndex(index + 1);
      setWrongPicks([]);
      setOutcome(null);
    }, NEXT_DELAY_MS[outcome]);
    return () => clearTimeout(t);
  }, [outcome, index, questions.length, finish]);

  const q = questions[index];
  if (!q) return null;

  const pick = (option: string) => {
    if (outcome || wrongPicks.includes(option)) return;
    const attempts = wrongPicks.length + 1;
    if (isCorrect(q, option)) {
      record({
        vocabularyId: q.word.id,
        correct: attempts === 1,
        attempts,
      });
      playSfx('correct');
      setOutcome('correct');
      return;
    }
    playSfx('wrong');
    setWrongPicks([...wrongPicks, option]);
    if (attempts >= MAX_ATTEMPTS) {
      record({
        vocabularyId: q.word.id,
        correct: false,
        attempts,
      });
      setOutcome('revealed');
    } else if (q.mode === 'meaning') {
      // Gợi ý: đọc to từ một lần nữa. (Hỏi từ tiếng Anh thì đọc to là lộ đáp án.)
      pronounce(q.word.word, q.word.audioUrl);
    }
  };

  const showHint = wrongPicks.length > 0 && outcome !== 'correct';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <GameHeader
        label={`Câu ${index + 1}/${questions.length}`}
        progress={index / questions.length}
        timeLimitSec={timeLimitSec}
        timeLeft={timeLeft}
      />

      <QuestionCard
        q={q}
        answered={outcome !== null}
        onListen={() => pronounce(q.word.word, q.word.audioUrl)}
      />

      <p className="text-center font-display text-xl font-bold">
        {QUESTION_TEXT[q.mode]}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {q.options.map((option) => {
          const wrong = wrongPicks.includes(option);
          const right = outcome !== null && isCorrect(q, option);
          return (
            <li key={option}>
              <button
                type="button"
                onClick={() => pick(option)}
                disabled={wrong || outcome !== null}
                className={`sticker pressable flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left font-display text-xl font-bold disabled:cursor-default ${
                  right
                    ? 'bg-mint'
                    : wrong
                      ? 'animate-wiggle bg-tomato/25 text-ink/50 line-through'
                      : 'bg-white hover:bg-paper'
                }`}
              >
                <span>{option}</span>
                {right && <Check aria-label="Đúng" className="size-6" />}
                {wrong && <X aria-label="Chưa đúng" className="size-6" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="min-h-14 text-center">
        {outcome === 'correct' && (
          <p className="font-display text-2xl font-extrabold text-[#13734c]">
            Giỏi quá!
          </p>
        )}
        {outcome === 'revealed' && (
          <p className="font-display text-xl font-bold">
            Đáp án là “{q.answer}”. Câu sau em làm tốt hơn nhé!
          </p>
        )}
        {showHint && outcome === null && (
          <p className="inline-flex items-start gap-2 text-ink/80">
            <Lightbulb
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-[#b07d00]"
            />
            {q.mode === 'meaning' ? (
              <span>
                Chưa đúng rồi, em nghe lại và thử lần nữa nhé.
                {q.word.example && (
                  <>
                    {' '}
                    Ví dụ: <em>{q.word.example}</em>
                  </>
                )}
              </span>
            ) : (
              <span>
                Chưa đúng. Gợi ý: từ bắt đầu bằng chữ “
                {q.answer.trim().charAt(0)}”.
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Phần đề: từ tiếng Anh (hỏi nghĩa), nghĩa tiếng Việt (hỏi từ) hoặc câu có chỗ trống. */
function QuestionCard({
  q,
  answered,
  onListen,
}: {
  q: QuizQuestion;
  answered: boolean;
  onListen: () => void;
}) {
  // Hỏi từ tiếng Anh: chỉ cho nghe đọc sau khi đã trả lời, để không lộ đáp án.
  const canListen = q.mode === 'meaning' || answered;
  return (
    <div className="sticker flex flex-col items-center gap-3 bg-white px-6 py-8 text-center">
      {q.word.imageUrl && q.mode === 'meaning' && (
        <img
          src={q.word.imageUrl}
          alt=""
          className="size-32 rounded-xl border-[3px] border-ink object-cover"
        />
      )}
      {q.mode === 'meaning' && (
        <>
          <p className="font-display text-5xl leading-none font-extrabold break-all sm:text-6xl">
            {q.word.word}
          </p>
          {q.word.ipa && <p className="text-ink/60">{q.word.ipa}</p>}
        </>
      )}
      {q.mode === 'word' && (
        <p className="font-display text-4xl leading-tight font-extrabold sm:text-5xl">
          {q.word.meaning}
        </p>
      )}
      {q.mode === 'cloze' && q.cloze && (
        <>
          <p className="text-2xl leading-relaxed sm:text-3xl">
            {q.cloze.before}
            <span
              className={`mx-1 inline-block min-w-20 border-b-4 px-1 font-bold ${answered ? 'border-mint text-[#13734c]' : 'border-ink/60'}`}
            >
              {answered ? q.cloze.answer : ' '}
            </span>
            {q.cloze.after}
          </p>
          <p className="text-ink/60">({q.word.meaning})</p>
        </>
      )}
      {canListen && (
        <button
          type="button"
          onClick={onListen}
          className="sticker pressable mt-1 inline-flex cursor-pointer items-center gap-2 bg-sun px-4 py-2 font-display text-lg font-bold"
        >
          <Volume2 aria-hidden className="size-5" strokeWidth={2.5} />
          Nghe đọc
        </button>
      )}
    </div>
  );
}
