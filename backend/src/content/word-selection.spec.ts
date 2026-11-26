import { findGame } from '@novel/shared';
import { selectWordsForGame, type CandidateWord } from './word-selection.js';

const word = (over: Partial<CandidateWord>): CandidateWord => ({
  id: over.word ?? 'x',
  word: 'x',
  meaning: 'nghĩa',
  ipa: null,
  example: null,
  imageUrl: null,
  audioUrl: null,
  status: 'ACTIVE',
  ...over,
});

describe('selectWordsForGame', () => {
  const pictureMatch = findGame('picture-match')!;
  const wordBuilder = findGame('word-builder')!;

  it('game cần hình thì loại từ thiếu hình, kèm lý do', () => {
    const res = selectWordsForGame(pictureMatch, [
      word({ word: 'cat', imageUrl: '/uploads/images/cat.webp' }),
      word({ word: 'dog' }),
    ]);
    expect(res.words.map((w) => w.word)).toEqual(['cat']);
    expect(res.excluded).toEqual([
      { id: 'dog', word: 'dog', reason: 'Thiếu hình ảnh' },
    ]);
  });

  it('luôn loại từ đã ngừng sử dụng', () => {
    const res = selectWordsForGame(wordBuilder, [
      word({ word: 'old', status: 'INACTIVE' }),
    ]);
    expect(res.words).toHaveLength(0);
    expect(res.excluded[0].reason).toBe('Đã ngừng sử dụng');
  });

  it('chỉ chơi được khi đủ số từ tối thiểu', () => {
    const three = ['a', 'b', 'c'].map((w) => word({ word: w }));
    expect(selectWordsForGame(wordBuilder, three).playable).toBe(false);
    expect(
      selectWordsForGame(wordBuilder, [...three, word({ word: 'd' })]).playable,
    ).toBe(true);
  });

  it('không đưa trường rỗng vào dữ liệu game', () => {
    const res = selectWordsForGame(wordBuilder, [word({ word: 'sun' })]);
    expect(res.words[0]).toEqual({ id: 'sun', word: 'sun', meaning: 'nghĩa' });
  });
});
