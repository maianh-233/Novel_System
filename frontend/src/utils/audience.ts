import { STAGE_LABEL, type Stage } from '@novel/shared';

/** Bài học dành cho ai: cấp học (hoặc cả hai) + khối (tuỳ chọn). */
export interface Audience {
  stage: Stage | null;
  grade: number | null;
}

/** "Tiểu học", "Cấp 2 · khối 7", "Cả hai cấp". */
export function audienceLabel({ stage, grade }: Audience) {
  if (stage === null) return 'Cả hai cấp';
  return grade === null
    ? STAGE_LABEL[stage]
    : `${STAGE_LABEL[stage]} · khối ${grade}`;
}
