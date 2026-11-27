import { describe, expect, it } from 'vitest';
import { soundTask, spokenForm, taskFor } from './logic';

describe('Sound & Stress', () => {
  it('đọc từ không kèm dấu gạch chân hay dấu trọng âm', () => {
    expect(spokenForm('h[a]t')).toBe('hat');
    expect(spokenForm('baˈnana')).toBe('banana');
    expect(spokenForm("re'port")).toBe('report');
    expect(spokenForm(' teacher ')).toBe('teacher');
  });

  it('hướng dẫn theo dạng câu', () => {
    expect(soundTask('pronunciation')).toMatch(/phát âm/);
    expect(soundTask('stress')).toMatch(/trọng âm/);
  });

  it('không lặp hướng dẫn khi đề đã ghi sẵn', () => {
    expect(taskFor('stress', 'Chọn từ có trọng âm khác.')).toBeNull();
    expect(taskFor('stress', 'Which word is different?')).toMatch(/trọng âm/);
  });
});
