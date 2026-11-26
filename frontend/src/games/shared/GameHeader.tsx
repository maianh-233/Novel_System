import { Timer } from 'lucide-react';
import { MuteButton } from './MuteButton';

/** Dòng trên cùng của mọi game: tiến độ bằng chữ, đồng hồ (nếu có), nút tắt tiếng, thanh tiến độ. */
export function GameHeader({
  label,
  progress,
  timeLimitSec,
  timeLeft,
}: {
  label: string;
  /** 0–1. */
  progress: number;
  timeLimitSec: number;
  timeLeft: number;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 font-display text-lg font-bold">
        <span>{label}</span>
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
          style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }}
        />
      </div>
    </>
  );
}
