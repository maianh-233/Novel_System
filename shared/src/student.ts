/**
 * Tài khoản học sinh (Giai đoạn 3).
 * Học sinh chỉ có tên hiển thị + tên đăng nhập — không email, ngày sinh, số điện thoại.
 */
import { z } from 'zod';
import type { ClassGroupRef, Stage } from './classes.js';

const id = z.string().min(1).max(40);

/** Tên đăng nhập: chữ thường không dấu và số, dễ gõ cho các em. */
export const STUDENT_USERNAME_PATTERN = /^[a-z][a-z0-9]{2,19}$/;

export const studentLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Nhập tên đăng nhập')
    .max(20),
  password: z.string().trim().min(1, 'Nhập mật khẩu').max(64),
});
export type StudentLoginRequest = z.infer<typeof studentLoginSchema>;

const displayName = z
  .string()
  .trim()
  .min(1, 'Nhập tên học sinh')
  .max(40, 'Tên tối đa 40 ký tự');

/** Giáo viên tạo nhiều tài khoản một lần: mỗi dòng một tên. */
export const studentBulkCreateSchema = z.object({
  names: z
    .array(displayName)
    .min(1, 'Nhập ít nhất một tên')
    .max(60, 'Mỗi lần tạo tối đa 60 học sinh'),
  /** Xếp các em vào lớp này ngay khi tạo. */
  classId: id.nullish(),
});
export type StudentBulkCreate = z.infer<typeof studentBulkCreateSchema>;

export const studentUpdateSchema = z.object({
  displayName: displayName.optional(),
  isActive: z.boolean().optional(),
});
export type StudentUpdate = z.infer<typeof studentUpdateSchema>;

export const studentIdParam = id;

/** Thông tin đăng nhập — chỉ trả về đúng lúc tạo hoặc đặt lại mật khẩu, để in phiếu. */
export interface StudentCredentials {
  id: string;
  displayName: string;
  username: string;
  password: string;
}

export interface StudentAdmin {
  id: string;
  displayName: string;
  username: string;
  isActive: boolean;
  classGroup: ClassGroupRef | null;
  totalStars: number;
  sessionCount: number;
  lastPlayedAt: string | null;
  createdAt: string;
}

/** Một lượt chơi đã kết thúc, như giáo viên và học sinh thấy trong lịch sử. */
export interface PlaySessionSummary {
  id: string;
  gameSlug: string;
  gameName: string;
  lessonTitle: string;
  stars: number;
  correctCount: number;
  wrongCount: number;
  durationMs: number | null;
  finishedAt: string;
}

export interface StudentDetail extends StudentAdmin {
  sessions: PlaySessionSummary[];
}

/** Hồ sơ học sinh đang đăng nhập. */
export interface StudentProfile {
  id: string;
  displayName: string;
  username: string;
  totalStars: number;
  /** Cấp học quyết định giao diện, game và bài học em thấy. */
  stage: Stage;
  /** null = chưa xếp lớp. */
  grade: number | null;
  className: string | null;
}

export type StudentAuthErrorCode =
  'invalid_credentials' | 'account_disabled' | 'not_authenticated';
