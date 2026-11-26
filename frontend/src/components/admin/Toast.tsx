import { CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { ToastContext, type ToastTone } from './toastContext';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 1;

/** Thông báo ngắn góc dưới màn hình sau khi lưu/xoá, tự ẩn sau vài giây. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-lg"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 aria-hidden className="size-4 text-mint" />
            ) : (
              <XCircle aria-hidden className="size-4 text-tomato" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
