import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedStudent } from './student-auth.service.js';

/** Cookie phiên của học sinh, tách riêng với cookie giáo viên. */
export const STUDENT_COOKIE = 'ng_student';
export const STUDENT_COOKIE_PATH = '/api';
/** Mọi route dưới tiền tố này cần học sinh đã đăng nhập (trừ route @PublicPlay). */
export const PLAY_PATH_PREFIX = '/api/play/';
export const PUBLIC_PLAY_KEY = 'publicPlay';

export type StudentRequest = Request & { student?: AuthenticatedStudent };

/** Cho phép gọi route dưới /api/play mà không cần đăng nhập (vd: chính route đăng nhập). */
export const PublicPlay = () => SetMetadata(PUBLIC_PLAY_KEY, true);

/** Học sinh đang đăng nhập — do StudentAuthGuard gắn vào request. */
export const CurrentStudent = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedStudent => {
    const student = ctx.switchToHttp().getRequest<StudentRequest>().student;
    if (!student) {
      throw new Error(
        '@CurrentStudent() dùng trên route không được StudentAuthGuard bảo vệ',
      );
    }
    return student;
  },
);
