import { describe, expect, it } from 'vitest';
import { placedLabel, sentencePoints } from './logic';

describe('Sentence Builder', () => {
  it('câu nhiều cụm từ được nhiều điểm hơn; sai 0 điểm', () => {
    expect(sentencePoints(3, true)).toBe(11);
    expect(sentencePoints(6, true)).toBe(17);
    expect(sentencePoints(6, false)).toBe(0);
  });

  it('nhãn tiến độ', () => {
    expect(placedLabel(2, 5)).toBe('2/5 cụm');
  });
});
