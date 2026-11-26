import type { GameProps, GameWord } from '@novel/shared';
import { Check, Lightbulb, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { GameHeader } from '../shared/GameHeader';
import { playSfx } from '../shared/sfx';
import { useGameRound } from '../shared/useGameRound';
import { buildQuestions, isCorrect, MAX_ATTEMPTS } from './logic';

/** Chờ đủ lâu để em nghe hết từ được đọc to rồi mới sang câu sau. */
const NEXT_DELAY_MS = { correct: 1300, revealed: 2400 };

/**
 * Picture Quiz — nhìn hình, chọn từ tiếng Anh đúng. Bấm vào thẻ chữ hoặc nhấn phím số 1–4.
 * Sai lần đầu được gợi ý nghe đọc (cấp 1 tự đọc luôn); sai lần nữa thì hiện đáp án.
 * Chỉ chọn đúng ngay lần đầu mới tính là "đúng".
 */
export function PictureQuiz(props: GameProps) {
  const { content, timeLimitSec } = props;
  const { record, finish, timeLeft } = useGameRound(props);
  const questions = useMemo(
    () => buildQuestions(content.words, content.level),
    [content],
  );
  const pronounce = usePronounce();
  const [index, setIndex] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<'correct' | 'revealed' | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // Trả lời xong một câu: tự sang câu tiếp (hoặc kết thúc).
  useEffect(() => {
    if (!outcome) return;
    const last = index + 1 >= questions.length;
    if (last) playSfx('win');
    const t = setTimeout(() => {
      if (last) {
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

  const pick = (option: GameWord) => {
    if (!q || outcome || wrongPicks.includes(option.id)) return;
    const attempts = wrongPicks.length + 1;
    if (isCorrect(q, option)) {
      record({ vocabularyId: q.word.id, correct: attempts === 1, attempts });
      playSfx('correct');
      pronounce(q.word.word, q.word.audioUrl);
      setOutcome('correct');
      return;
    }
    playSfx('wrong');
    setWrongPicks([...wrongPicks, option.id]);
    if (attempts >= MAX_ATTEMPTS) {
      record({ vocabularyId: q.word.id, correct: false, attempts });
      pronounce(q.word.word, q.word.audioUrl);
      setOutcome('revealed');
    } else if (content.level === 1) {
      // Gợi ý cho em nhỏ: đọc to từ đúng.
      pronounce(q.word.word, q.word.audioUrl);
    }
  };

  // Máy có bàn phím: nhấn 1–4 để chọn.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const option = q?.options[n - 1];
      if (option) pick(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!q) return null;

  const showPicture = !!q.word.imageUrl && !brokenImages.has(q.word.id);
  const showHint = wrongPicks.length > 0 && outcome === null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <GameHeader
        label={`Câu ${index + 1}/${questions.length}`}
        progress={(index + (outcome ? 1 : 0)) / questions.length}
        timeLimitSec={timeLimitSec}
        timeLeft={timeLeft}
      />

      <div
        key={q.word.id}
        className={`sticker flex flex-col items-center gap-3 px-4 py-5 text-center sm:px-6 sm:py-6 ${
          outcome === 'correct' ? 'bg-mint/40' : 'bg-white'
        }`}
      >
        <div className="grid h-36 w-full place-items-center sm:h-56">
          {showPicture ? (
            <img
              src={q.word.imageUrl}
              alt="Hình cần đoán"
              draggable={false}
              onError={() => setBrokenImages((s) => new Set(s).add(q.word.id))}
              className="h-36 w-auto max-w-full object-contain select-none sm:h-56"
            />
          ) : (
            // Ảnh lỗi: hiện nghĩa tiếng Việt thay cho hình.
            <span className="font-display text-3xl font-bold text-ink/80">
              {q.word.meaning}
            </span>
          )}
        </div>
        {/* Luôn giữ chỗ cho dòng đáp án để các nút bên dưới không bị đẩy xuống. */}
        <div className="flex min-h-12 items-center justify-center">
          {outcome && (
            <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-display text-2xl font-extrabold sm:text-3xl">
              {q.word.word}
              <span className="font-sans text-lg font-normal text-ink/75">
                = {q.word.meaning}
              </span>
              <button
                type="button"
                onClick={() => pronounce(q.word.word, q.word.audioUrl)}
                aria-label={`Nghe lại ${q.word.word}`}
                className="sticker pressable grid size-10 cursor-pointer place-items-center bg-sun text-ink"
              >
                <Volume2 aria-hidden className="size-5" strokeWidth={2.5} />
              </button>
            </p>
          )}
        </div>
      </div>

      <p className="text-center font-display text-xl font-bold">
        Hình này là từ nào?
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {q.options.map((option, i) => {
          const wrong = wrongPicks.includes(option.id);
          const right = outcome !== null && isCorrect(q, option);
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => pick(option)}
                disabled={wrong || outcome !== null}
                className={`sticker pressable flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left font-display text-2xl font-extrabold disabled:cursor-default ${
                  right
                    ? 'bg-mint'
                    : wrong
                      ? 'animate-wiggle bg-tomato/25 text-ink/50 line-through'
                      : 'bg-white hover:bg-paper'
                }`}
              >
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper font-sans text-base font-bold"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {option.word}
                </span>
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
            Đáp án là “{q.word.word}”. Câu sau em làm tốt hơn nhé!
          </p>
        )}
        {showHint && (
          <p className="inline-flex flex-wrap items-center justify-center gap-2 text-ink/80">
            <Lightbulb aria-hidden className="size-5 shrink-0 text-[#b07d00]" />
            <span>Chưa đúng rồi, em nghe gợi ý và thử lần nữa nhé.</span>
            <button
              type="button"
              onClick={() => pronounce(q.word.word, q.word.audioUrl)}
              className="sticker pressable inline-flex cursor-pointer items-center gap-1.5 bg-sun px-3 py-1.5 font-display font-bold text-ink"
            >
              <Volume2 aria-hidden className="size-4" strokeWidth={2.5} />
              Nghe gợi ý
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
