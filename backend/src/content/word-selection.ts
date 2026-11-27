import type {
  GameDefinition,
  GameWord,
  LessonGamePreview,
} from '@novel/shared';

export interface CandidateWord {
  id: string;
  word: string;
  meaning: string;
  ipa: string | null;
  example: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

/** Từ vựng như game nhận được: bỏ các trường trống. */
export function toGameWord(c: Omit<CandidateWord, 'status'>): GameWord {
  return {
    id: c.id,
    word: c.word,
    meaning: c.meaning,
    ...(c.ipa && { ipa: c.ipa }),
    ...(c.example && { example: c.example }),
    ...(c.imageUrl && { imageUrl: c.imageUrl }),
    ...(c.audioUrl && { audioUrl: c.audioUrl }),
  };
}

/**
 * Lọc từ của một bài học cho một game: bỏ từ đã ngừng dùng và từ thiếu dữ liệu game cần
 * (vd: Picture Match cần hình). Trả kèm lý do để giáo viên biết cần bổ sung gì.
 */
export function selectWordsForGame(
  game: GameDefinition,
  candidates: CandidateWord[],
): LessonGamePreview {
  const words: GameWord[] = [];
  const excluded: LessonGamePreview['excluded'] = [];

  for (const c of candidates) {
    let reason: string | null = null;
    if (c.status !== 'ACTIVE') reason = 'Đã ngừng sử dụng';
    else if (game.requires.includes('image') && !c.imageUrl)
      reason = 'Thiếu hình ảnh';
    else if (game.requires.includes('audio') && !c.audioUrl)
      reason = 'Thiếu âm thanh';

    if (reason) {
      excluded.push({ id: c.id, word: c.word, reason });
      continue;
    }
    words.push(toGameWord(c));
  }

  return {
    gameSlug: game.slug,
    playable: words.length >= game.minWords,
    questionCount: 0,
    words,
    excluded,
  };
}
