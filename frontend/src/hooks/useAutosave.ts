import type { QuestionResponse } from '@novel/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, NETWORK_ERROR } from '../services/api';
import { saveAnswer } from './useStudentExams';

export type SaveStatus = 'saved' | 'saving' | 'offline';

interface Entry {
  response: QuestionResponse;
  flagged: boolean;
}

const RETRY_MS = 5_000;

/**
 * Tự lưu từng câu lên máy chủ. Mỗi câu chỉ gửi giá trị mới nhất; mất mạng thì giữ lại và
 * thử lại mỗi 5 giây, có mạng là gửi tiếp — không mất câu nào em đã làm.
 * `onClosed`: máy chủ báo bài đã nộp / hết giờ. `onLocked`: tài khoản bị khoá / hết phiên.
 */
export function useAutosave(
  attemptId: string,
  { onClosed, onLocked }: { onClosed: () => void; onLocked: () => void },
) {
  const pending = useRef(new Map<string, Entry>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const running = useRef<Promise<void> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  /** Để hẹn giờ thử lại gọi được chính `flush` mới nhất. */
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const handlers = useRef({ onClosed, onLocked });
  useEffect(() => {
    handlers.current = { onClosed, onLocked };
  });

  const flush = useCallback(async (): Promise<void> => {
    if (running.current) {
      await running.current;
      if (pending.current.size === 0) return;
    }
    const run = (async () => {
      while (pending.current.size > 0) {
        const [itemId, entry] = pending.current.entries().next().value!;
        pending.current.delete(itemId);
        setStatus('saving');
        try {
          await saveAnswer(attemptId, itemId, entry);
        } catch (e) {
          if (e instanceof ApiError && e.status === NETWORK_ERROR) {
            // Giữ lại (trừ khi em đã đổi câu đó lần nữa) rồi thử lại sau.
            if (!pending.current.has(itemId))
              pending.current.set(itemId, entry);
            setStatus('offline');
            if (retry.current) clearTimeout(retry.current);
            retry.current = setTimeout(() => void flushRef.current(), RETRY_MS);
            return;
          }
          if (e instanceof ApiError && e.status === 401) {
            handlers.current.onLocked();
            return;
          }
          if (e instanceof ApiError && e.status === 409) {
            pending.current.clear();
            handlers.current.onClosed();
            return;
          }
          // Lỗi khác (câu trả lời không hợp lệ…): bỏ câu đó, lưu tiếp câu khác.
        }
      }
      setStatus('saved');
    })();
    running.current = run;
    try {
      await run;
    } finally {
      if (running.current === run) running.current = null;
    }
  }, [attemptId]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Ghi nhận một câu; `delayMs` > 0 để gộp các lần gõ liên tiếp. */
  const queue = useCallback(
    (itemId: string, entry: Entry, delayMs = 0) => {
      pending.current.set(itemId, entry);
      setStatus((s) => (s === 'offline' ? s : 'saving'));
      const t = timers.current.get(itemId);
      if (t) clearTimeout(t);
      timers.current.set(
        itemId,
        setTimeout(() => {
          timers.current.delete(itemId);
          void flush();
        }, delayMs),
      );
    },
    [flush],
  );

  /** Gửi ngay mọi câu đang chờ (trước khi nộp bài). */
  const flushNow = useCallback(async () => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    await flush();
    return pending.current.size === 0;
  }, [flush]);

  // Có mạng lại thì gửi luôn, không chờ hết 5 giây.
  useEffect(() => {
    const online = () => void flush();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [flush]);

  // Còn câu chưa lưu mà em đóng tab thì trình duyệt hỏi lại.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t);
      if (retry.current) clearTimeout(retry.current);
    },
    [],
  );

  return { queue, flushNow, status };
}
