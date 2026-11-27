import { plainText, type QuestionType } from '@novel/shared';

/**
 * Chữ để máy đọc to một lựa chọn: bỏ dấu đánh dấu phần gạch chân "[ ]" và dấu trọng âm
 * (ˈ ' ˌ) giáo viên có thể ghi trong lựa chọn, vd "h[a]t" → "hat", "baˈnana" → "banana".
 */
export function spokenForm(option: string): string {
  return plainText(option)
    .replace(/[ˈˌ'’]/g, '')
    .trim();
}

export const SOUND_TASK: Partial<Record<QuestionType, string>> = {
  pronunciation: 'Chọn từ có phần gạch chân phát âm khác',
  stress: 'Chọn từ có trọng âm khác',
};

/** Hướng dẫn cho câu đang chơi. */
export const soundTask = (type: QuestionType) =>
  SOUND_TASK[type] ?? 'Chọn đáp án đúng';

/** Hướng dẫn, trừ khi đề giáo viên soạn đã ghi đúng ý đó (tránh hiện hai lần). */
export function taskFor(type: QuestionType, prompt: string): string | null {
  const task = soundTask(type);
  const norm = (t: string) =>
    plainText(t)
      .toLowerCase()
      .replace(/[.:!?\s]+/g, ' ')
      .trim();
  return norm(prompt).includes(norm(task)) ? null : task;
}
