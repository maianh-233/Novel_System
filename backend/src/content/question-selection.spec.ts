import { findGame } from '@novel/shared';
import {
  selectQuestionsForGame,
  type CandidateQuestion,
} from './question-selection.js';

const q = (
  id: string,
  type: CandidateQuestion['type'],
  extra: Partial<CandidateQuestion> = {},
): CandidateQuestion => ({
  id,
  type,
  prompt: `She ___ (go) ${id}`,
  hint: null,
  explanation: 'Hiện tại đơn',
  passageId: null,
  status: 'ACTIVE',
  gradable: { type, options: ['go', 'goes'], correct: 1, accepted: [] },
  ...extra,
});

describe('selectQuestionsForGame', () => {
  const rush = findGame('grammar-rush')!;

  it('chỉ lấy dạng câu game chơi, kèm đáp án để báo đúng/sai ngay', () => {
    const sel = selectQuestionsForGame(rush, [
      q('a', 'mcq'),
      q('b', 'verb_form'),
      q('c', 'reorder'),
      q('d', 'mcq'),
      q('e', 'mcq'),
    ]);
    expect(sel.questions.map((x) => x.id)).toEqual(['a', 'b', 'd', 'e']);
    expect(sel.questions[0]).toMatchObject({
      correct: 1,
      explanation: 'Hiện tại đơn',
      passageId: null,
    });
    expect(sel).toMatchObject({ playable: true, questionCount: 4, words: [] });
    // Câu khác dạng dành cho game khác, không phải "bị loại".
    expect(sel.excluded).toEqual([]);
  });

  it('bỏ câu ngừng dùng và câu thuộc đoạn văn, ghi lý do', () => {
    const sel = selectQuestionsForGame(rush, [
      q('a', 'mcq', { status: 'INACTIVE' }),
      q('b', 'mcq', { passageId: 'p1' }),
      q('c', 'mcq'),
    ]);
    expect(sel.questions.map((x) => x.id)).toEqual(['c']);
    expect(sel.excluded.map((e) => [e.id, e.reason])).toEqual([
      ['a', 'Đã ngừng sử dụng'],
      ['b', 'Thuộc một đoạn văn (chỉ dùng trong đề)'],
    ]);
    expect(sel.playable).toBe(false);
  });
});
