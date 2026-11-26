import type { GameProps } from '@novel/shared';
import { Lightbulb, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { GameHeader } from '../shared/GameHeader';
import { playSfx } from '../shared/sfx';
import { useGameRound } from '../shared/useGameRound';
import {
  blankPositions,
  buildPuzzles,
  fits,
  MAX_MISSES,
  missingLettersProfile,
  type Puzzle,
  type Tile,
} from './logic';

const NEXT_DELAY_MS = { correct: 1000, revealed: 2200 };

/**
 * Missing Letters — điền chữ cái còn thiếu vào từ. Em bấm chữ trên bàn phím của game
 * (hoặc gõ bằng bàn phím thật); chữ đúng rơi vào ô trống kế tiếp, chữ sai rung lên.
 * Chỉ điền đúng hết mà không sai lần nào mới tính "đúng"; sai MAX_MISSES lần thì hiện cả từ.
 */
export function MissingLetters(props: GameProps) {
  const { content, timeLimitSec } = props;
  const { record, finish, timeLeft } = useGameRound(props);
  const puzzles = useMemo(
    () =>
      buildPuzzles(content.words, content.level, Math.random, content.stage),
    [content],
  );
  const profile = missingLettersProfile(content.stage, content.level);
  const pronounce = usePronounce();

  const [index, setIndex] = useState(0);
  /** id các phím đã dùng, theo thứ tự điền vào ô trống. */
  const [used, setUsed] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [shakeTile, setShakeTile] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<'correct' | 'revealed' | null>(null);

  const p = puzzles[index];

  // Tiểu học cấp 1: tự đọc từ khi sang từ mới, để em vừa nghe vừa nhìn.
  const readAloud = profile.readAloud;
  useEffect(() => {
    if (readAloud && p) pronounce(p.word.word, p.word.audioUrl);
  }, [readAloud, p, pronounce]);

  // Rung xong thì bỏ trạng thái rung, để lần sai sau rung lại được.
  useEffect(() => {
    if (shakeTile === null) return;
    const t = setTimeout(() => setShakeTile(null), 400);
    return () => clearTimeout(t);
  }, [shakeTile]);

  // Xong một từ: chờ một chút cho em nhìn lại, rồi sang từ tiếp (hoặc kết thúc).
  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => {
      if (index + 1 >= puzzles.length) {
        finish();
        return;
      }
      setIndex(index + 1);
      setUsed([]);
      setMisses(0);
      setOutcome(null);
    }, NEXT_DELAY_MS[outcome]);
    return () => clearTimeout(t);
  }, [outcome, index, puzzles.length, finish]);

  const tap = (tile: Tile) => {
    if (!p || outcome || used.includes(tile.id)) return;
    const blanks = blankPositions(p);
    const position = blanks[used.length];
    if (position === undefined) return;

    if (fits(p, position, tile.letter)) {
      const next = [...used, tile.id];
      setUsed(next);
      if (next.length === blanks.length) {
        record({
          vocabularyId: p.word.id,
          correct: misses === 0,
          attempts: misses + 1,
        });
        playSfx('correct');
        pronounce(p.word.word, p.word.audioUrl);
        setOutcome('correct');
      }
      return;
    }

    playSfx('wrong');
    setShakeTile(tile.id);
    const missed = misses + 1;
    setMisses(missed);
    if (missed >= MAX_MISSES) {
      record({ vocabularyId: p.word.id, correct: false, attempts: missed });
      pronounce(p.word.word, p.word.audioUrl);
      setOutcome('revealed');
    } else if (missed === 1 && !readAloud) {
      // Gợi ý lần đầu sai: đọc to từ (nếu chưa được nghe từ đầu).
      pronounce(p.word.word, p.word.audioUrl);
    }
  };

  // Gõ bằng bàn phím thật: chữ nào còn trên bàn phím của game thì coi như bấm phím đó.
  const typeLetter = (letter: string) => {
    const tile = p?.tiles.find(
      (t) => t.letter === letter && !used.includes(t.id),
    );
    if (!tile) return false;
    tap(tile);
    return true;
  };
  const typeRef = useRef(typeLetter);
  useEffect(() => {
    typeRef.current = typeLetter;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (typeRef.current(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!p) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <GameHeader
        label={`Từ ${index + 1}/${puzzles.length}`}
        progress={index / puzzles.length}
        timeLimitSec={timeLimitSec}
        timeLeft={timeLeft}
      />

      <div className="sticker flex flex-col items-center gap-4 bg-white px-4 py-6 text-center sm:px-6">
        <div className="flex items-center gap-4">
          {profile.showImage && p.word.imageUrl && (
            <img
              src={p.word.imageUrl}
              alt=""
              className="size-24 rounded-xl border-[3px] border-ink object-contain sm:size-28"
            />
          )}
          <div className="flex flex-col items-start gap-2 text-left">
            <p className="text-lg text-ink/75">
              Nghĩa: <strong className="text-ink">{p.word.meaning}</strong>
            </p>
            <button
              type="button"
              onClick={() => pronounce(p.word.word, p.word.audioUrl)}
              className="sticker pressable inline-flex cursor-pointer items-center gap-2 bg-sun px-4 py-2 font-display text-lg font-bold whitespace-nowrap"
            >
              <Volume2 aria-hidden className="size-5" strokeWidth={2.5} />
              Nghe đọc
            </button>
          </div>
        </div>

        <WordSlots puzzle={p} usedCount={used.length} outcome={outcome} />
      </div>

      <p className="text-center font-display text-xl font-bold">
        {outcome ? ' ' : 'Bấm chữ cái còn thiếu nhé!'}
      </p>

      <ul
        className="flex flex-wrap justify-center gap-3"
        aria-label="Các chữ cái"
      >
        {p.tiles.map((t) => {
          const isUsed = used.includes(t.id);
          return (
            <li key={`${index}-${t.id}`}>
              <button
                type="button"
                onClick={() => tap(t)}
                disabled={isUsed || outcome !== null}
                className={`sticker pressable grid size-16 cursor-pointer place-items-center font-display text-4xl font-extrabold disabled:cursor-default sm:size-[4.5rem] ${
                  isUsed
                    ? 'border-dashed bg-transparent text-transparent shadow-none'
                    : shakeTile === t.id
                      ? 'animate-wiggle bg-tomato/25'
                      : 'bg-white hover:bg-paper'
                }`}
                aria-label={isUsed ? `${t.letter} (đã dùng)` : t.letter}
              >
                {t.letter}
              </button>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="min-h-14 text-center">
        {outcome === 'correct' && (
          <p className="font-display text-2xl font-extrabold text-[#13734c]">
            {misses === 0 ? 'Giỏi quá!' : 'Đúng rồi!'} “{p.word.word}” ={' '}
            {p.word.meaning}
          </p>
        )}
        {outcome === 'revealed' && (
          <p className="font-display text-xl font-bold">
            Từ đúng là “{p.word.word}”. Từ sau em làm tốt hơn nhé!
          </p>
        )}
        {!outcome && misses > 0 && (
          <p className="inline-flex items-start gap-2 text-ink/80">
            <Lightbulb
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-[#b07d00]"
            />
            <span>
              Chưa đúng rồi, em nghe lại và thử chữ khác nhé. (Còn{' '}
              {MAX_MISSES - misses} lần)
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/** Từ với các ô trống. Các chữ trong một từ con (tách bởi dấu cách) không bị xuống dòng giữa chừng. */
function WordSlots({
  puzzle,
  usedCount,
  outcome,
}: {
  puzzle: Puzzle;
  usedCount: number;
  outcome: 'correct' | 'revealed' | null;
}) {
  const blanks = blankPositions(puzzle);
  const filled = new Set(blanks.slice(0, usedCount));
  const current = outcome ? undefined : blanks[usedCount];
  const long = puzzle.slots.length > 8;

  // Tách thành các nhóm theo dấu cách.
  const groups: number[][] = [[]];
  puzzle.slots.forEach((s, i) => {
    if (s.char === ' ') groups.push([]);
    else groups[groups.length - 1].push(i);
  });

  const box = long
    ? 'h-11 w-8 text-2xl sm:h-14 sm:w-11 sm:text-4xl'
    : 'h-16 w-12 text-4xl sm:h-[4.5rem] sm:w-14 sm:text-5xl';

  return (
    <p
      className="flex w-full flex-wrap justify-center gap-x-5 gap-y-3"
      aria-label={`Từ cần điền: ${puzzle.slots
        .map((s, i) => (s.hidden && !filled.has(i) && !outcome ? '_' : s.char))
        .join('')}`}
    >
      {groups.map((g, gi) => (
        <span
          key={gi}
          className="flex max-w-full min-w-0 gap-1 sm:gap-1.5"
          aria-hidden
        >
          {g.map((i) => {
            const s = puzzle.slots[i];
            const show = !s.hidden || filled.has(i) || outcome !== null;
            const revealed =
              s.hidden && !filled.has(i) && outcome === 'revealed';
            return (
              <span
                key={i}
                className={`grid place-items-center rounded-lg font-display leading-none font-extrabold ${box} ${s.hidden ? 'shrink-0' : 'min-w-0 shrink'} ${
                  !s.hidden
                    ? ''
                    : `border-[3px] ${
                        revealed
                          ? 'border-tomato bg-tomato/15'
                          : filled.has(i)
                            ? 'border-ink bg-mint'
                            : i === current
                              ? 'animate-pulse border-sky bg-sky/10'
                              : 'border-dashed border-ink/50 bg-paper'
                      }`
                }`}
              >
                {show ? s.char : ''}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}
