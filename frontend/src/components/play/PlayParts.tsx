import type { FinishSessionResponse, PlayLesson } from '@novel/shared';
import { BookOpen, Home, RotateCcw, Star, Volume2 } from 'lucide-react';
import {
  Component,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { usePronounce } from '../../hooks/usePronounce';
import { LEVEL_LABEL } from '../../utils/levels';

const LEVEL_BG = { 1: 'bg-mint', 2: 'bg-sun', 3: 'bg-tomato' } as const;

/** Nút lớn kiểu sticker dùng trong khu chơi. */
export function BigButton({
  children,
  tint = 'bg-white',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tint?: string }) {
  return (
    <button
      type="button"
      {...props}
      className={`sticker pressable inline-flex cursor-pointer items-center justify-center gap-2 px-5 py-3 font-display text-xl font-bold disabled:cursor-wait disabled:opacity-70 ${tint}`}
    >
      {children}
    </button>
  );
}

// ───────────── Chọn bài học ─────────────

export function LessonPicker({
  lessons,
  onPick,
  busyLessonId,
}: {
  lessons: PlayLesson[];
  onPick: (id: string) => void;
  busyLessonId?: string;
}) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {lessons.map((l, i) => (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => onPick(l.id)}
            disabled={busyLessonId !== undefined}
            className={`sticker pressable flex h-full w-full cursor-pointer flex-col bg-white p-5 text-left disabled:cursor-wait ${i % 2 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'} hover:rotate-0 ${busyLessonId === l.id ? 'opacity-70' : ''}`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="font-display text-2xl leading-tight font-extrabold">
                {l.title}
              </span>
              <span
                className={`shrink-0 rounded-full border-2 border-ink px-2.5 py-0.5 text-sm font-bold ${LEVEL_BG[l.level]}`}
              >
                {LEVEL_LABEL[l.level]}
              </span>
            </span>
            {l.description && (
              <span className="mt-1 text-ink/70">{l.description}</span>
            )}
            <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm text-ink/60">
              <BookOpen aria-hidden className="size-4" />
              {l.questionCount > 0
                ? `${l.questionCount} câu hỏi`
                : `${l.wordCount} từ`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ───────────── Đếm ngược 3-2-1 ─────────────

export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  // Giữ hàm mới nhất trong ref: trang cha vẽ lại không làm đếm ngược bắt đầu lại.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (n === 0) {
      done.current();
      return;
    }
    const t = setTimeout(() => setN(n - 1), 700);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <div
      className="grid min-h-[50dvh] place-items-center"
      role="status"
      aria-live="assertive"
    >
      <span
        key={n}
        style={{ '--tilt': n % 2 ? '-6deg' : '6deg' } as CSSProperties}
        className="sticker grid size-40 animate-tile-drop place-items-center bg-sun font-display text-8xl font-extrabold"
      >
        {n || 'Đi!'}
      </span>
    </div>
  );
}

// ───────────── Sao ─────────────

export function Stars({ count }: { count: number }) {
  return (
    <div
      className="flex justify-center gap-3"
      role="img"
      aria-label={`${count} trên 3 sao`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={
            {
              '--tilt': `${(i - 1) * 8}deg`,
              animationDelay: `${i * 180}ms`,
            } as CSSProperties
          }
          className={`animate-tile-drop ${i === 1 ? '-mt-4' : ''}`}
        >
          <Star
            aria-hidden
            strokeWidth={2.5}
            className={`size-20 sm:size-24 ${i < count ? 'fill-sun text-ink' : 'fill-white text-ink/25'}`}
          />
        </span>
      ))}
    </div>
  );
}

const CHEERS = [
  'Cố lên, lần sau em sẽ làm tốt hơn!',
  'Khá lắm! Luyện thêm chút nữa nhé!',
  'Giỏi quá! Gần đạt điểm tối đa rồi!',
  'Xuất sắc! Em đúng gần hết luôn!',
];

// ───────────── Màn kết quả ─────────────

export function ResultScreen({
  result,
  onReplay,
  onPickAnother,
  replaying,
  unit = 'từ',
}: {
  result: FinishSessionResponse;
  /** "từ" (game từ vựng) hoặc "câu" (game ngữ pháp). */
  unit?: 'từ' | 'câu';
  onReplay: () => void;
  onPickAnother: () => void;
  replaying: boolean;
}) {
  const pronounce = usePronounce();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="sticker bg-white px-6 py-8 text-center">
        <Stars count={result.stars} />
        <h1 className="mt-5 font-display text-3xl font-extrabold sm:text-4xl">
          {CHEERS[result.stars]}
        </h1>
        <p className="mt-2 text-lg text-ink/75">
          Em trả lời đúng{' '}
          <strong className="font-display text-2xl">
            {result.correctCount}/{result.totalWords}
          </strong>{' '}
          {unit}
          {result.stars > 0 && <> · +{result.stars} sao</>}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-ink/60">
          Tổng cộng
          <Star aria-hidden className="size-4 fill-sun" />
          {result.totalStars} sao
        </p>
      </div>

      {result.mistakes.length > 0 && (
        <section className="sticker bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl font-extrabold">
            Cùng ôn lại nhé
          </h2>
          <ul className="mt-3 divide-y-2 divide-dashed divide-grid">
            {result.mistakes.map((w) => (
              <li key={w.id} className="flex items-center gap-4 py-3">
                {w.imageUrl && (
                  <img
                    src={w.imageUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-lg border-2 border-ink object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl leading-tight font-bold">
                    {w.word}{' '}
                    {w.ipa && (
                      <span className="font-sans text-base font-normal text-ink/55">
                        {w.ipa}
                      </span>
                    )}
                  </p>
                  <p className="text-ink/80">{w.meaning}</p>
                  {w.example && (
                    <p className="text-sm text-ink/60 italic">{w.example}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => pronounce(w.word, w.audioUrl)}
                  aria-label={`Nghe đọc ${w.word}`}
                  className="sticker pressable grid size-12 shrink-0 cursor-pointer place-items-center bg-sun"
                >
                  <Volume2 aria-hidden className="size-6" strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <BigButton tint="bg-mint" onClick={onReplay} disabled={replaying}>
          <RotateCcw aria-hidden className="size-5" strokeWidth={2.5} />
          Chơi lại
        </BigButton>
        <BigButton onClick={onPickAnother}>
          <BookOpen aria-hidden className="size-5" strokeWidth={2.5} />
          Chọn bài khác
        </BigButton>
        <Link
          to="/"
          className="sticker pressable inline-flex items-center gap-2 bg-white px-5 py-3 font-display text-xl font-bold"
        >
          <Home aria-hidden className="size-5" strokeWidth={2.5} />
          Trang chủ
        </Link>
      </div>
    </div>
  );
}

// ───────────── Bắt lỗi trong game ─────────────

/** Một game bị lỗi không làm hỏng cả trang — hiện thông báo và cho quay lại chọn bài. */
export class GameErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Game gặp lỗi:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="sticker mx-auto max-w-md bg-white p-8 text-center">
        <p className="font-display text-2xl font-bold">Ôi, trò chơi bị lỗi</p>
        <p className="mt-1 text-ink/70">Em thử chơi lại nhé.</p>
        <BigButton
          tint="bg-sky mt-5"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onReset();
          }}
        >
          Quay lại
        </BigButton>
      </div>
    );
  }
}
