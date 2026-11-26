import { checkAnswers, rateRound, type GameAnswer } from '@novel/shared';
import { shuffle } from './play.service.js';

const answers = (correct: number, wrong: number): GameAnswer[] => [
  ...Array.from({ length: correct }, (_, i) => ({
    vocabularyId: `c${i}`,
    correct: true,
    attempts: 1,
  })),
  ...Array.from({ length: wrong }, (_, i) => ({
    vocabularyId: `w${i}`,
    correct: false,
    attempts: 2,
  })),
];

describe('rateRound — tính sao', () => {
  it.each([
    [10, 0, 3],
    [9, 1, 3], // 90%
    [8, 2, 2],
    [7, 3, 2], // 70%
    [6, 4, 1],
    [0, 10, 1], // hoàn thành = ít nhất 1 sao
  ])('%i đúng / %i sai → %i sao', (c, w, stars) => {
    expect(rateRound(10, answers(c, w), false).stars).toBe(stars);
  });

  it('game không tính giờ: từ bỏ qua tính là sai — trả lời 1 từ đúng không được 3 sao', () => {
    expect(rateRound(10, answers(1, 0), false)).toEqual({
      stars: 1,
      correctCount: 1,
      wrongCount: 9,
      totalWords: 10,
    });
  });

  it('game tính giờ: chỉ tính những từ đã kịp trả lời', () => {
    expect(rateRound(30, answers(9, 1), true)).toEqual({
      stars: 3,
      correctCount: 9,
      wrongCount: 1,
      totalWords: 10,
    });
  });

  it('không trả lời từ nào thì 0 sao', () => {
    expect(rateRound(10, [], false).stars).toBe(0);
    expect(rateRound(10, [], true).stars).toBe(0);
  });
});

describe('checkAnswers', () => {
  const issued = ['a', 'b', 'c'];
  const ans = (id: string): GameAnswer => ({
    vocabularyId: id,
    correct: true,
    attempts: 1,
  });

  it('chấp nhận một phần hoặc toàn bộ từ đã phát', () => {
    expect(checkAnswers(issued, [ans('a'), ans('c')])).toBeNull();
    expect(checkAnswers(issued, [])).toBeNull();
  });

  it('từ chối từ không được phát và từ gửi hai lần', () => {
    expect(checkAnswers(issued, [ans('x')])).toMatch(/không thuộc/);
    expect(checkAnswers(issued, [ans('a'), ans('a')])).toMatch(/hai lần/);
  });
});

describe('shuffle', () => {
  it('giữ nguyên các phần tử và không sửa mảng gốc', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src);
    expect([...out].sort((a, b) => a - b)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});
