/** Level 1 = dễ, 3 = khó. */
export type Level = 1 | 2 | 3;

export type VocabularyStatus = 'ACTIVE' | 'INACTIVE';

/** Một từ vựng như các mini-game nhận được (đã lọc từ đang hoạt động). */
export interface GameWord {
  id: string;
  word: string;
  meaning: string;
  ipa?: string;
  imageUrl?: string;
  audioUrl?: string;
  example?: string;
}
