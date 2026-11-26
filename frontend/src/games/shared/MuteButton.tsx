import { Volume2, VolumeX } from 'lucide-react';
import { setMuted, useMuted } from './sfx';

/** Nút bật/tắt âm hiệu ứng đúng/sai (không tắt tiếng đọc từ). */
export function MuteButton() {
  const muted = useMuted();
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? 'Bật âm hiệu ứng' : 'Tắt âm hiệu ứng'}
      title={muted ? 'Bật âm hiệu ứng' : 'Tắt âm hiệu ứng'}
      className={`sticker pressable grid size-10 shrink-0 cursor-pointer place-items-center ${muted ? 'bg-white text-ink/50' : 'bg-white'}`}
    >
      <Icon aria-hidden className="size-5" strokeWidth={2.5} />
    </button>
  );
}
