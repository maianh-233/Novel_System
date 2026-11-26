import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  adminLoginSchema,
  changePasswordSchema,
  type AdminLoginRequest,
  type AdminProfile,
  type AuthErrorCode,
  type ChangePasswordRequest,
} from '@novel/shared';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';
import { ADMIN_COOKIE, ADMIN_COOKIE_PATH } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import {
  CurrentAdmin,
  PublicAdmin,
  type AuthenticatedAdmin,
} from './decorators.js';

// Chặn dò mật khẩu: tối đa 5 lần đăng nhập mỗi phút cho một địa chỉ IP.
const LOGIN_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @PublicAdmin()
  @Throttle(LOGIN_LIMIT)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: adminLoginSchema }) body: AdminLoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminProfile> {
    const admin = await this.auth.validateCredentials(
      body.username,
      body.password,
    );
    if (!admin) {
      const code: AuthErrorCode = 'invalid_credentials';
      throw new UnauthorizedException({
        statusCode: 401,
        code,
        message: 'Sai tên đăng nhập hoặc mật khẩu',
      });
    }
    await this.setSessionCookie(res, admin);
    return { username: admin.username };
  }

  // Công khai để luôn xoá được cookie, kể cả khi phiên đã hết hạn.
  @PublicAdmin()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ADMIN_COOKIE, this.cookieOptions());
  }

  @Get('me')
  me(@CurrentAdmin() admin: AuthenticatedAdmin): AdminProfile {
    return { username: admin.username };
  }

  @Throttle(LOGIN_LIMIT)
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body({ schema: changePasswordSchema }) body: ChangePasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.changePassword(
      admin.id,
      body.currentPassword,
      body.newPassword,
    );
    // Phiên hiện tại được cấp lại; mọi phiên cũ ở thiết bị khác bị vô hiệu.
    await this.setSessionCookie(res, admin);
  }

  private async setSessionCookie(res: Response, admin: AuthenticatedAdmin) {
    const token = await this.auth.issueToken(admin);
    res.cookie(ADMIN_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge:
        this.config.get('ADMIN_SESSION_HOURS', { infer: true }) * 3600_000,
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true, // JavaScript trên trang không đọc được → chống đánh cắp qua XSS
      sameSite: 'lax', // không gửi kèm khi trang khác POST sang → chống CSRF
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: ADMIN_COOKIE_PATH,
    };
  }
}
