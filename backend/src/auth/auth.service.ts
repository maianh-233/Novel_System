import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { AuthErrorCode } from '@novel/shared';
import { hashPassword, verifyPassword } from '../common/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAdmin } from './decorators.js';

interface AdminTokenPayload {
  sub: string;
  typ: 'admin';
  /** Mã riêng của phiên — để đăng xuất thu hồi đúng phiên này, không ảnh hưởng máy khác. */
  jti: string;
  iat?: number;
  exp?: number;
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
    const payload: AdminTokenPayload = {
      sub: admin.id,
      typ: 'admin',
      jti: randomUUID(),
    };
    return this.jwt.signAsync(payload);
  }

  /**
   * Kiểm tra token từ cookie. null = không hợp lệ, hết hạn, đã đăng xuất, hoặc đã đổi
   * mật khẩu sau khi cấp. Token không có `jti` (cấp trước khi có đăng xuất phía máy chủ)
   * cũng bị từ chối, vì không thu hồi được.
   */
  async verifyToken(token: string): Promise<AuthenticatedAdmin | null> {
    const payload = await this.decode(token);
    if (!payload) return null;

    const [admin, revoked] = await Promise.all([
      this.prisma.admin.findUnique({ where: { id: payload.sub } }),
      this.prisma.revokedAdminToken.findUnique({
        where: { jti: payload.jti },
      }),
    ]);
    if (!admin || revoked) return null;

    // iat tính bằng giây → so sánh ở cùng độ chính xác.
    const changedAtSec = Math.floor(admin.passwordChangedAt.getTime() / 1000);
    if (payload.iat < changedAtSec) return null;

    return { id: admin.id, username: admin.username };
  }

  /**
   * Đăng xuất phía máy chủ: ghi lại `jti` của token để nó không dùng được nữa, kể cả khi
   * ai đó đã chép được cookie. Token sai hoặc đã hết hạn thì không cần làm gì.
   * Tiện thể dọn các bản ghi đã quá hạn — token của chúng đã tự hết hiệu lực.
   */
  async revokeToken(token: string): Promise<void> {
    const payload = await this.decode(token);
    if (!payload || typeof payload.exp !== 'number') return;
    const expiresAt = new Date(payload.exp * 1000);
    await this.prisma.revokedAdminToken.upsert({
      where: { jti: payload.jti },
      update: {},
      create: { jti: payload.jti, adminId: payload.sub, expiresAt },
    });
    await this.prisma.revokedAdminToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  /** Chữ ký đúng, chưa hết hạn, đúng loại admin và có đủ trường. */
  private async decode(
    token: string,
  ): Promise<(AdminTokenPayload & { iat: number }) | null> {
    let payload: AdminTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminTokenPayload>(token);
    } catch {
      return null;
    }
    if (
      payload.typ !== 'admin' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.iat !== 'number'
    ) {
      return null;
    }
    return payload as AdminTokenPayload & { iat: number };
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
