import { randomInt } from 'node:crypto';

/**
 * Phần chữ của tên đăng nhập, lấy từ tên gọi (từ cuối của tên tiếng Việt), bỏ dấu:
 * "Nguyễn Văn An" → "an", "Lê Thị Ngọc Ánh" → "anh".
 */
export function usernameBase(displayName: string): string {
  const words = displayName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => /^[a-z]/.test(w));
  const given = words.at(-1) ?? '';
  return given.length >= 2 ? given.slice(0, 14) : 'hs';
}

/** Tên đăng nhập ứng viên: phần chữ + số. Số chữ số tăng dần theo số lần thử để luôn tìm được tên trống. */
export function usernameCandidate(base: string, attempt: number): string {
  const digits = attempt < 10 ? 2 : attempt < 30 ? 3 : 4;
  return `${base}${randomInt(10 ** (digits - 1), 10 ** digits)}`;
}

// Từ tiếng Anh ngắn, quen thuộc — mật khẩu vừa dễ gõ vừa là một từ các em đang học.
const PASSWORD_WORDS = [
  'cat',
  'dog',
  'sun',
  'fish',
  'bird',
  'duck',
  'frog',
  'bee',
  'cow',
  'pig',
  'star',
  'moon',
  'cake',
  'ball',
  'kite',
  'tree',
  'lion',
  'bear',
  'goat',
  'owl',
  'apple',
  'lemon',
  'mango',
  'tiger',
  'zebra',
  'panda',
  'robot',
  'rain',
  'snow',
  'boat',
];

/** Mật khẩu dễ gõ cho học sinh tiểu học, vd: "panda427". */
export function generateStudentPassword(): string {
  const word = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  return `${word}${randomInt(100, 1000)}`;
}
