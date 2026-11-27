/** Câu dài (nhiều cụm từ) khó xếp hơn nên nhiều điểm hơn. */
export function sentencePoints(fragmentCount: number, correct: boolean) {
  return correct ? 5 + 2 * fragmentCount : 0;
}

/** Nhãn tiến độ khi xếp: "3/5 cụm". */
export const placedLabel = (placed: number, total: number) =>
  `${placed}/${total} cụm`;
