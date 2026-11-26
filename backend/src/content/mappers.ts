import type { Level, VocabularyAdmin } from '@novel/shared';
import type { Prisma } from '../generated/prisma/client.js';

export const vocabularyInclude = {
  category: { select: { id: true, name: true, icon: true } },
} satisfies Prisma.VocabularyInclude;

type VocabularyRow = Prisma.VocabularyGetPayload<{
  include: typeof vocabularyInclude;
}>;

export function toVocabularyAdmin(v: VocabularyRow): VocabularyAdmin {
  return {
    id: v.id,
    word: v.word,
    meaning: v.meaning,
    ipa: v.ipa,
    example: v.example,
    imageUrl: v.imageUrl,
    audioUrl: v.audioUrl,
    level: v.level as Level,
    status: v.status,
    category: v.category,
    updatedAt: v.updatedAt.toISOString(),
  };
}
