import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { hashPassword } from './../src/common/password.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

export async function createApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

export function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ng_admin='));
  if (!cookie) throw new Error('Không có cookie ng_admin trong phản hồi');
  return cookie.split(';')[0];
}

/** Tạo một tài khoản giáo viên riêng cho test, đăng nhập và trả về cookie. */
export async function loginAsTestAdmin(
  app: NestExpressApplication,
  username: string,
): Promise<{ cookie: string; cleanup: () => Promise<void> }> {
  const prisma = app.get(PrismaService);
  const password = 'e2e-password-123';
  await prisma.admin.deleteMany({ where: { username } });
  await prisma.admin.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(Date.now() - 5_000),
    },
  });
  const res = await request(app.getHttpServer())
    .post('/api/admin/auth/login')
    .send({ username, password });
  if (res.status !== 200)
    throw new Error(`Đăng nhập test thất bại: ${res.status}`);
  return {
    cookie: sessionCookie(res),
    cleanup: async () => {
      await prisma.admin.deleteMany({ where: { username } });
    },
  };
}

/** File WAV hợp lệ nhỏ nhất (0,01 giây im lặng) để thử tải âm thanh. */
export function tinyWav(): Buffer {
  const samples = 80;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(8000, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return buf;
}
