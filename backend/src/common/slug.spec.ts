import { slugify } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Animals', 'animals'],
    ['Food & Drinks', 'food-drinks'],
    ['Đồ dùng học tập', 'do-dung-hoc-tap'],
    ['  Con vật   quanh em! ', 'con-vat-quanh-em'],
    ['Màu sắc', 'mau-sac'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
