import { STUDENT_USERNAME_PATTERN } from '@novel/shared';
import {
  generateStudentPassword,
  usernameBase,
  usernameCandidate,
} from './credentials.js';

describe('usernameBase', () => {
  it.each([
    ['Nguyễn Văn An', 'an'],
    ['Lê Thị Ngọc Ánh', 'anh'],
    ['Trần Đức', 'duc'],
    ['  Bảo   Ngọc  ', 'ngoc'],
    ['Tom', 'tom'],
  ])('%s → %s', (name, base) => expect(usernameBase(name)).toBe(base));

  it('tên quá ngắn hoặc không có chữ cái thì dùng "hs"', () => {
    expect(usernameBase('Y')).toBe('hs');
    expect(usernameBase('123')).toBe('hs');
    expect(usernameBase('!!!')).toBe('hs');
  });

  it('cắt phần chữ để tên đăng nhập không quá 20 ký tự', () => {
    expect(usernameBase('Supercalifragilisticexpialidocious')).toHaveLength(14);
  });
});

describe('usernameCandidate', () => {
  it('luôn hợp lệ theo mẫu tên đăng nhập, càng thử nhiều càng nhiều chữ số', () => {
    for (const attempt of [0, 9, 10, 29, 30, 99]) {
      const u = usernameCandidate('anh', attempt);
      expect(u).toMatch(STUDENT_USERNAME_PATTERN);
    }
    expect(usernameCandidate('an', 0)).toMatch(/^an\d{2}$/);
    expect(usernameCandidate('an', 15)).toMatch(/^an\d{3}$/);
    expect(usernameCandidate('an', 40)).toMatch(/^an\d{4}$/);
    expect(usernameCandidate('a'.repeat(14), 40)).toHaveLength(18);
  });
});

describe('generateStudentPassword', () => {
  it('là một từ tiếng Anh ngắn + 3 chữ số', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateStudentPassword()).toMatch(/^[a-z]{3,5}\d{3}$/);
    }
  });
});
