import { describe, expect, it } from 'vitest';
import { ApiError, NETWORK_ERROR } from '../services/api';
import { authErrorMessage, safeAdminRedirect } from './authErrors';

describe('safeAdminRedirect', () => {
  it('giữ đường dẫn trong khu admin', () => {
    expect(safeAdminRedirect('/admin/vocabulary?page=2')).toBe(
      '/admin/vocabulary?page=2',
    );
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/',
    '/admin/login',
  ])('đưa %s về /admin', (next) =>
    expect(safeAdminRedirect(next)).toBe('/admin'),
  );
});

describe('authErrorMessage', () => {
  it('giải thích từng loại lỗi', () => {
    expect(
      authErrorMessage(new ApiError(401, 'x', 'invalid_credentials')),
    ).toMatch(/Sai tên đăng nhập/);
    expect(authErrorMessage(new ApiError(429, 'x'))).toMatch(/1 phút/);
    expect(authErrorMessage(new ApiError(NETWORK_ERROR, 'x'))).toMatch(
      /máy chủ/,
    );
  });
});
