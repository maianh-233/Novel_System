import { useSyncExternalStore } from 'react';

/**
 * Âm thanh hiệu ứng dùng chung cho mọi game. Âm được tạo bằng Web Audio (không cần file),
 * nhỏ và ngắn để không át tiếng đọc từ. Lựa chọn tắt tiếng lưu trên máy, áp dụng cho mọi game.
 */
export type Sfx = 'correct' | 'wrong' | 'win';

const STORAGE_KEY = 'ng_sfx_muted';

let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Trình duyệt chặn lưu trữ: vẫn tắt tiếng trong phiên này.
  }
  listeners.forEach((l) => l());
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}

/** Các nốt (Hz) và độ dài mỗi nốt (giây). */
const TUNES: Record<
  Sfx,
  { notes: number[]; step: number; wave: OscillatorType }
> = {
  correct: { notes: [660, 880], step: 0.09, wave: 'triangle' },
  wrong: { notes: [220, 185], step: 0.12, wave: 'square' },
  win: { notes: [523, 659, 784, 1047], step: 0.1, wave: 'triangle' },
};

let ctx: AudioContext | null = null;

export function playSfx(name: Sfx) {
  if (muted || typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const { notes, step, wave } = TUNES[name];
    const start = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const t = start + i * step;
      osc.type = wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(
        name === 'wrong' ? 0.05 : 0.12,
        t + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.6);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + step * 1.7);
    });
  } catch {
    // Không phát được âm hiệu ứng thì game vẫn chạy bình thường.
  }
}
