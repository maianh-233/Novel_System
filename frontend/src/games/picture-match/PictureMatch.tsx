import type { GameAnswer, GameProps, GameWord } from '@novel/shared';
import { Lightbulb, Timer, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { MuteButton } from '../shared/MuteButton';
import { playSfx } from '../shared/sfx';
import { buildBoards, isMatch, MAX_ATTEMPTS } from './logic';

const POINTS_PER_WORD = 10;
const NEXT_BOARD_DELAY_MS = 1100;

/** Màu cho từng cặp đã nối (theo thứ tự nối), kèm số thứ tự để không chỉ dựa vào màu. */
const PAIR_TINTS = [
  'bg-sun',
  'bg-mint',
  'bg-sky/60',
  'bg-violet/45',
  'bg-tomato/45',
];

type Selection = { kind: 'picture' | 'label'; id: string };

interface Pair {
  labelId: string;
  /** Thứ tự nối trong màn (1, 2, 3…) — số hiện trên cả hình và thẻ chữ. */
  order: number;
  /** true = em nối sai quá nhiều lần, máy hiện đáp án. */
  revealed: boolean;
}

type Feedback =
  | { kind: 'match'; word: GameWord }
  | { kind: 'revealed'; word: GameWord }
  | { kind: 'wrong' }
  | null;

/**
 * Picture Match — nối mỗi hình với từ tiếng Anh đúng. Bấm một hình rồi bấm một thẻ chữ
 * (hoặc ngược lại). Mỗi lượt chia thành vài màn nhỏ, số cặp mỗi màn theo cấp độ.
 * Chỉ nối đúng ngay lần đầu mới tính "đúng"; sai quá MAX_ATTEMPTS lần thì hiện đáp án.
 */
export function PictureMatch({ content, timeLimitSec, onFinish }: GameProps) {
  const boards = useMemo(
    () => buildBoards(content.words, content.level),
    [content],
  );
  const pronounce = usePronounce();
  // Cấp 1–2: bấm thẻ chữ là nghe đọc luôn. Cấp 3: phải tự đọc, chỉ nghe khi đã nối đúng.
  const readOnTap = content.level < 3;

  const [boardIndex, setBoardIndex] = useState(0);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [pairs, setPairs] = useState<Record<string, Pair>>({});
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [shake, setShake] = useState<{
    pictureId: string;
    labelId: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
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

  // Đếm ngược khi game có giới hạn thời gian; hết giờ thì nộp những cặp đã nối.
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

  // Rung xong thì bỏ trạng thái rung, để lần sai sau rung lại được.
  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(null), 400);
    return () => clearTimeout(t);
  }, [shake]);

  const board = boards[boardIndex];
  const boardDone =
    !!board && board.pictures.every((p) => pairs[p.id] !== undefined);

  // Nối xong cả màn: chờ một chút cho em nhìn lại, rồi sang màn sau (hoặc kết thúc).
  useEffect(() => {
    if (!boardDone) return;
    const last = boardIndex + 1 >= boards.length;
    if (last) playSfx('win');
    const t = setTimeout(() => {
      if (last) {
        finish();
        return;
      }
      setBoardIndex(boardIndex + 1);
      setPairs({});
      setMisses({});
      setSelected(null);
      setFeedback(null);
    }, NEXT_BOARD_DELAY_MS);
    return () => clearTimeout(t);
  }, [boardDone, boardIndex, boards.length, finish]);

  if (!board) return null;

  const pairedLabels = new Map(Object.values(pairs).map((p) => [p.labelId, p]));
  const nextOrder = Object.keys(pairs).length + 1;
  const wordsBefore = boards
    .slice(0, boardIndex)
    .reduce((n, b) => n + b.pictures.length, 0);
  const doneCount = wordsBefore + Object.keys(pairs).length;

  const tryMatch = (picture: GameWord, label: GameWord) => {
    setSelected(null);
    if (isMatch(picture, label)) {
      const attempts = (misses[picture.id] ?? 0) + 1;
      answers.current.push({
        vocabularyId: picture.id,
        correct: attempts === 1,
        attempts,
      });
      setPairs({
        ...pairs,
        [picture.id]: { labelId: label.id, order: nextOrder, revealed: false },
      });
      setFeedback({ kind: 'match', word: picture });
      playSfx('correct');
      pronounce(picture.word, picture.audioUrl);
      return;
    }

    playSfx('wrong');
    const missed = (misses[picture.id] ?? 0) + 1;
    setMisses({ ...misses, [picture.id]: missed });
    setShake({ pictureId: picture.id, labelId: label.id });
    if (missed < MAX_ATTEMPTS) {
      setFeedback({ kind: 'wrong' });
      return;
    }
    // Sai quá nhiều: hiện đáp án, khoá cặp này lại và tính là sai.
    const answer = board.labels.find(
      (l) => !pairedLabels.has(l.id) && isMatch(picture, l),
    );
    if (!answer) return;
    answers.current.push({
      vocabularyId: picture.id,
      correct: false,
      attempts: missed,
    });
    setPairs({
      ...pairs,
      [picture.id]: { labelId: answer.id, order: nextOrder, revealed: true },
    });
    setFeedback({ kind: 'revealed', word: picture });
    pronounce(picture.word, picture.audioUrl);
  };

  const pickPicture = (picture: GameWord) => {
    if (boardDone || pairs[picture.id]) return;
    if (selected?.kind === 'label') {
      const label = board.labels.find((l) => l.id === selected.id);
      if (label) return tryMatch(picture, label);
    }
    setSelected(
      selected?.kind === 'picture' && selected.id === picture.id
        ? null
        : { kind: 'picture', id: picture.id },
    );
  };

  const pickLabel = (label: GameWord) => {
    if (boardDone || pairedLabels.has(label.id)) return;
    if (selected?.kind === 'picture') {
      const picture = board.pictures.find((p) => p.id === selected.id);
      if (picture) return tryMatch(picture, label);
    }
    if (readOnTap) pronounce(label.word, label.audioUrl);
    setSelected(
      selected?.kind === 'label' && selected.id === label.id
        ? null
        : { kind: 'label', id: label.id },
    );
  };

  const tint = (pair: Pair) =>
    pair.revealed
      ? 'bg-grid'
      : PAIR_TINTS[(pair.order - 1) % PAIR_TINTS.length];

  const isShaking = (kind: Selection['kind'], id: string) =>
    shake !== null &&
    (kind === 'picture' ? shake.pictureId === id : shake.labelId === id);

  const selectedRing = 'ring-4 ring-sky ring-offset-2 -translate-y-1';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4 font-display text-lg font-bold">
        <span>
          {boards.length > 1
            ? `Màn ${boardIndex + 1}/${boards.length}`
            : `${content.words.length} cặp`}
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
          style={{ width: `${(doneCount / content.words.length) * 100}%` }}
        />
      </div>

      <p className="text-center font-display text-xl font-bold">
        Bấm vào một hình, rồi bấm vào từ đúng với hình đó.
      </p>

      <div
        key={boardIndex}
        className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-10"
      >
        <ul className="flex flex-col gap-3" aria-label="Các hình">
          {board.pictures.map((p, i) => {
            const pair = pairs[p.id];
            const active = selected?.kind === 'picture' && selected.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickPicture(p)}
                  disabled={!!pair}
                  aria-pressed={active}
                  aria-label={
                    pair
                      ? `Hình ${i + 1}: ${p.word}`
                      : `Hình ${i + 1}${active ? ', đang chọn' : ''}`
                  }
                  className={`sticker pressable relative flex h-24 w-full cursor-pointer items-center justify-center p-2 transition-transform disabled:cursor-default sm:h-28 ${
                    pair ? tint(pair) : 'bg-white hover:bg-paper'
                  } ${active ? selectedRing : ''} ${
                    isShaking('picture', p.id) ? 'animate-wiggle' : ''
                  }`}
                >
                  {brokenImages.has(p.id) || !p.imageUrl ? (
                    <span className="text-center font-bold text-ink/80">
                      {p.meaning}
                    </span>
                  ) : (
                    <img
                      src={p.imageUrl}
                      alt=""
                      draggable={false}
                      onError={() =>
                        setBrokenImages((s) => new Set(s).add(p.id))
                      }
                      className="h-full max-h-24 w-auto object-contain select-none"
                    />
                  )}
                  {pair && <PairBadge order={pair.order} />}
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="flex flex-col gap-3" aria-label="Các từ">
          {board.labels.map((l) => {
            const pair = pairedLabels.get(l.id);
            const active = selected?.kind === 'label' && selected.id === l.id;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => pickLabel(l)}
                  disabled={!!pair}
                  aria-pressed={active}
                  className={`sticker pressable relative flex h-24 w-full cursor-pointer items-center justify-center gap-2 px-3 text-center font-display text-2xl leading-tight font-extrabold break-words transition-transform disabled:cursor-default sm:h-28 sm:text-3xl ${
                    pair ? tint(pair) : 'bg-white hover:bg-paper'
                  } ${active ? selectedRing : ''} ${
                    isShaking('label', l.id) ? 'animate-wiggle' : ''
                  }`}
                >
                  <span className="min-w-0">{l.word}</span>
                  {pair && <PairBadge order={pair.order} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div aria-live="polite" className="min-h-16 text-center">
        {feedback?.kind === 'match' && (
          <p className="inline-flex flex-wrap items-center justify-center gap-2 font-display text-2xl font-extrabold text-[#13734c]">
            Đúng rồi! <span className="text-ink">{feedback.word.word}</span>
            <span className="font-sans text-lg font-normal text-ink/75">
              = {feedback.word.meaning}
            </span>
            <ListenAgain word={feedback.word} onListen={pronounce} />
          </p>
        )}
        {feedback?.kind === 'revealed' && (
          <p className="inline-flex flex-wrap items-center justify-center gap-2 font-display text-xl font-bold">
            Hình này là “{feedback.word.word}” ({feedback.word.meaning}). Em nhớ
            nhé!
            <ListenAgain word={feedback.word} onListen={pronounce} />
          </p>
        )}
        {feedback?.kind === 'wrong' && (
          <p className="inline-flex items-start gap-2 text-ink/80">
            <Lightbulb
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-[#b07d00]"
            />
            <span>
              Chưa khớp rồi, em nhìn kỹ hình và thử lại nhé.
              {readOnTap && ' Bấm vào từ để nghe đọc.'}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function PairBadge({ order }: { order: number }) {
  return (
    <span
      aria-hidden
      className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full border-2 border-ink bg-white font-display text-sm font-extrabold"
    >
      {order}
    </span>
  );
}

function ListenAgain({
  word,
  onListen,
}: {
  word: GameWord;
  onListen: (word: string, audioUrl?: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onListen(word.word, word.audioUrl)}
      aria-label={`Nghe lại ${word.word}`}
      className="sticker pressable grid size-10 cursor-pointer place-items-center bg-sun text-ink"
    >
      <Volume2 aria-hidden className="size-5" strokeWidth={2.5} />
    </button>
  );
}
