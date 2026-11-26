import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StudentAuthErrorCode } from '@novel/shared';
import {
  PLAY_PATH_PREFIX,
  PUBLIC_PLAY_KEY,
  STUDENT_COOKIE,
  type StudentRequest,
} from './decorators.js';
import { StudentAuthService } from './student-auth.service.js';

/**
 * Guard toàn cục cho khu chơi: mọi request tới /api/play/* cần cookie phiên học sinh hợp lệ,
 * trừ route gắn @PublicPlay(). Route mới thêm sau được bảo vệ mặc định.
 */
@Injectable()
export class StudentAuthGuard implements CanActivate {
  constructor(
    private readonly auth: StudentAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest<StudentRequest>();
    if (!isPlayPath(req.path)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_PLAY_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const token = (req.cookies as Record<string, string> | undefined)?.[
      STUDENT_COOKIE
    ];
    const student = token ? await this.auth.verifyToken(token) : null;
    if (!student) {
      const code: StudentAuthErrorCode = 'not_authenticated';
      throw new UnauthorizedException({
        statusCode: 401,
        code,
        message: 'Em cần đăng nhập để chơi',
      });
    }
    req.student = student;
    return true;
  }
}

export function isPlayPath(path: string): boolean {
  const p = path.toLowerCase();
  return p === PLAY_PATH_PREFIX.slice(0, -1) || p.startsWith(PLAY_PATH_PREFIX);
}
