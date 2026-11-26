import { vocabularyInputSchema, type VocabularyData } from '@novel/shared';
import Papa from 'papaparse';

export interface CategoryLookup {
  id: string;
  name: string;
  slug: string;
}

export interface ParsedImport {
  rows: Array<{ line: number; data: VocabularyData }>;
  errors: Array<{ line: number; message: string }>;
}

const MAX_ROWS = 2000;

/**
 * Đọc CSV từ vựng (dòng đầu là tiêu đề). Cột bắt buộc: word, meaning.
 * Cột tuỳ chọn: ipa, example, category (tên hoặc slug), level, image, audio.
 * Chỉ đọc & kiểm tra — không ghi database.
 */
export function parseVocabularyCsv(
  csv: string,
  categories: CategoryLookup[],
  defaultCategoryId?: string,
): ParsedImport {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: ParsedImport['errors'] = [];
  const rows: ParsedImport['rows'] = [];

  const headers = parsed.meta.fields ?? [];
  for (const required of ['word', 'meaning']) {
    if (!headers.includes(required)) {
      errors.push({
        line: 1,
        message: `Thiếu cột "${required}" ở dòng tiêu đề`,
      });
    }
  }
  if (errors.length) return { rows, errors };

  if (parsed.data.length > MAX_ROWS) {
    errors.push({
      line: 1,
      message: `Tối đa ${MAX_ROWS} dòng mỗi lần nhập (file có ${parsed.data.length} dòng)`,
    });
    return { rows, errors };
  }

  const byKey = new Map<string, string>();
  for (const c of categories) {
    byKey.set(c.name.trim().toLowerCase(), c.id);
    byKey.set(c.slug, c.id);
  }

  const seen = new Map<string, number>();

  parsed.data.forEach((raw, index) => {
    const line = index + 2; // +1 cho dòng tiêu đề, +1 vì đếm từ 1
    const categoryText = raw.category?.trim();
    const categoryId = categoryText
      ? byKey.get(categoryText.toLowerCase())
      : defaultCategoryId;

    if (!categoryId) {
      errors.push({
        line,
        message: categoryText
          ? `Không có chủ đề "${categoryText}"`
          : 'Thiếu chủ đề (điền cột category hoặc chọn chủ đề mặc định)',
      });
      return;
    }

    const result = vocabularyInputSchema.safeParse({
      word: raw.word ?? '',
      meaning: raw.meaning ?? '',
      ipa: raw.ipa,
      example: raw.example,
      imageUrl: raw.image,
      audioUrl: raw.audio,
      categoryId,
      level: raw.level?.trim() ? raw.level : undefined,
    });

    if (!result.success) {
      const issue = result.error.issues[0];
      errors.push({
        line,
        message: `${String(issue.path[0] ?? '')}: ${issue.message}`,
      });
      return;
    }

    const key = `${result.data.word.toLowerCase()}|${categoryId}`;
    const firstLine = seen.get(key);
    if (firstLine) {
      errors.push({
        line,
        message: `Trùng với dòng ${firstLine} (cùng từ, cùng chủ đề)`,
      });
      return;
    }
    seen.set(key, line);
    rows.push({ line, data: result.data });
  });

  return { rows, errors };
}
