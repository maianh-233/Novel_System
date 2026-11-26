import { z } from 'zod';

/** Độ dài tối thiểu của mật khẩu giáo viên. */
export const ADMIN_PASSWORD_MIN = 8;

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Nhập tên đăng nhập').max(64),
  password: z.string().min(1, 'Nhập mật khẩu').max(200),
});
export type AdminLoginRequest = z.infer<typeof adminLoginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại').max(200),
    newPassword: z
      .string()
      .min(
        ADMIN_PASSWORD_MIN,
        `Mật khẩu mới cần ít nhất ${ADMIN_PASSWORD_MIN} ký tự`,
      )
      .max(200),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  });
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export interface AdminProfile {
  username: string;
}

/** Mã lỗi có thể đọc được ở frontend (trường `code` trong body lỗi). */
export type AuthErrorCode =
  'invalid_credentials' | 'wrong_current_password' | 'not_authenticated';
