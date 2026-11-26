import type { PixabayKind } from '@novel/shared';

/**
 * Pixabay API (https://pixabay.com/api/docs/) — miễn phí, cần key, ảnh dùng không phải ghi nguồn.
 * Điều khoản của Pixabay: không dùng link ảnh trực tiếp lâu dài (phải tải về máy chủ mình),
 * lưu tạm kết quả tìm kiếm 24 giờ, và cho người dùng biết kết quả đến từ Pixabay.
 */
export const PIXABAY_API = 'https://pixabay.com/api/';
export const PIXABAY_IMAGE_HOSTS = ['pixabay.com', 'cdn.pixabay.com'];

export interface PixabayHit {
  id: number;
  tags?: string;
  previewURL?: string;
  webformatURL?: string;
}

/**
 * URL tìm kiếm. Luôn bật safesearch vì người dùng là học sinh tiểu học;
 * mặc định chỉ lấy hình vẽ minh hoạ.
 */
export function pixabaySearchUrl(
  key: string,
  q: string,
  kind: PixabayKind,
): string {
  const params = new URLSearchParams({
    key,
    q,
    lang: 'en',
    image_type: kind,
    safesearch: 'true',
    per_page: '24',
    order: 'popular',
  });
  return `${PIXABAY_API}?${params}`;
}

export function pixabayByIdUrl(key: string, id: string): string {
  return `${PIXABAY_API}?${new URLSearchParams({ key, id })}`;
}

/** Chỉ giữ ảnh có đủ link và link thuộc Pixabay. */
export function parsePixabayHits(data: unknown): PixabayHit[] {
  const hits = (data as { hits?: unknown } | null)?.hits;
  if (!Array.isArray(hits)) return [];
  return (hits as PixabayHit[]).filter(
    (h) =>
      typeof h.id === 'number' &&
      isPixabayUrl(h.previewURL) &&
      isPixabayUrl(h.webformatURL),
  );
}

function isPixabayUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PIXABAY_IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}
