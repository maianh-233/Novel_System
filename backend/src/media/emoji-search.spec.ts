import { emojiImageUrl, findEmoji, searchEmoji } from './emoji-search.js';

const names = (q: string, n = 5) => searchEmoji(q, n).map((e) => e.name);

describe('searchEmoji (Fluent Emoji)', () => {
  it.each([
    ['butterfly', 'Butterfly'],
    ['Banana', 'Banana'],
    ['grapes', 'Grapes'],
    ['grape', 'Grapes'],
    ['cat', 'Cat'],
    ['scissors', 'Scissors'],
    ['baby', 'Baby'],
  ])('"%s" → kết quả đầu tiên là %s', (q, first) => {
    expect(names(q)[0]).toBe(first);
  });

  it('tìm được qua từ khoá khi tên emoji khác từ', () => {
    expect(names('apple', 10)).toContain('Red apple');
    expect(names('orange', 10)).toContain('Tangerine');
  });

  it('cụm từ: mọi chữ đều phải khớp', () => {
    expect(names('ice cream', 10)).toContain('Ice cream');
    expect(names('red circle')[0]).toBe('Red circle');
  });

  it('không có kết quả cho chuỗi rỗng hoặc vô nghĩa', () => {
    expect(searchEmoji('   ')).toEqual([]);
    expect(searchEmoji('qwxzvbn')).toEqual([]);
  });

  it('giới hạn số kết quả', () => {
    expect(searchEmoji('face', 7)).toHaveLength(7);
  });
});

describe('findEmoji + emojiImageUrl', () => {
  it('tìm theo tên không phân biệt hoa thường, URL gắn commit cố định', () => {
    const e = findEmoji('red APPLE')!;
    expect(e.glyph).toBe('🍎');
    expect(emojiImageUrl(e)).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/microsoft\/fluentui-emoji\/[0-9a-f]{40}\/assets\/Red%20apple\/3D\/red_apple_3d\.png$/,
    );
  });

  it('emoji có màu da dùng bản mặc định', () => {
    expect(findEmoji('Baby')!.path).toBe('Baby/Default/3D/baby_3d_default.png');
  });

  it('tên không có trong bộ hình → undefined', () => {
    expect(findEmoji('../../etc/passwd')).toBeUndefined();
  });
});
