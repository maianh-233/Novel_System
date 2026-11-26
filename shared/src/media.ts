/**
 * Tìm ảnh minh hoạ và lấy phát âm từ nguồn miễn phí bên ngoài (Giai đoạn 4).
 * - Ảnh: Microsoft Fluent Emoji (luôn có) + Pixabay (chỉ khi máy chủ có PIXABAY_API_KEY).
 * - Phát âm: Free Dictionary API (dictionaryapi.dev) — file đọc lấy từ Wiktionary.
 * Mọi file chọn dùng đều được tải về máy chủ; trang học sinh không gọi ra ngoài.
 */
import { z } from 'zod';

export const IMAGE_SOURCES = ['emoji', 'pixabay'] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

/** Pixabay: hình vẽ minh hoạ (mặc định, hợp với trẻ nhỏ) hoặc ảnh chụp. */
export const PIXABAY_KINDS = ['illustration', 'photo'] as const;
export type PixabayKind = (typeof PIXABAY_KINDS)[number];

const query = z.string().trim().min(1, 'Nhập từ cần tìm').max(60);

export const imageSearchSchema = z.object({
  q: query,
  source: z.enum(IMAGE_SOURCES).default('emoji'),
  kind: z.enum(PIXABAY_KINDS).default('illustration'),
});
export type ImageSearchQuery = z.input<typeof imageSearchSchema>;

export interface ImageSearchResult {
  source: ImageSource;
  /** Mã để tải ảnh về (tên emoji hoặc id ảnh Pixabay) — không phải URL. */
  id: string;
  title: string;
  /** Ảnh xem trước nhỏ, chỉ dùng trong trang giáo viên. */
  previewUrl: string;
}

export interface ImageSearchResponse {
  results: ImageSearchResult[];
  /** false = máy chủ chưa cấu hình PIXABAY_API_KEY, chỉ tìm được emoji. */
  pixabayEnabled: boolean;
}

export const imageImportSchema = z.object({
  source: z.enum(IMAGE_SOURCES),
  id: z.string().trim().min(1).max(120),
});
export type ImageImportRequest = z.infer<typeof imageImportSchema>;

export const dictionaryLookupSchema = z.object({ word: query });
export type DictionaryLookupRequest = z.infer<typeof dictionaryLookupSchema>;

export interface DictionaryLookupResult {
  /** Phiên âm IPA, vd: "/ˈbʌtəflaɪ/". */
  ipa: string | null;
  /** Câu ví dụ có chứa từ — giáo viên xem lại trước khi lưu. */
  example: string | null;
  /** File đọc đã tải về máy chủ (/uploads/audio/...). */
  audioUrl: string | null;
  /**
   * saved = đã tải về; missing = từ điển không có file đọc;
   * busy = có file nhưng dịch vụ đang giới hạn lượt tải — thử lại sau ít phút.
   */
  audioStatus: 'saved' | 'missing' | 'busy';
  /** Ghi nguồn file đọc, vd: "Wiktionary (CC BY-SA 4.0)". */
  audioCredit: string | null;
}

export type MediaErrorCode =
  | 'remote_unavailable'
  | 'not_in_dictionary'
  | 'pixabay_disabled'
  | 'image_not_found';
