// Luồng đăng nhập giáo viên trên database thật. Cần `npm run db:up` ở thư mục gốc.
// Test tự tạo một tài khoản riêng và xoá đi khi xong — không đụng tài khoản giáo viên thật.
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { hashPassword } from './../src/common/password.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const USERNAME = `e2e-teacher-${process.pid}`;
const PASSWORD = 'e2e-password-123';

async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ng_admin='));
  if (!cookie) throw new Error('Không có cookie ng_admin trong phản hồi');
  return cookie.split(';')[0];
}

describe('Admin auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await prisma.admin.deleteMany({ where: { username: USERNAME } });
    await prisma.admin.create({
      data: {
        username: USERNAME,
        passwordHash: await hashPassword(PASSWORD),
        passwordChangedAt: new Date(Date.now() - 5_000),
      },
    });
  });

  afterAll(async () => {
    await prisma.admin.deleteMany({ where: { username: USERNAME } });
    await app.close();
  });

  it('chặn khu admin khi chưa đăng nhập', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('not_authenticated');
  });

  it('báo lỗi validation khi thiếu trường', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: USERNAME });
    expect(res.status).toBe(400);
  });

  it('từ chối sai mật khẩu và không cấp cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: USERNAME, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_credentials');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('đăng nhập → xem me → đổi mật khẩu → cookie cũ mất hiệu lực → đăng xuất', async () => {
    const server = app.getHttpServer();

    const login = await request(server)
      .post('/api/admin/auth/login')
      .send({ username: USERNAME, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ username: USERNAME });
    const setCookie = (login.headers['set-cookie'] as unknown as string[]).join(
      ';',
    );
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\/api/i);
    const oldCookie = sessionCookie(login);

    const me = await request(server)
      .get('/api/admin/auth/me')
      .set('Cookie', oldCookie);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ username: USERNAME });

    const wrongCurrent = await request(server)
      .post('/api/admin/auth/change-password')
      .set('Cookie', oldCookie)
      .send({ currentPassword: 'not-it', newPassword: 'a-brand-new-pass' });
    expect(wrongCurrent.status).toBe(400);
    expect(wrongCurrent.body.code).toBe('wrong_current_password');

    const tooShort = await request(server)
      .post('/api/admin/auth/change-password')
      .set('Cookie', oldCookie)
      .send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(tooShort.status).toBe(400);

    // Đợi sang giây mới để token cũ chắc chắn được cấp trước lúc đổi mật khẩu.
    await new Promise((r) => setTimeout(r, 1_100));
    const changed = await request(server)
      .post('/api/admin/auth/change-password')
      .set('Cookie', oldCookie)
      .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-pass' });
    expect(changed.status).toBe(204);
    const newCookie = sessionCookie(changed);

    expect(
      (await request(server).get('/api/admin/auth/me').set('Cookie', oldCookie))
        .status,
    ).toBe(401);
    expect(
      (await request(server).get('/api/admin/auth/me').set('Cookie', newCookie))
        .status,
    ).toBe(200);

    const logout = await request(server)
      .post('/api/admin/auth/logout')
      .set('Cookie', newCookie);
    expect(logout.status).toBe(204);
    expect(
      (logout.headers['set-cookie'] as unknown as string[]).join(';'),
    ).toMatch(/ng_admin=;/);
  });

  it('khoá đăng nhập tạm thời sau 5 lần thử trong một phút', async () => {
    const fresh = await createApp(); // bộ đếm rate limit riêng cho test này
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await request(fresh.getHttpServer())
          .post('/api/admin/auth/login')
          .send({ username: USERNAME, password: 'wrong-password' });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses[5]).toBe(429);
    } finally {
      await fresh.close();
    }
  });
});
