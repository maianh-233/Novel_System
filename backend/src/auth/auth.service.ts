import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthErrorCode } from '@novel/shared';
import { hashPassword, verifyPassword } from '../common/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAdmin } from './decorators.js';

interface AdminTokenPayload {
  sub: string;
  typ: 'admin';
  iat?: number;
}

// Băm sẵn một mật khẩu giả để khi username không tồn tại vẫn tốn thời gian như khi sai mật khẩu
// — không để lộ username nào có thật qua thời gian phản hồi.
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Trả về giáo viên nếu đúng tài khoản + mật khẩu, ngược lại null. */
  async validateCredentials(
    username: string,
    password: string,
  ): Promise<AuthenticatedAdmin | null> {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    const ok = await verifyPassword(
      password,
      admin?.passwordHash ?? (await DUMMY_HASH),
    );
    return admin && ok ? { id: admin.id, username: admin.username } : null;
  }

  issueToken(admin: AuthenticatedAdmin): Promise<string> {
    const payload: AdminTokenPayload = { sub: admin.id, typ: 'admin' };
    return this.jwt.signAsync(payload);
  }

  /** Kiểm tra token từ cookie. null = không hợp lệ, hết hạn, hoặc đã đổi mật khẩu sau khi cấp. */
  async verifyToken(token: string): Promise<AuthenticatedAdmin | null> {
    let payload: AdminTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminTokenPayload>(token);
    } catch {
      return null;
    }
    if (payload.typ !== 'admin' || typeof payload.iat !== 'number') return null;

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin) return null;

    // iat tính bằng giây → so sánh ở cùng độ chính xác.
    const changedAtSec = Math.floor(admin.passwordChangedAt.getTime() / 1000);
    if (payload.iat < changedAtSec) return null;

    return { id: admin.id, username: admin.username };
  }

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      const code: AuthErrorCode = 'wrong_current_password';
      throw new BadRequestException({
        statusCode: 400,
        code,
        message: 'Mật khẩu hiện tại không đúng',
      });
    }
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        passwordHash: await hashPassword(newPassword),
        // Lùi về đầu giây hiện tại để token cấp lại ngay sau đây vẫn hợp lệ.
        passwordChangedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
      },
    });
  }
}
