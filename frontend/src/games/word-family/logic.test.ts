import { describe, expect, it } from 'vitest';
import { promptWithoutRoot, rootWord } from './logic';

describe('Word Family', () => {
  it('lấy gốc từ trong ngoặc cuối câu', () => {
    expect(rootWord('He is very ___ (friend).')).toBe('friend');
    expect(rootWord('The (old) man ___ quickly (quick).')).toBe('quick');
    expect(rootWord('No root here ___.')).toBeNull();
  });

  it('bỏ gốc từ khỏi câu, giữ dấu câu gọn', () => {
    expect(promptWithoutRoot('He is very ___ (friend).')).toBe(
      'He is very ___.',
    );
    expect(promptWithoutRoot('No root ___.')).toBe('No root ___.');
  });
});
