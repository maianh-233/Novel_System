import {
  FLUENT_EMOJI,
  FLUENT_EMOJI_COMMIT,
  type FluentEmojiRow,
} from './fluent-emoji-index.js';

export interface EmojiEntry {
  name: string;
  glyph: string;
  keywords: string[];
  /** Đường dẫn ảnh 3D trong thư mục assets/ của kho Fluent Emoji. */
  path: string;
}

const toEntry = ([
  name,
  glyph,
  keywords,
  path,
]: FluentEmojiRow): EmojiEntry => ({
  name,
  glyph,
  keywords: keywords ? keywords.split('|') : [],
  path,
});

const ENTRIES = FLUENT_EMOJI.map(toEntry);
const BY_NAME = new Map(ENTRIES.map((e) => [e.name.toLowerCase(), e]));

export function findEmoji(name: string): EmojiEntry | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

/** Ảnh 3D của emoji, gắn với commit cố định — đường dẫn không đổi theo thời gian. */
export function emojiImageUrl(e: EmojiEntry): string {
  const path = e.path.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/microsoft/fluentui-emoji/${FLUENT_EMOJI_COMMIT}/assets/${path}`;
}

/** Bỏ đuôi số nhiều đơn giản: "grapes" → "grape", "noodles" → "noodle". */
const singular = (w: string) =>
  w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;

/**
 * Tìm emoji theo từ tiếng Anh. Điểm cao nhất khi tên trùng hẳn (vd "butterfly"),
 * rồi đến tên có chứa nguyên từ ("Cat face"), từ khoá trùng, cuối cùng là chứa một phần.
 */
export function searchEmoji(
  query: string,
  limit = 24,
  entries: EmojiEntry[] = ENTRIES,
): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qs = singular(q);
  const qWords = q.split(/\s+/).map(singular);

  const scored: Array<{ e: EmojiEntry; score: number }> = [];
  for (const e of entries) {
    const name = e.name.toLowerCase();
    const nameWords = name.split(/[\s:,-]+/).map(singular);
    const kw = e.keywords.map((k) => singular(k));
    let score = 0;
    if (name === q || singular(name) === qs) score = 100;
    else if (qWords.every((w) => nameWords.includes(w)))
      score = 80 - nameWords.length; // tên ngắn hơn = sát nghĩa hơn
    else if (kw.includes(qs)) score = 50;
    else if (qWords.every((w) => kw.some((k) => k.split(' ').includes(w))))
      score = 40;
    else if (
      q.length >= 3 &&
      (name.includes(q) || e.keywords.some((k) => k.includes(q)))
    )
      score = 10;
    if (score > 0) scored.push({ e, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((s) => s.e);
}
