import { describe, expect, it } from 'vitest';
import { clozeOf, sentenceTokens } from './sentence';

describe('clozeOf', () => {
  it('khoét đúng từ, giữ nguyên phần còn lại của câu', () => {
    expect(clozeOf('I have a cat.', 'cat')).toEqual({
      before: 'I have a ',
      answer: 'cat',
      after: '.',
    });
  });

  it('không phân biệt hoa thường, giữ chữ như trong câu', () => {
    expect(clozeOf('Apples are red.', 'apples')?.answer).toBe('Apples');
  });

  it('chỉ khớp nguyên từ, không khớp một phần từ khác', () => {
    expect(clozeOf('The category is long.', 'cat')).toBeNull();
    expect(clozeOf("It's my cat's toy.", 'cat')).toEqual({
      before: "It's my ",
      answer: 'cat',
      after: "'s toy.",
    });
  });

  it('khớp cụm từ kể cả khi cách nhiều dấu cách', () => {
    expect(clozeOf('I  get   up at six.', 'get up')?.answer).toBe('get   up');
  });

  it('không có câu ví dụ, hoặc câu chỉ có dạng khác của từ → null', () => {
    expect(clozeOf(undefined, 'go')).toBeNull();
    expect(clozeOf('She goes to school.', 'go')).toBeNull();
  });

  it('ký tự đặc biệt trong từ không làm hỏng biểu thức', () => {
    expect(clozeOf('Wear a t-shirt (please).', 't-shirt')?.answer).toBe(
      't-shirt',
    );
  });
});

describe('sentenceTokens', () => {
  it('tách theo dấu cách, dấu câu đi theo từ', () => {
    expect(sentenceTokens(' I go to school. ')).toEqual([
      'I',
      'go',
      'to',
      'school.',
    ]);
  });

  it('câu quá ngắn hoặc quá dài thì không dùng', () => {
    expect(sentenceTokens('Hello there')).toBeNull();
    expect(sentenceTokens(Array(11).fill('a').join(' '))).toBeNull();
    expect(sentenceTokens(undefined)).toBeNull();
  });
});
