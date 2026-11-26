import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET cần ít nhất 32 ký tự (vd: openssl rand -base64 48)'),
  /** Thời gian một phiên đăng nhập của giáo viên còn hiệu lực, tính bằng giờ. */
  ADMIN_SESSION_HOURS: z.coerce.number().positive().default(12),
  /** Học sinh đăng nhập một lần dùng được bao lâu, tính bằng giờ (mặc định 7 ngày). */
  STUDENT_SESSION_HOURS: z.coerce.number().positive().default(168),
  /** Thư mục lưu ảnh/âm thanh tải lên (tương đối với thư mục backend). */
  UPLOAD_DIR: z.string().min(1).default('uploads'),
});

export type Env = z.infer<typeof envSchema>;

/** Dùng cho ConfigModule.forRoot({ validate }): sai cấu hình thì dừng app ngay khi khởi động. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(`Cấu hình .env không hợp lệ:\n${lines.join('\n')}`);
  }
  return result.data;
}
