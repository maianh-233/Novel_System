import { isAdminPath } from '../auth/admin-auth.guard.js';
import { isPlayPath } from './student-auth.guard.js';

describe('isPlayPath', () => {
  it.each(['/api/play', '/api/play/sessions', '/API/Play/auth/me'])(
    '%s cần học sinh đăng nhập',
    (p) => expect(isPlayPath(p)).toBe(true),
  );
  it.each([
    '/api/playground',
    '/api/admin/students',
    '/play/x',
    '/api/content/categories',
  ])('%s không thuộc khu chơi', (p) => expect(isPlayPath(p)).toBe(false));
  it('khu chơi và khu giáo viên không chồng lên nhau', () => {
    for (const p of ['/api/play/sessions', '/api/admin/students']) {
      expect(isPlayPath(p) && isAdminPath(p)).toBe(false);
    }
  });
});
