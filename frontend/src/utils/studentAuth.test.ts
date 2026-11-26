import { describe, expect, it } from 'vitest';
import { ApiError } from '../services/api';
import { safeStudentRedirect, studentAuthErrorMessage } from './studentAuth';

describe('safeStudentRedirect', () => {
  it.each(['/play/word-quiz', '/me', '/'])('giữ %s', (next) =>
    expect(safeStudentRedirect(next)).toBe(next),
  );

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/admin',
    '/admin/students',
    '/login',
  ])('đưa %s về trang chủ', (next) =>
    expect(safeStudentRedirect(next)).toBe('/'),
  );
});

describe('studentAuthErrorMessage', () => {
  it('giải thích bằng lời cho các em', () => {
    expect(
      studentAuthErrorMessage(new ApiError(401, 'x', 'invalid_credentials')),
    ).toMatch(/phiếu/);
    expect(
      studentAuthErrorMessage(new ApiError(403, 'x', 'account_disabled')),
    ).toMatch(/tạm khoá/);
    expect(studentAuthErrorMessage(new ApiError(429, 'x'))).toMatch(/1 phút/);
  });
});
