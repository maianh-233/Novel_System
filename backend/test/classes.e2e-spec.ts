// C0 — lớp học + cấp học trên database thật. Cần `npm run db:up`.
// Test chỉ tạo dữ liệu có tiền tố riêng, xoá hết khi xong và trả cấu hình game về như cũ.
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type {
  ClassGroupAdmin,
  GameAdmin,
  PlayGameInfo,
  StartSessionResponse,
  StudentAdmin,
  StudentCredentials,
  StudentProfile,
} from '@novel/shared';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, loginAsTestAdmin } from './helpers.js';

const TAG = `e2c${process.pid}`;
const GAME = 'word-runner';

function studentCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ng_student='));
  if (!cookie) throw new Error('Không có cookie ng_student trong phản hồi');
  return cookie.split(';')[0];
}

describe('Classes + stage (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: string;
  let cleanupAdmin: () => Promise<void>;
  let originalGame: GameAdmin;
  const lessons: Record<'primary' | 'secondary' | 'both' | 'grade8', string> = {
    primary: '',
    secondary: '',
    both: '',
    grade8: '',
  };
  const studentIds: string[] = [];
  const http = () => request(app.getHttpServer());
  const asAdmin = {
    get: (p: string) => http().get(p).set('Cookie', admin),
    post: (p: string) => http().post(p).set('Cookie', admin),
    patch: (p: string) => http().patch(p).set('Cookie', admin),
    put: (p: string) => http().put(p).set('Cookie', admin),
    del: (p: string) => http().delete(p).set('Cookie', admin),
  };

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    ({ cookie: admin, cleanup: cleanupAdmin } = await loginAsTestAdmin(
      app,
      `${TAG}-admin`,
    ));

    const cat = await asAdmin
      .post('/api/admin/categories')
      .send({ name: `${TAG} Words` })
      .expect(201);
    const ids: string[] = [];
    for (const word of ['ant', 'bee', 'cow', 'dog', 'eel', 'fox']) {
      const res = await asAdmin
        .post('/api/admin/vocabulary')
        .send({ word, meaning: `nghĩa ${word}`, categoryId: cat.body.id })
        .expect(201);
      ids.push(res.body.id);
    }
    const audiences = {
      primary: { stage: 'primary' },
      secondary: { stage: 'secondary' },
      both: { stage: null },
      grade8: { stage: 'secondary', grade: 8 },
    } as const;
    for (const [key, audience] of Object.entries(audiences)) {
      const l = await asAdmin
        .post('/api/admin/lessons')
        .send({ title: `${TAG} ${key}`, isPublished: true, ...audience })
        .expect(201);
      lessons[key as keyof typeof lessons] = l.body.id;
      await asAdmin
        .put(`/api/admin/lessons/${l.body.id}/words`)
        .send({ vocabularyIds: ids })
        .expect(200);
    }

    const games = await asAdmin.get('/api/admin/games').expect(200);
    originalGame = (games.body as GameAdmin[]).find((g) => g.slug === GAME)!;
    await asAdmin
      .patch(`/api/admin/games/${GAME}`)
      .send({
        isEnabled: true,
        lessonIds: [...originalGame.lessonIds, ...Object.values(lessons)],
      })
      .expect(200);
  });

  afterAll(async () => {
    if (originalGame) {
      await asAdmin.patch(`/api/admin/games/${GAME}`).send({
        isEnabled: originalGame.isEnabled,
        lessonIds: originalGame.lessonIds,
      });
    }
    await prisma.playSession.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.classGroup.deleteMany({
      where: { name: { startsWith: TAG } },
    });
    await prisma.lesson.deleteMany({ where: { title: { startsWith: TAG } } });
    const cats = await prisma.category.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const catIds = cats.map((c) => c.id);
    await prisma.vocabulary.deleteMany({
      where: { categoryId: { in: catIds } },
    });
    await prisma.category.deleteMany({ where: { id: { in: catIds } } });
    await cleanupAdmin();
    await app.close();
  });

  it('khu quản lý lớp cần giáo viên', async () => {
    await http().get('/api/admin/classes').expect(401);
    await http().post('/api/admin/students/assign-class').expect(401);
  });

  it('bài học: khối phải khớp cấp học', async () => {
    await asAdmin
      .post('/api/admin/lessons')
      .send({ title: `${TAG} bad`, stage: 'primary', grade: 7 })
      .expect(400);
    await asAdmin
      .post('/api/admin/lessons')
      .send({ title: `${TAG} bad`, stage: null, grade: 7 })
      .expect(400);
    // Đổi cấp học mà không gửi khối: khối cũ không khớp thì tự bỏ.
    const res = await asAdmin
      .patch(`/api/admin/lessons/${lessons.grade8}`)
      .send({ stage: 'secondary' })
      .expect(200);
    expect(res.body).toMatchObject({ stage: 'secondary', grade: 8 });
  });

  it('lớp → xếp học sinh → em lớp 7 thấy đúng bài, đúng game, chơi ở chế độ cấp 2', async () => {
    // Tạo lớp; trùng tên (khác hoa thường) với lớp đang dùng thì báo lỗi.
    const c7 = await asAdmin
      .post('/api/admin/classes')
      .send({ name: `${TAG} 7A`, grade: 7 })
      .expect(201);
    const class7 = c7.body as ClassGroupAdmin;
    expect(class7).toMatchObject({ stage: 'secondary', studentCount: 0 });
    const dup = await asAdmin
      .post('/api/admin/classes')
      .send({ name: `${TAG} 7a`, grade: 7 })
      .expect(409);
    expect(dup.body.code).toBe('class_name_taken');

    // Tạo tài khoản và xếp lớp ngay.
    const created = await asAdmin
      .post('/api/admin/students')
      .send({ names: [`Bảy ${TAG}`], classId: class7.id })
      .expect(201);
    const [seven] = created.body as StudentCredentials[];
    // Em thứ hai tạo không có lớp, rồi xếp lớp sau.
    const created2 = await asAdmin
      .post('/api/admin/students')
      .send({ names: [`Ba ${TAG}`] })
      .expect(201);
    const [three] = created2.body as StudentCredentials[];
    studentIds.push(seven.id, three.id);

    const c3 = await asAdmin
      .post('/api/admin/classes')
      .send({ name: `${TAG} 3B`, grade: 3 })
      .expect(201);
    await asAdmin
      .post('/api/admin/students/assign-class')
      .send({ studentIds: [three.id], classId: c3.body.id })
      .expect(200, { updated: 1 });

    const list = (await asAdmin.get('/api/admin/students').expect(200))
      .body as StudentAdmin[];
    expect(list.find((s) => s.id === seven.id)?.classGroup).toMatchObject({
      id: class7.id,
      grade: 7,
      stage: 'secondary',
    });

    // Hồ sơ của em mang cấp học.
    const loginRes = await http()
      .post('/api/play/auth/login')
      .send({ username: seven.username, password: seven.password })
      .expect(200);
    expect(loginRes.body as StudentProfile).toMatchObject({
      stage: 'secondary',
      grade: 7,
    });
    const cookie7 = studentCookie(loginRes);
    const login3 = await http()
      .post('/api/play/auth/login')
      .send({ username: three.username, password: three.password })
      .expect(200);
    const cookie3 = studentCookie(login3);

    // Em lớp 7: bài cấp 2 + bài cả hai cấp; không thấy bài tiểu học hay bài khối 8.
    const info7 = (
      await http().get(`/api/play/games/${GAME}`).set('Cookie', cookie7)
    ).body as PlayGameInfo;
    const seen7 = info7.lessons.map((l) => l.id);
    expect(seen7).toContain(lessons.secondary);
    expect(seen7).toContain(lessons.both);
    expect(seen7).not.toContain(lessons.primary);
    expect(seen7).not.toContain(lessons.grade8);

    // Em lớp 3 thấy bài tiểu học, như trước.
    const info3 = (
      await http().get(`/api/play/games/${GAME}`).set('Cookie', cookie3)
    ).body as PlayGameInfo;
    expect(info3.lessons.map((l) => l.id)).toEqual(
      expect.arrayContaining([lessons.primary, lessons.both]),
    );
    expect(info3.lessons.map((l) => l.id)).not.toContain(lessons.secondary);

    // Cùng một bài dùng chung: em lớp 7 nhận chế độ cấp 2, em lớp 3 chế độ tiểu học.
    const start7 = await http()
      .post('/api/play/sessions')
      .set('Cookie', cookie7)
      .send({ gameSlug: GAME, lessonId: lessons.both })
      .expect(201);
    expect((start7.body as StartSessionResponse).content.stage).toBe(
      'secondary',
    );
    const start3 = await http()
      .post('/api/play/sessions')
      .set('Cookie', cookie3)
      .send({ gameSlug: GAME, lessonId: lessons.both })
      .expect(201);
    expect((start3.body as StartSessionResponse).content.stage).toBe('primary');

    // Bài tiểu học không mở được cho em lớp 7, kể cả gọi thẳng API.
    const denied = await http()
      .post('/api/play/sessions')
      .set('Cookie', cookie7)
      .send({ gameSlug: GAME, lessonId: lessons.primary })
      .expect(409);
    expect(denied.body.code).toBe('lesson_unavailable');

    // Game chỉ dành cho tiểu học / tới lớp 6 thì em lớp 7 không chơi được.
    const pic = (
      await http().get('/api/play/games/picture-quiz').set('Cookie', cookie7)
    ).body as PlayGameInfo;
    expect(pic.isEnabled).toBe(false);
    const fun = await http()
      .post('/api/play/sessions')
      .set('Cookie', cookie7)
      .send({ gameSlug: 'pet-care', lessonId: lessons.both })
      .expect(409);
    expect(fun.body.code).toBe('game_unavailable');

    // Lớp còn học sinh thì không xoá được; lưu trữ thì không xếp thêm em vào được.
    const notEmpty = await asAdmin
      .del(`/api/admin/classes/${class7.id}`)
      .expect(409);
    expect(notEmpty.body.code).toBe('class_not_empty');
    await asAdmin
      .patch(`/api/admin/classes/${class7.id}`)
      .send({ isArchived: true })
      .expect(200);
    const archived = await asAdmin
      .post('/api/admin/students/assign-class')
      .send({ studentIds: [three.id], classId: class7.id })
      .expect(409);
    expect(archived.body.code).toBe('class_archived');

    // Bỏ khỏi lớp → em được coi như tiểu học.
    await asAdmin
      .post('/api/admin/students/assign-class')
      .send({ studentIds: [seven.id], classId: null })
      .expect(200);
    const me = await http().get('/api/play/auth/me').set('Cookie', cookie7);
    expect(me.body as StudentProfile).toMatchObject({
      stage: 'primary',
      grade: null,
      className: null,
    });
    // Lớp trống thì xoá được.
    await asAdmin.del(`/api/admin/classes/${class7.id}`).expect(204);
  });
});
