import { useCallback } from 'react';

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Đọc to một từ tiếng Anh: ưu tiên file audio giáo viên tải lên,
 * không có thì dùng giọng đọc có sẵn của trình duyệt.
 */
export function usePronounce() {
  return useCallback((word: string, audioUrl?: string) => {
    if (audioUrl) {
      // File hỏng hoặc không tải được → vẫn đọc bằng giọng trình duyệt.
      new Audio(audioUrl).play().catch(() => speak(word));
      return;
    }
    speak(word);
  }, []);
}

function speak(word: string) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.8; // chậm một chút cho các em nghe rõ
  window.speechSynthesis.speak(u);
}
