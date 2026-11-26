import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../common/password.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

interface FakeAdmin {
  id: string;
  username: string;
  passwordHash: string;
  passwordChangedAt: Date;
}

/** Prisma giả trong bộ nhớ — chỉ những hàm AuthService dùng. */
function setup(admin: FakeAdmin) {
  const db = { admin: { ...admin } };
  const prisma = {
    admin: {
      findUnique: vi.fn(
        ({ where }: { where: { id?: string; username?: string } }) =>
          Promise.resolve(
            where.id === db.admin.id || where.username === db.admin.username
              ? { ...db.admin }
              : null,
          ),
      ),
      findUniqueOrThrow: vi.fn(() => Promise.resolve({ ...db.admin })),
      update: vi.fn(({ data }: { data: Partial<FakeAdmin> }) => {
        Object.assign(db.admin, data);
        return Promise.resolve({ ...db.admin });
      }),
    },
  } as unknown as PrismaService;
  const jwt = new JwtService({
    secret: 'test-secret-test-secret-test-secret!!',
    signOptions: { expiresIn: '1h' },
  });
  return { service: new AuthService(prisma, jwt), db, jwt };
}

async function makeAdmin(password = 'correct-horse'): Promise<FakeAdmin> {
  return {
    id: 'admin-1',
    username: 'teacher',
    passwordHash: await hashPassword(password),
    passwordChangedAt: new Date(Date.now() - 60_000),
  };
}

describe('AuthService', () => {
  it('chấp nhận đúng tài khoản + mật khẩu', async () => {
    const { service } = setup(await makeAdmin());
    await expect(
      service.validateCredentials('teacher', 'correct-horse'),
    ).resolves.toEqual({ id: 'admin-1', username: 'teacher' });
  });

  it('từ chối sai mật khẩu hoặc username không tồn tại', async () => {
    const { service } = setup(await makeAdmin());
    await expect(
      service.validateCredentials('teacher', 'nope'),
    ).resolves.toBeNull();
    await expect(
      service.validateCredentials('ghost', 'correct-horse'),
    ).resolves.toBeNull();
  });

  it('token vừa cấp thì hợp lệ', async () => {
    const { service } = setup(await makeAdmin());
    const token = await service.issueToken({
      id: 'admin-1',
      username: 'teacher',
    });
    await expect(service.verifyToken(token)).resolves.toEqual({
      id: 'admin-1',
      username: 'teacher',
    });
  });

  it('từ chối token rác, token ký bằng khoá khác, và token không phải admin', async () => {
    const { service } = setup(await makeAdmin());
    await expect(service.verifyToken('garbage')).resolves.toBeNull();

    const otherKey = new JwtService({
      secret: 'another-secret-another-secret-12345',
    });
    const forged = await otherKey.signAsync({ sub: 'admin-1', typ: 'admin' });
    await expect(service.verifyToken(forged)).resolves.toBeNull();

    const { jwt } = setup(await makeAdmin());
    const wrongType = await jwt.signAsync({ sub: 'admin-1', typ: 'student' });
    await expect(service.verifyToken(wrongType)).resolves.toBeNull();
  });

  it('đổi mật khẩu: lưu mật khẩu mới và vô hiệu token cấp trước đó', async () => {
    const { service, db, jwt } = setup(await makeAdmin());
    const oldToken = await jwt.signAsync({
      sub: 'admin-1',
      typ: 'admin',
      iat: Math.floor(Date.now() / 1000) - 30,
    });
    await expect(service.verifyToken(oldToken)).resolves.not.toBeNull();

    await service.changePassword('admin-1', 'correct-horse', 'brand-new-pass');

    await expect(
      verifyPassword('brand-new-pass', db.admin.passwordHash),
    ).resolves.toBe(true);
    await expect(service.verifyToken(oldToken)).resolves.toBeNull();

    const fresh = await service.issueToken({
      id: 'admin-1',
      username: 'teacher',
    });
    await expect(service.verifyToken(fresh)).resolves.not.toBeNull();
  });

  it('đổi mật khẩu: báo lỗi khi mật khẩu hiện tại sai, không đổi gì', async () => {
    const { service, db } = setup(await makeAdmin());
    const before = db.admin.passwordHash;
    await expect(
      service.changePassword('admin-1', 'wrong', 'brand-new-pass'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.admin.passwordHash).toBe(before);
  });
});
