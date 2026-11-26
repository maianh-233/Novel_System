/** Dùng câu ví dụ của từ cho chế độ cấp 2: điền từ vào câu, xếp từ thành câu. */

export interface Cloze {
  before: string;
  /** Đúng như trong câu (giữ hoa thường). */
  answer: string;
  after: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Câu ví dụ có chứa nguyên từ (không phân biệt hoa thường, đúng ranh giới từ) thì khoét từ đó
 * thành chỗ trống. Không có câu, hoặc câu chỉ có dạng khác của từ (go → goes) thì trả về null.
 */
export function clozeOf(
  example: string | undefined,
  word: string,
): Cloze | null {
  const sentence = example?.trim();
  const target = word.trim().replace(/\s+/g, ' ');
  if (!sentence || !target) return null;
  const pattern = target.split(' ').map(escapeRegExp).join('\\s+');
  const m = new RegExp(
    `(?<![\\p{L}\\p{N}'])${pattern}(?![\\p{L}\\p{N}])`,
    'iu',
  ).exec(sentence);
  if (!m) return null;
  return {
    before: sentence.slice(0, m.index),
    answer: m[0],
    after: sentence.slice(m.index + m[0].length),
  };
}

/** Câu dài/ngắn quá thì không hợp để xếp (ít quá thì dễ, nhiều quá thì rối trên điện thoại). */
export const SENTENCE_MIN_WORDS = 3;
export const SENTENCE_MAX_WORDS = 10;

/** Tách câu thành các từ để xếp; dấu câu dính theo từ đứng trước ("school."). null = câu không dùng được. */
export function sentenceTokens(example: string | undefined): string[] | null {
  const tokens = example?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length < SENTENCE_MIN_WORDS || tokens.length > SENTENCE_MAX_WORDS)
    return null;
  return tokens;
}
