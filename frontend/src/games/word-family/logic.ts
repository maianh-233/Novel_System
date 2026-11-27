/**
 * Gốc từ trong câu word form, là phần trong ngoặc tròn cuối câu:
 * "He is very ___ (friend)." → "friend". Không có thì null.
 */
export function rootWord(prompt: string): string | null {
  const all = [...prompt.matchAll(/\(([^()]+)\)/g)];
  const last = all.at(-1)?.[1].trim();
  return last ? last : null;
}

/** Câu bỏ phần gốc từ (đã hiện riêng thành thẻ to). */
export function promptWithoutRoot(prompt: string): string {
  const root = rootWord(prompt);
  if (!root) return prompt;
  const i = prompt.lastIndexOf(`(${root}`);
  const j = prompt.indexOf(')', i);
  return (prompt.slice(0, i) + prompt.slice(j + 1))
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
