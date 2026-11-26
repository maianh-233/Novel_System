import type { GameAnswer, GameProps } from '@novel/shared';
import { Check, Lightbulb, Timer, Volume2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { MuteButton } from '../shared/MuteButton';
import { playSfx } from '../shared/sfx';
import { buildQuestions, isCorrect, MAX_ATTEMPTS } from './logic';

const POINTS_PER_WORD = 10;
const NEXT_DELAY_MS = { correct: 700, revealed: 1800 };

/**
 * Word Quiz — game thử của Giai đoạn 3: đọc từ tiếng Anh, chọn nghĩa đúng.
 * Sai lần đầu được gợi ý và thử lại; sai lần nữa thì hiện đáp án rồi sang câu tiếp.
 * Chỉ trả lời đúng ngay lần đầu mới tính là "đúng".
 */
export function WordQuiz({ content, timeLimitSec, onFinish }: GameProps) {
  const questions = useMemo(
    () => buildQuestions(content.words, content.level),
    [content],
  );
  const pronounce = usePronounce();
  const [index, setIndex] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<'correct' | 'revealed' | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const answers = useRef<GameAnswer[]>([]);
  const startedAt = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const list = answers.current;
    onFinish({
      sessionId: content.sessionId,
      score: list.filter((a) => a.correct).length * POINTS_PER_WORD,
      durationMs: Date.now() - startedAt.current,
      answers: list,
    });
  }, [content.sessionId, onFinish]);

  // Đếm ngược khi game có giới hạn thời gian; hết giờ thì nộp những câu đã làm.
  useEffect(() => {
    if (timeLimitSec <= 0) return;
    const t = setInterval(() => {
      const left =
        timeLimitSec - Math.floor((Date.now() - startedAt.current) / 1000);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) finish();
    }, 250);
    return () => clearInterval(t);
  }, [timeLimitSec, finish]);

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
      answers.current.push({
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
      answers.current.push({
        vocabularyId: q.word.id,
        correct: false,
        attempts,
      });
      setOutcome('revealed');
    } else {
      // Gợi ý: đọc to từ một lần nữa.
      pronounce(q.word.word, q.word.audioUrl);
    }
  };

  const showHint = wrongPicks.length > 0 && outcome !== 'correct';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4 font-display text-lg font-bold">
        <span>
          Câu {index + 1}/{questions.length}
        </span>
        <span className="flex items-center gap-3">
          {timeLimitSec > 0 && (
            <span
              className={`inline-flex items-center gap-1.5 ${timeLeft <= 10 ? 'text-tomato' : ''}`}
            >
              <Timer aria-hidden className="size-5" />
              <span aria-label={`Còn ${timeLeft} giây`}>{timeLeft}s</span>
            </span>
          )}
          <MuteButton />
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white"
        aria-hidden
      >
        <div
          className="h-full bg-mint transition-[width] duration-300"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      <div className="sticker flex flex-col items-center gap-3 bg-white px-6 py-8 text-center">
        {q.word.imageUrl && (
          <img
            src={q.word.imageUrl}
            alt=""
            className="size-32 rounded-xl border-[3px] border-ink object-cover"
          />
        )}
        <p className="font-display text-5xl leading-none font-extrabold break-all sm:text-6xl">
          {q.word.word}
        </p>
        {q.word.ipa && <p className="text-ink/60">{q.word.ipa}</p>}
        <button
          type="button"
          onClick={() => pronounce(q.word.word, q.word.audioUrl)}
          className="sticker pressable mt-1 inline-flex cursor-pointer items-center gap-2 bg-sun px-4 py-2 font-display text-lg font-bold"
        >
          <Volume2 aria-hidden className="size-5" strokeWidth={2.5} />
          Nghe đọc
        </button>
      </div>

      <p className="text-center font-display text-xl font-bold">
        Từ này nghĩa là gì?
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
            Đáp án là “{q.word.meaning}”. Câu sau em làm tốt hơn nhé!
          </p>
        )}
        {showHint && outcome === null && (
          <p className="inline-flex items-start gap-2 text-ink/80">
            <Lightbulb
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-[#b07d00]"
            />
            <span>
              Chưa đúng rồi, em nghe lại và thử lần nữa nhé.
              {q.word.example && (
                <>
                  {' '}
                  Ví dụ: <em>{q.word.example}</em>
                </>
              )}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
