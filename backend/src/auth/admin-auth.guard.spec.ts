import { isAdminPath } from './admin-auth.guard.js';

describe('isAdminPath', () => {
  it.each(['/api/admin', '/api/admin/', '/api/admin/auth/me', '/API/Admin/x'])(
    '%s cần đăng nhập',
    (p) => expect(isAdminPath(p)).toBe(true),
  );

  it.each([
    '/api/health',
    '/api/administrator',
    '/api/play/sessions',
    '/admin/x',
  ])('%s không thuộc khu admin', (p) => expect(isAdminPath(p)).toBe(false));
});
