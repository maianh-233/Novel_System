import { retryAfterMs } from './remote-fetch.js';
import { parsePixabayHits, pixabaySearchUrl } from './pixabay.js';

describe('pixabaySearchUrl', () => {
  it('luôn bật safesearch cho học sinh, lọc đúng loại ảnh', () => {
    const url = new URL(pixabaySearchUrl('KEY', 'ice cream', 'illustration'));
    expect(url.origin + url.pathname).toBe('https://pixabay.com/api/');
    expect(url.searchParams.get('safesearch')).toBe('true');
    expect(url.searchParams.get('image_type')).toBe('illustration');
    expect(url.searchParams.get('q')).toBe('ice cream');
  });
});

describe('parsePixabayHits', () => {
  const ok = {
    id: 1,
    tags: 'cat, pet',
    previewURL: 'https://cdn.pixabay.com/a_150.png',
    webformatURL: 'https://pixabay.com/get/a_640.png',
  };

  it('giữ ảnh hợp lệ, bỏ ảnh thiếu link hoặc link ngoài Pixabay', () => {
    const hits = parsePixabayHits({
      hits: [
        ok,
        { ...ok, id: 2, webformatURL: 'https://evil.example/x.png' },
        { ...ok, id: 3, previewURL: undefined },
        { ...ok, id: '4' },
      ],
    });
    expect(hits.map((h) => h.id)).toEqual([1]);
  });

  it('dữ liệu sai dạng → rỗng', () => {
    expect(parsePixabayHits(null)).toEqual([]);
    expect(parsePixabayHits({ hits: 'x' })).toEqual([]);
  });
});

describe('retryAfterMs', () => {
  it('theo header Retry-After (giây), mặc định 1 giây, tối đa 5 giây', () => {
    expect(retryAfterMs('2')).toBe(2000);
    expect(retryAfterMs(null)).toBe(1000);
    expect(retryAfterMs('abc')).toBe(1000);
    expect(retryAfterMs('3600')).toBe(5000);
  });
});
