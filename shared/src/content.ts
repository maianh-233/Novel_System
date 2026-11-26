/**
 * Schema + kiểu dữ liệu cho Admin quản lý nội dung (Giai đoạn 2).
 * Dùng chung: backend kiểm tra request, frontend kiểm tra form trước khi gửi.
 */
import { z } from 'zod';
import type { GameConfig } from './games.js';
import type { GameWord, Level, VocabularyStatus } from './vocabulary.js';

const id = z.string().min(1).max(40);
const level = z.coerce
  .number()
  .int()
  .min(1)
  .max(3) as unknown as z.ZodType<Level>;
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

/** Chỉ chấp nhận file đã tải lên hệ thống (/uploads/...) hoặc link https. */
const mediaUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || v.startsWith('/uploads/') || /^https:\/\//.test(v),
    {
      message: 'Đường dẫn phải là file đã tải lên hoặc link https',
    },
  )
  .transform((v) => (v === '' ? null : v))
  .nullish();

// ───────────── Chủ đề ─────────────

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên chủ đề').max(50),
  icon: optionalText(16),
});
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  isHidden: z.boolean().optional(),
});
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;

export const reorderSchema = z.object({
  ids: z.array(id).min(1).max(500),
});
export type ReorderRequest = z.infer<typeof reorderSchema>;

export interface CategoryAdmin {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  isHidden: boolean;
  order: number;
  wordCount: number;
}

// ───────────── Từ vựng ─────────────

export const VOCABULARY_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

const vocabularyFields = z.object({
  word: z
    .string()
    .trim()
    .min(1, 'Nhập từ tiếng Anh')
    .max(60)
    .regex(
      /^[A-Za-z][A-Za-z '\-.]*$/,
      "Chỉ dùng chữ cái tiếng Anh, khoảng trắng, dấu - và '",
    ),
  meaning: z.string().trim().min(1, 'Nhập nghĩa tiếng Việt').max(120),
  ipa: optionalText(60),
  example: optionalText(200),
  imageUrl: mediaUrl,
  audioUrl: mediaUrl,
  categoryId: id,
  level,
  status: z.enum(VOCABULARY_STATUSES),
});

export const vocabularyInputSchema = vocabularyFields.extend({
  level: level.default(1),
  status: z.enum(VOCABULARY_STATUSES).default('ACTIVE'),
});
export type VocabularyInput = z.input<typeof vocabularyInputSchema>;
export type VocabularyData = z.output<typeof vocabularyInputSchema>;

// Sửa từ: chỉ đổi trường được gửi — không có giá trị mặc định (tránh reset cấp độ/trạng thái).
export const vocabularyUpdateSchema = vocabularyFields.partial();
export type VocabularyUpdate = z.input<typeof vocabularyUpdateSchema>;

export const vocabularyQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  categoryId: id.optional(),
  level: level.optional(),
  status: z.enum(VOCABULARY_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type VocabularyQuery = z.input<typeof vocabularyQuerySchema>;

export interface VocabularyAdmin {
  id: string;
  word: string;
  meaning: string;
  ipa: string | null;
  example: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  level: Level;
  status: VocabularyStatus;
  category: { id: string; name: string; icon: string | null };
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ───────────── Nhập CSV ─────────────

export const vocabularyImportSchema = z.object({
  csv: z.string().min(1, 'File CSV đang trống').max(1_000_000),
  /** Dùng khi dòng CSV không ghi cột category. */
  defaultCategoryId: id.optional(),
  /** true = chỉ kiểm tra, chưa lưu. */
  dryRun: z.boolean().default(true),
});
export type VocabularyImportRequest = z.input<typeof vocabularyImportSchema>;

export interface VocabularyImportResult {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  errors: Array<{ line: number; message: string }>;
}

/** Các cột CSV được chấp nhận (dòng đầu là tiêu đề). */
export const CSV_COLUMNS = [
  'word',
  'meaning',
  'ipa',
  'example',
  'category',
  'level',
  'image',
  'audio',
] as const;

// ───────────── Bài học ─────────────

const lessonFields = z.object({
  title: z.string().trim().min(1, 'Nhập tên bài học').max(80),
  description: optionalText(300),
  level,
  isPublished: z.boolean(),
});

export const lessonInputSchema = lessonFields.extend({
  level: level.default(1),
  isPublished: z.boolean().default(false),
});
export type LessonInput = z.input<typeof lessonInputSchema>;

export const lessonUpdateSchema = lessonFields.partial();
export type LessonUpdate = z.input<typeof lessonUpdateSchema>;

export const lessonWordsSchema = z.object({
  vocabularyIds: z
    .array(id)
    .max(200, 'Một bài học tối đa 200 từ')
    .refine((ids) => new Set(ids).size === ids.length, 'Có từ bị trùng'),
});
export type LessonWordsRequest = z.infer<typeof lessonWordsSchema>;

export interface LessonSummary {
  id: string;
  title: string;
  description: string | null;
  level: Level;
  isPublished: boolean;
  wordCount: number;
  gameSlugs: string[];
  updatedAt: string;
}

export interface LessonDetail extends LessonSummary {
  words: VocabularyAdmin[];
}

/** Xem trước: game sẽ nhận những từ nào của bài học, từ nào bị loại và vì sao. */
export interface LessonGamePreview {
  gameSlug: string;
  playable: boolean;
  words: GameWord[];
  excluded: Array<{ id: string; word: string; reason: string }>;
}

// ───────────── Trò chơi ─────────────

export const gameUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  config: z
    .object({
      wordsPerRound: z.coerce.number().int().min(3).max(50),
      timeLimitSec: z.coerce.number().int().min(0).max(600),
    })
    .optional(),
  lessonIds: z.array(id).max(500).optional(),
});
export type GameUpdate = z.input<typeof gameUpdateSchema>;

export interface GameAdmin {
  slug: string;
  isEnabled: boolean;
  config: GameConfig;
  lessonIds: string[];
}

// ───────────── Công khai (khu học sinh) ─────────────

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  wordCount: number;
}
