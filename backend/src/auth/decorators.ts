import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { PUBLIC_ADMIN_KEY } from './auth.constants.js';

export interface AuthenticatedAdmin {
  id: string;
  username: string;
}

export type AdminRequest = Request & { admin?: AuthenticatedAdmin };

/** Cho phép gọi route dưới /api/admin mà không cần đăng nhập (vd: chính route đăng nhập). */
export const PublicAdmin = () => SetMetadata(PUBLIC_ADMIN_KEY, true);

/** Giáo viên đang đăng nhập — do AdminAuthGuard gắn vào request. */
export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const admin = ctx.switchToHttp().getRequest<AdminRequest>().admin;
    if (!admin) {
      throw new Error(
        '@CurrentAdmin() dùng trên route không được AdminAuthGuard bảo vệ',
      );
    }
    return admin;
  },
);
