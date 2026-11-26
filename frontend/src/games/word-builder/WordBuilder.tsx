import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { GameProps } from '@novel/shared';
import { Lightbulb, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { GameHeader } from '../shared/GameHeader';
import { playSfx } from '../shared/sfx';
import { useGameRound } from '../shared/useGameRound';
import {
  buildPuzzles,
  MAX_ATTEMPTS,
  openSlots,
  wrongSlots,
  type Puzzle,
  type Tile,
} from './logic';

const NEXT_DELAY_MS = { correct: 1100, revealed: 2400 };
const SHAKE_MS = 550;

type Outcome = 'correct' | 'revealed' | null;

/**
 * Word Builder — xếp các chữ cái lộn xộn thành từ đúng. Chạm một chữ để đưa vào ô trống
 * kế tiếp, chạm chữ trong ô để bỏ ra; kéo thả hoặc gõ bàn phím thật cũng được.
 * Xếp kín thì máy tự kiểm tra: ô đúng được giữ lại (tô xanh), ô sai rung rồi trả chữ về.
 * Chỉ xếp đúng ngay lần đầu mới tính "đúng"; sai MAX_ATTEMPTS lần thì hiện cả từ.
 */
export function WordBuilder(props: GameProps) {
  const { content, timeLimitSec } = props;
  const { record, finish, timeLeft } = useGameRound(props);
  const puzzles = useMemo(
    () => buildPuzzles(content.words, content.level),
    [content],
  );
  const pronounce = usePronounce();

  const [index, setIndex] = useState(0);
  /** Vị trí ô → id chữ đang nằm trong ô đó. */
  const [placed, setPlaced] = useState<Record<number, number>>({});
  /** Ô đã kiểm tra là đúng — không bỏ ra được nữa. */
  const [locked, setLocked] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [shaking, setShaking] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [dragging, setDragging] = useState<Tile | null>(null);

  const p = puzzles[index];
  const busy = outcome !== null || shaking.length > 0;

  // Ô sai rung xong thì trả chữ về đống chữ.
  useEffect(() => {
    if (shaking.length === 0) return;
    const t = setTimeout(() => {
      setPlaced((cur) => {
        const next = { ...cur };
        for (const slot of shaking) delete next[slot];
        return next;
      });
      setShaking([]);
    }, SHAKE_MS);
    return () => clearTimeout(t);
  }, [shaking]);

  // Xong một từ: chờ một chút cho em nhìn lại, rồi sang từ tiếp (hoặc kết thúc).
  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => {
      if (index + 1 >= puzzles.length) {
        finish();
        return;
      }
      setIndex(index + 1);
      setPlaced({});
      setLocked([]);
      setAttempts(0);
      setOutcome(null);
    }, NEXT_DELAY_MS[outcome]);
    return () => clearTimeout(t);
  }, [outcome, index, puzzles.length, finish]);

  const check = (puzzle: Puzzle, next: Record<number, number>) => {
    const wrong = wrongSlots(puzzle, next);
    const tries = attempts + 1;
    setAttempts(tries);
    if (wrong.length === 0) {
      record({
        vocabularyId: puzzle.word.id,
        correct: tries === 1,
        attempts: tries,
      });
      playSfx('correct');
      pronounce(puzzle.word.word, puzzle.word.audioUrl);
      setOutcome('correct');
      return;
    }
    playSfx('wrong');
    if (tries >= MAX_ATTEMPTS) {
      record({ vocabularyId: puzzle.word.id, correct: false, attempts: tries });
      pronounce(puzzle.word.word, puzzle.word.audioUrl);
      setOutcome('revealed');
      return;
    }
    setLocked(openSlots(puzzle).filter((s) => !wrong.includes(s)));
    setShaking(wrong);
    if (tries === 1) pronounce(puzzle.word.word, puzzle.word.audioUrl);
  };

  /** Đặt chữ vào ô `slot` (mặc định: ô trống đầu tiên). Ô đã có chữ thì đổi chỗ. */
  const place = (tileId: number, slot?: number) => {
    if (!p || busy) return;
    const open = openSlots(p);
    const target = slot ?? open.find((s) => placed[s] === undefined);
    if (target === undefined || !open.includes(target)) return;
    if (locked.includes(target)) return;
    const from = Object.entries(placed).find(([, id]) => id === tileId)?.[0];
    if (from !== undefined && Number(from) === target) return;

    const next = { ...placed };
    const occupant = next[target];
    if (from !== undefined) delete next[Number(from)];
    next[target] = tileId;
    // Ô đích đã có chữ: chữ đó sang ô chữ kia vừa rời đi (nếu có), không thì về đống chữ.
    if (occupant !== undefined && from !== undefined)
      next[Number(from)] = occupant;
    setPlaced(next);
    if (open.every((s) => next[s] !== undefined)) check(p, next);
  };

  const remove = (slot: number) => {
    if (busy || locked.includes(slot) || placed[slot] === undefined) return;
    const next = { ...placed };
    delete next[slot];
    setPlaced(next);
  };

  // Bàn phím thật: gõ chữ để xếp, Backspace để bỏ chữ cuối cùng ra.
  const onKey = (e: KeyboardEvent) => {
    if (!p || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') {
      const last = openSlots(p)
        .filter((s) => placed[s] !== undefined && !locked.includes(s))
        .pop();
      if (last !== undefined) {
        e.preventDefault();
        remove(last);
      }
      return;
    }
    if (e.key.length !== 1) return;
    const inUse = new Set(Object.values(placed));
    const tile = p.tiles.find(
      (t) => !inUse.has(t.id) && t.letter.toLowerCase() === e.key.toLowerCase(),
    );
    if (!tile) return;
    e.preventDefault();
    place(tile.id);
  };
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Kéo phải di chuyển một đoạn mới tính là kéo — chạm nhẹ vẫn là bấm.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  if (!p) return null;

  const tileById = new Map(p.tiles.map((t) => [t.id, t]));
  const inUse = new Set(Object.values(placed));

  const onDragStart = (e: DragStartEvent) =>
    setDragging(tileById.get(Number(e.active.id)) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const tileId = Number(e.active.id);
    const over = e.over?.id;
    if (typeof over !== 'string') return;
    if (over === 'pool') {
      const from = Object.entries(placed).find(([, id]) => id === tileId);
      if (from) remove(Number(from[0]));
    } else if (over.startsWith('slot-')) {
      place(tileId, Number(over.slice(5)));
    }
  };

  // Tách thành các nhóm theo dấu cách, để cụm từ xuống dòng giữa các từ.
  const groups: number[][] = [[]];
  p.slots.forEach((s, i) => {
    if (s.char === ' ') groups.push([]);
    else groups[groups.length - 1].push(i);
  });
  const long = p.slots.length > 8;
  const box = long
    ? 'h-12 w-9 text-2xl sm:h-14 sm:w-11 sm:text-4xl'
    : 'h-16 w-12 text-4xl sm:h-[4.5rem] sm:w-14 sm:text-5xl';

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <GameHeader
          label={`Từ ${index + 1}/${puzzles.length}`}
          progress={index / puzzles.length}
          timeLimitSec={timeLimitSec}
          timeLeft={timeLeft}
        />

        <div className="sticker flex flex-col items-center gap-5 bg-white px-4 py-6 text-center sm:px-6">
          <div className="flex items-center gap-4">
            {p.word.imageUrl && (
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

          <div
            className="flex w-full flex-wrap justify-center gap-x-5 gap-y-3"
            role="group"
            aria-label={`Từ đang xếp: ${p.slots
              .map((s, i) =>
                !s.isLetter || s.given || outcome
                  ? s.char
                  : placed[i] !== undefined
                    ? tileById.get(placed[i])?.letter
                    : '_',
              )
              .join('')}`}
          >
            {groups.map((g, gi) => (
              <span
                key={gi}
                className="flex max-w-full min-w-0 gap-1 sm:gap-1.5"
              >
                {g.map((i) => {
                  const s = p.slots[i];
                  if (!s.isLetter || s.given) {
                    return (
                      <span
                        key={i}
                        aria-hidden
                        className={`grid min-w-0 shrink place-items-center rounded-lg border-[3px] border-transparent font-display leading-none font-extrabold ${box}`}
                      >
                        {s.char}
                      </span>
                    );
                  }
                  const tile =
                    placed[i] !== undefined
                      ? tileById.get(placed[i])
                      : undefined;
                  return (
                    <SlotBox
                      key={`${index}-${i}`}
                      slot={i}
                      box={box}
                      state={
                        outcome === 'revealed' && !locked.includes(i)
                          ? 'revealed'
                          : outcome === 'correct' || locked.includes(i)
                            ? 'locked'
                            : shaking.includes(i)
                              ? 'wrong'
                              : 'open'
                      }
                    >
                      {outcome === 'revealed' && !locked.includes(i) ? (
                        s.char
                      ) : tile ? (
                        <DragTile
                          tile={tile}
                          disabled={busy || locked.includes(i)}
                          onTap={() => remove(i)}
                          variant="slot"
                          label={`${tile.letter} (bấm để bỏ ra)`}
                        />
                      ) : null}
                    </SlotBox>
                  );
                })}
              </span>
            ))}
          </div>
        </div>

        <p className="text-center font-display text-xl font-bold">
          {outcome ? ' ' : 'Chạm hoặc kéo các chữ cái để xếp thành từ nhé!'}
        </p>

        <Pool>
          {p.tiles.map((t) =>
            inUse.has(t.id) ? (
              <li
                key={`${index}-${t.id}`}
                aria-hidden
                className="size-14 rounded-[1.25rem] border-[3px] border-dashed border-ink/25 sm:size-[4.5rem]"
              />
            ) : (
              <li key={`${index}-${t.id}`}>
                <DragTile
                  tile={t}
                  disabled={busy}
                  onTap={() => place(t.id)}
                  variant="pool"
                  label={t.letter}
                />
              </li>
            ),
          )}
        </Pool>

        <div aria-live="polite" className="min-h-14 text-center">
          {outcome === 'correct' && (
            <p className="font-display text-2xl font-extrabold text-[#13734c]">
              {attempts === 1 ? 'Giỏi quá!' : 'Đúng rồi!'} “{p.word.word}” ={' '}
              {p.word.meaning}
            </p>
          )}
          {outcome === 'revealed' && (
            <p className="font-display text-xl font-bold">
              Từ đúng là “{p.word.word}”. Từ sau em làm tốt hơn nhé!
            </p>
          )}
          {!outcome && attempts > 0 && (
            <p className="inline-flex items-start gap-2 text-ink/80">
              <Lightbulb
                aria-hidden
                className="mt-0.5 size-5 shrink-0 text-[#b07d00]"
              />
              <span>
                Ô xanh là đúng rồi. Em nghe lại và xếp lại các ô còn lại nhé.
                (Còn {MAX_ATTEMPTS - attempts} lần)
              </span>
            </p>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <span className="sticker grid size-14 rotate-6 place-items-center bg-sun font-display text-3xl font-extrabold sm:size-[4.5rem] sm:text-4xl">
            {dragging.letter}
          </span>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Đống chữ — thả chữ vào đây để bỏ chữ ra khỏi ô. */
function Pool({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return (
    <ul
      ref={setNodeRef}
      aria-label="Các chữ cái"
      className={`flex min-h-20 flex-wrap justify-center gap-2.5 rounded-2xl sm:gap-3 p-1 transition-colors ${isOver ? 'bg-sky/10' : ''}`}
    >
      {children}
    </ul>
  );
}

function SlotBox({
  slot,
  box,
  state,
  children,
}: {
  slot: number;
  box: string;
  state: 'open' | 'locked' | 'wrong' | 'revealed';
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot}`,
    disabled: state !== 'open',
  });
  const look = {
    open: isOver
      ? 'border-sky bg-sky/15'
      : 'border-dashed border-ink/50 bg-paper',
    locked: 'border-ink bg-mint',
    wrong: 'animate-wiggle border-tomato bg-tomato/25',
    revealed: 'border-tomato bg-tomato/15',
  }[state];
  return (
    <span
      ref={setNodeRef}
      data-slot={slot}
      className={`grid min-w-0 shrink place-items-center rounded-lg border-[3px] font-display leading-none font-extrabold ${box} ${look}`}
    >
      {children}
    </span>
  );
}

function DragTile({
  tile,
  disabled,
  onTap,
  variant,
  label,
}: {
  tile: Tile;
  disabled: boolean;
  onTap: () => void;
  /** pool: phím chữ trong đống chữ; slot: chữ đang nằm trong ô (lấp kín ô). */
  variant: 'pool' | 'slot';
  label: string;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: String(tile.id),
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onTap}
      disabled={disabled}
      aria-label={label}
      // Chặn cuộn trang khi bắt đầu kéo chữ trên máy tính bảng.
      style={{ touchAction: 'none' }}
      className={`grid cursor-pointer place-items-center font-display leading-none font-extrabold select-none disabled:cursor-default ${
        isDragging ? 'opacity-30' : ''
      } ${
        variant === 'slot'
          ? 'size-full rounded-[inherit]'
          : 'sticker pressable size-14 bg-white text-3xl hover:bg-paper sm:size-[4.5rem] sm:text-4xl'
      }`}
    >
      {tile.letter}
    </button>
  );
}
