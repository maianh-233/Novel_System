import type { GameWord, Level } from '@novel/shared';

/** Số cặp hình–từ trên một màn theo cấp độ: cấp 1 dễ nhìn, cấp 3 nhiều lựa chọn hơn. */
export const pairsPerBoard = (level: Level) =>
  level === 1 ? 3 : level === 2 ? 4 : 5;

/** Nối sai bao nhiêu lần cho một hình thì hiện đáp án và khoá cặp đó lại. */
export const MAX_ATTEMPTS = 3;

export interface Board {
  /** Thứ tự các hình (cột trái). */
  pictures: GameWord[];
  /** Thứ tự các thẻ chữ (cột phải), đã trộn khác thứ tự hình. */
  labels: GameWord[];
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Hai từ không nên nằm chung một màn: chữ giống nhau, hoặc dùng chung một hình. */
const clashes = (a: GameWord, b: GameWord) =>
  norm(a.word) === norm(b.word) || (!!a.imageUrl && a.imageUrl === b.imageUrl);

/**
 * Chia các từ của lượt thành nhiều màn. Số màn ít nhất có thể, các màn đều nhau
 * (6 từ ở cấp 3 → 3 + 3, không phải 5 + 1). Từ trùng chữ hoặc trùng hình được xếp
 * sang màn khác nếu được, để màn nào cũng chỉ có một cách nối đúng.
 */
export function buildBoards(
  words: GameWord[],
  level: Level,
  random: () => number = Math.random,
): Board[] {
  if (words.length === 0) return [];
  const count = Math.ceil(words.length / pairsPerBoard(level));
  const base = Math.floor(words.length / count);
  const extra = words.length % count;
  const capacity = Array.from({ length: count }, (_, i) =>
    i < extra ? base + 1 : base,
  );

  const groups: GameWord[][] = capacity.map(() => []);
  for (const word of words) {
    const open = groups.filter((g, i) => g.length < capacity[i]);
    const clean = open.find((g) => !g.some((o) => clashes(o, word)));
    (clean ?? open[0]).push(word);
  }

  return groups.map((group) => {
    const pictures = shuffle(group, random);
    const labels = shuffle(group, random);
    // Thẻ chữ không xếp đúng hàng với hình của nó — tránh nối "ngang" mà không cần đọc.
    // Đổi chỗ với thẻ kế bên luôn gỡ được ô đó và không tạo ra ô thẳng hàng mới.
    if (labels.length > 1) {
      labels.forEach((label, i) => {
        if (label.id !== pictures[i].id) return;
        const j = (i + 1) % labels.length;
        [labels[i], labels[j]] = [labels[j], labels[i]];
      });
    }
    return { pictures, labels };
  });
}

/**
 * Hình có khớp thẻ chữ không. So theo chữ (không phân biệt hoa thường) chứ không theo id:
 * hai thẻ cùng ghi "orange" thì em chọn thẻ nào cũng đúng.
 */
export const isMatch = (picture: GameWord, label: GameWord) =>
  picture.id === label.id || norm(picture.word) === norm(label.word);
