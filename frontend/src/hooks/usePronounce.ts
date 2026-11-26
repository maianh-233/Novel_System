import { useCallback } from 'react';

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Đọc to một từ tiếng Anh: ưu tiên file audio giáo viên tải lên,
 * không có thì dùng giọng đọc có sẵn của trình duyệt.
 */
export function usePronounce() {
  return useCallback((word: string, audioUrl?: string) => {
    if (audioUrl) {
      void new Audio(audioUrl).play();
      return;
    }
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.8; // chậm một chút cho các em nghe rõ
    window.speechSynthesis.speak(u);
  }, []);
}
