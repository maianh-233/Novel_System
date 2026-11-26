import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  learnerOf,
  studentLoginSchema,
  type StudentAuthErrorCode,
  type StudentLoginRequest,
  type StudentProfile,
} from '@novel/shared';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CurrentStudent,
  PublicPlay,
  STUDENT_COOKIE,
  STUDENT_COOKIE_PATH,
} from './decorators.js';
import {
  StudentAuthService,
  type AuthenticatedStudent,
} from './student-auth.service.js';

/**
 * Cả lớp thường dùng chung một địa chỉ IP (mạng trường), nên giới hạn đăng nhập tính theo
 * IP + tên đăng nhập: 30 em đăng nhập cùng lúc vẫn được, nhưng dò mật khẩu một tài khoản thì bị chặn.
 */
export const STUDENT_LOGIN_LIMIT = {
  default: {
    limit: 5,
    ttl: 60_000,
    getTracker: (req: Record<string, unknown>) => {
      const body = req.body as { username?: unknown } | undefined;
      const username =
        typeof body?.username === 'string'
          ? body.username.trim().toLowerCase().slice(0, 20)
          : '';
      return `${(req as unknown as Request).ip}|${username}`;
    },
  },
};

@Controller('play/auth')
export class StudentAuthController {
  constructor(
    private readonly auth: StudentAuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @PublicPlay()
  @Throttle(STUDENT_LOGIN_LIMIT)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: studentLoginSchema }) body: StudentLoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StudentProfile> {
    const result = await this.auth.validateCredentials(
      body.username,
      body.password,
    );
    if (!result.ok) {
      const code: StudentAuthErrorCode = result.reason;
      if (code === 'account_disabled') {
        throw new ForbiddenException({
          statusCode: 403,
          code,
          message: 'Tài khoản của em đang tạm khoá. Em hỏi cô giáo nhé.',
        });
      }
      throw new UnauthorizedException({
        statusCode: 401,
        code,
        message: 'Tên đăng nhập hoặc mật khẩu chưa đúng',
      });
    }
    const token = await this.auth.issueToken(result.student);
    res.cookie(STUDENT_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge:
        this.config.get('STUDENT_SESSION_HOURS', { infer: true }) * 3600_000,
    });
    return this.profile(result.student);
  }

  // Công khai để luôn xoá được cookie, kể cả khi phiên đã hết hạn.
  @PublicPlay()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(STUDENT_COOKIE, this.cookieOptions());
  }

  @Get('me')
  me(@CurrentStudent() student: AuthenticatedStudent) {
    return this.profile(student);
  }

  private async profile(s: AuthenticatedStudent): Promise<StudentProfile> {
    const { totalStars, classGroup } =
      await this.prisma.student.findUniqueOrThrow({
        where: { id: s.id },
        select: { totalStars: true, classGroup: true },
      });
    const learner = learnerOf(classGroup);
    return {
      id: s.id,
      displayName: s.displayName,
      username: s.username,
      totalStars,
      stage: learner.stage,
      grade: learner.grade,
      className: classGroup?.name ?? null,
    };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: STUDENT_COOKIE_PATH,
    };
  }
}
