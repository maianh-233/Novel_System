import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('xác minh đúng mật khẩu đã băm', async () => {
    const stored = await hashPassword('hello-123');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('hello-123', stored)).resolves.toBe(true);
  });

  it('từ chối mật khẩu sai hoặc chuỗi băm hỏng', async () => {
    const stored = await hashPassword('hello-123');
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
    await expect(verifyPassword('hello-123', 'garbage')).resolves.toBe(false);
  });

  it('mỗi lần băm dùng salt khác nhau', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});
