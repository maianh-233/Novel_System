import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/** Lỗi có `code` để frontend đọc được và `message` tiếng Việt để hiển thị. */
export const notFound = (message: string) =>
  new NotFoundException({ statusCode: 404, code: 'not_found', message });

export const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, code, message });

export const badRequest = (code: string, message: string) =>
  new BadRequestException({ statusCode: 400, code, message });

/** Lỗi trùng khoá unique (vd: cùng một từ trong cùng chủ đề). */
export function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

/** Lỗi bản ghi liên quan không tồn tại / đang được tham chiếu. */
export function isForeignKeyViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003'
  );
}

export function isRecordNotFound(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'
  );
}
