import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword, hashPassword } from '../common/password.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuthenticatedStudent {
  id: string;
  username: string;
  displayName: string;
}

interface StudentTokenPayload {
  sub: string;
  typ: 'student';
  iat?: number;
}

export type StudentLoginResult =
  | { ok: true; student: AuthenticatedStudent }
  | { ok: false; reason: 'invalid_credentials' | 'account_disabled' };

// Username không tồn tại vẫn tốn thời gian băm như sai mật khẩu — không lộ username nào có thật.
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

@Injectable()
export class StudentAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async validateCredentials(
    username: string,
    password: string,
  ): Promise<StudentLoginResult> {
    const s = await this.prisma.student.findUnique({ where: { username } });
    const ok = await verifyPassword(
      password,
      s?.passwordHash ?? (await DUMMY_HASH),
    );
    if (!s || !ok) return { ok: false, reason: 'invalid_credentials' };
    // Chỉ báo "bị khoá" khi đã đúng mật khẩu.
    if (!s.isActive) return { ok: false, reason: 'account_disabled' };
    return {
      ok: true,
      student: { id: s.id, username: s.username, displayName: s.displayName },
    };
  }

  issueToken(student: AuthenticatedStudent): Promise<string> {
    const payload: StudentTokenPayload = { sub: student.id, typ: 'student' };
    return this.jwt.signAsync(payload, {
      expiresIn: `${this.config.get('STUDENT_SESSION_HOURS', { infer: true })}h`,
    });
  }

  /** null = token sai, hết hạn, tài khoản bị khoá, hoặc mật khẩu đã được đặt lại sau khi cấp. */
  async verifyToken(token: string): Promise<AuthenticatedStudent | null> {
    let payload: StudentTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<StudentTokenPayload>(token);
    } catch {
      return null;
    }
    if (payload.typ !== 'student' || typeof payload.iat !== 'number')
      return null;
    const s = await this.prisma.student.findUnique({
      where: { id: payload.sub },
    });
    if (!s || !s.isActive) return null;
    const changedAtSec = Math.floor(s.passwordChangedAt.getTime() / 1000);
    if (payload.iat < changedAtSec) return null;
    return { id: s.id, username: s.username, displayName: s.displayName };
  }
}
