import type { GameProps, GameWord } from '@novel/shared';
import { Lightbulb, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { GameHeader } from '../shared/GameHeader';
import { playSfx } from '../shared/sfx';
import { useGameRound } from '../shared/useGameRound';
import { buildBoards, isMatch, MAX_ATTEMPTS } from './logic';

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
export function PictureMatch(props: GameProps) {
  const { content, timeLimitSec } = props;
  const { record, finish, timeLeft } = useGameRound(props);
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
      record({
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
    record({
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
      <GameHeader
        label={
          boards.length > 1
            ? `Màn ${boardIndex + 1}/${boards.length}`
            : `${content.words.length} cặp`
        }
        progress={doneCount / content.words.length}
        timeLimitSec={timeLimitSec}
        timeLeft={timeLeft}
      />

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
