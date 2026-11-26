import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthErrorCode } from '@novel/shared';
import {
  ADMIN_COOKIE,
  ADMIN_PATH_PREFIX,
  PUBLIC_ADMIN_KEY,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AdminRequest } from './decorators.js';

/**
 * Guard toàn cục: mọi request tới /api/admin/* phải có cookie phiên hợp lệ,
 * trừ route gắn @PublicAdmin(). Đặt ở mức toàn cục để route admin mới thêm sau này
 * được bảo vệ mặc định, không phụ thuộc việc nhớ gắn decorator.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest<AdminRequest>();

    if (!isAdminPath(req.path)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ADMIN_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const token = (req.cookies as Record<string, string> | undefined)?.[
      ADMIN_COOKIE
    ];
    const admin = token ? await this.auth.verifyToken(token) : null;
    if (!admin) {
      const code: AuthErrorCode = 'not_authenticated';
      throw new UnauthorizedException({
        statusCode: 401,
        code,
        message: 'Cần đăng nhập để tiếp tục',
      });
    }
    req.admin = admin;
    return true;
  }
}

export function isAdminPath(path: string): boolean {
  const p = path.toLowerCase();
  return (
    p === ADMIN_PATH_PREFIX.slice(0, -1) || p.startsWith(ADMIN_PATH_PREFIX)
  );
}
