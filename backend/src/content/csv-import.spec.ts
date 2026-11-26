import { parseVocabularyCsv } from './csv-import.js';

const categories = [
  { id: 'c-animals', name: 'Animals', slug: 'animals' },
  { id: 'c-food', name: 'Food & Drinks', slug: 'food-drinks' },
];

describe('parseVocabularyCsv', () => {
  it('đọc dòng hợp lệ, khớp chủ đề theo tên hoặc slug (không phân biệt hoa thường)', () => {
    const csv = [
      'word,meaning,ipa,category,level',
      'cat,con mèo,/kæt/,Animals,1',
      'bread,bánh mì,,food-drinks,2',
      'Tiger,con hổ,,ANIMALS,',
    ].join('\n');
    const { rows, errors } = parseVocabularyCsv(csv, categories);
    expect(errors).toEqual([]);
    expect(
      rows.map((r) => [r.data.word, r.data.categoryId, r.data.level]),
    ).toEqual([
      ['cat', 'c-animals', 1],
      ['bread', 'c-food', 2],
      ['Tiger', 'c-animals', 1],
    ]);
    expect(rows[1].data.ipa).toBeNull();
  });

  it('dùng chủ đề mặc định khi không có cột category', () => {
    const { rows } = parseVocabularyCsv(
      'word,meaning\ndog,con chó',
      categories,
      'c-animals',
    );
    expect(rows[0].data.categoryId).toBe('c-animals');
  });

  it('báo lỗi theo đúng số dòng trong file', () => {
    const csv = [
      'word,meaning,category,level',
      'cat,con mèo,Animals,1', // dòng 2: ok
      ',thiếu từ,Animals,1', // dòng 3
      'dog,con chó,Planets,1', // dòng 4
      'fish,con cá,Animals,9', // dòng 5
      'cat,con mèo lần 2,animals,1', // dòng 6: trùng dòng 2
      'ca7,sai ký tự,Animals,1', // dòng 7
    ].join('\n');
    const { rows, errors } = parseVocabularyCsv(csv, categories);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7]);
    expect(errors[1].message).toContain('Planets');
    expect(errors[3].message).toContain('dòng 2');
  });

  it('báo thiếu cột bắt buộc', () => {
    const { errors } = parseVocabularyCsv('word,ipa\ncat,/kæt/', categories);
    expect(errors[0]).toEqual({
      line: 1,
      message: 'Thiếu cột "meaning" ở dòng tiêu đề',
    });
  });

  it('bỏ BOM của file lưu từ Excel và dòng trống', () => {
    const { rows, errors } = parseVocabularyCsv(
      '﻿word,meaning,category\n\ncat,con mèo,Animals\n\n',
      categories,
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });
});
