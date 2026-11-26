// Giai đoạn 3 — tài khoản học sinh + vòng lặp chơi trên database thật. Cần `npm run db:up`.
// Test chỉ tạo dữ liệu có tiền tố riêng, xoá hết khi xong và trả cấu hình game về như cũ.
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type {
  FinishSessionResponse,
  GameAdmin,
  PlayGameInfo,
  StartSessionResponse,
  StudentAdmin,
  StudentCredentials,
  StudentDetail,
  StudentProfile,
} from '@novel/shared';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, loginAsTestAdmin } from './helpers.js';

const TAG = `e2e${process.pid}`;
const GAME = 'word-quiz';

function studentCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ng_student='));
  if (!cookie) throw new Error('Không có cookie ng_student trong phản hồi');
  return cookie.split(';')[0];
}

describe('Student accounts + play loop (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: string;
  let cleanupAdmin: () => Promise<void>;
  let originalGame: GameAdmin;
  let lessonId: string;
  const studentIds: string[] = [];
  const http = () => request(app.getHttpServer());

  const login = (username: string, password: string) =>
    http().post('/api/play/auth/login').send({ username, password });

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    ({ cookie: admin, cleanup: cleanupAdmin } = await loginAsTestAdmin(
      app,
      `${TAG}-admin`,
    ));

    // Một bài học riêng có 5 từ (không cần hình) gán cho Word Quiz.
    const cat = await http()
      .post('/api/admin/categories')
      .set('Cookie', admin)
      .send({ name: `${TAG} Play` })
      .expect(201);
    const ids: string[] = [];
    for (const [word, meaning] of [
      ['ant', 'con kiến'],
      ['bee', 'con ong'],
      ['cow', 'con bò'],
      ['dog', 'con chó'],
      ['eel', 'con lươn'],
    ]) {
      const res = await http()
        .post('/api/admin/vocabulary')
        .set('Cookie', admin)
        .send({ word, meaning, categoryId: cat.body.id })
        .expect(201);
      ids.push(res.body.id);
    }
    const lesson = await http()
      .post('/api/admin/lessons')
      .set('Cookie', admin)
      .send({ title: `${TAG} lesson`, isPublished: true })
      .expect(201);
    lessonId = lesson.body.id;
    await http()
      .put(`/api/admin/lessons/${lessonId}/words`)
      .set('Cookie', admin)
      .send({ vocabularyIds: ids })
      .expect(200);

    const games = await http()
      .get('/api/admin/games')
      .set('Cookie', admin)
      .expect(200);
    originalGame = (games.body as GameAdmin[]).find((g) => g.slug === GAME)!;
    await http()
      .patch(`/api/admin/games/${GAME}`)
      .set('Cookie', admin)
      .send({
        isEnabled: true,
        config: { wordsPerRound: 4, timeLimitSec: 0 },
        lessonIds: [...originalGame.lessonIds, lessonId],
      })
      .expect(200);
  });

  afterAll(async () => {
    await http().patch(`/api/admin/games/${GAME}`).set('Cookie', admin).send({
      isEnabled: originalGame.isEnabled,
      config: originalGame.config,
      lessonIds: originalGame.lessonIds,
    });
    await prisma.playSession.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
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

  it('khu chơi cần học sinh đăng nhập; khu quản lý học sinh cần giáo viên', async () => {
    for (const [method, path] of [
      ['get', '/api/play/auth/me'],
      ['get', `/api/play/games/${GAME}`],
      ['post', '/api/play/sessions'],
      ['get', '/api/play/sessions'],
      ['get', '/api/admin/students'],
      ['post', '/api/admin/students'],
    ] as const) {
      const res = await http()[method](path);
      expect({ path, status: res.status }).toEqual({ path, status: 401 });
    }
    // Cookie giáo viên không mở được khu chơi.
    await http().get('/api/play/auth/me').set('Cookie', admin).expect(401);
  });

  it('luồng chính: tạo học sinh → đăng nhập → chơi → nhận sao → giáo viên thấy lượt chơi', async () => {
    // 1. Giáo viên tạo 2 tài khoản một lần
    const created = await http()
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send({ names: [`Nguyễn Văn An ${TAG}`, `Lê Thị Ánh ${TAG}`] })
      .expect(201);
    const creds = created.body as StudentCredentials[];
    studentIds.push(...creds.map((c) => c.id));
    expect(creds).toHaveLength(2);
    for (const c of creds) {
      expect(c.username).toMatch(/^[a-z][a-z0-9]{2,19}$/);
      expect(c.password).toMatch(/^[a-z]+\d{3}$/);
    }
    const [an] = creds;

    // Cookie học sinh không mở được khu giáo viên.
    const loginRes = await login(an.username.toUpperCase(), an.password).expect(
      200,
    );
    const student = studentCookie(loginRes);
    expect((loginRes.body as StudentProfile).totalStars).toBe(0);
    await http().get('/api/admin/students').set('Cookie', student).expect(401);
    await login(an.username, 'wrong-password').expect(401);

    // 2. Chọn bài học
    const info = await http()
      .get(`/api/play/games/${GAME}`)
      .set('Cookie', student)
      .expect(200);
    const lesson = (info.body as PlayGameInfo).lessons.find(
      (l) => l.id === lessonId,
    );
    expect(lesson).toMatchObject({ wordCount: 5 });

    // 3. Bắt đầu lượt: nhận đúng số từ cấu hình
    const started = await http()
      .post('/api/play/sessions')
      .set('Cookie', student)
      .send({ gameSlug: GAME, lessonId })
      .expect(201);
    const { content } = started.body as StartSessionResponse;
    expect(content.words).toHaveLength(4);
    const sessionUrl = `/api/play/sessions/${content.sessionId}/finish`;

    // Từ không được phát → từ chối
    await http()
      .post(sessionUrl)
      .set('Cookie', student)
      .send({
        score: 0,
        durationMs: 1000,
        answers: [{ vocabularyId: 'not-issued', correct: true, attempts: 1 }],
      })
      .expect(400);

    // 4. Kết thúc: 3/4 đúng = 75% → 2 sao; từ sai hiện lại kèm nghĩa
    const [w1, w2, w3, w4] = content.words;
    const finished = await http()
      .post(sessionUrl)
      .set('Cookie', student)
      .send({
        score: 30,
        durationMs: 12_000,
        answers: [
          { vocabularyId: w1.id, correct: true, attempts: 1 },
          { vocabularyId: w2.id, correct: true, attempts: 1 },
          { vocabularyId: w3.id, correct: true, attempts: 2 },
          { vocabularyId: w4.id, correct: false, attempts: 3 },
        ],
      })
      .expect(200);
    const result = finished.body as FinishSessionResponse;
    expect(result).toMatchObject({
      stars: 2,
      correctCount: 3,
      wrongCount: 1,
      totalWords: 4,
      totalStars: 2,
    });
    expect(result.mistakes.map((m) => m.word)).toEqual([w4.word]);
    expect(result.mistakes[0].meaning).toBeTruthy();

    // Gửi lại lần 2 → bị chặn, sao không cộng thêm
    const again = await http()
      .post(sessionUrl)
      .set('Cookie', student)
      .send({ score: 999, durationMs: 1, answers: [] })
      .expect(409);
    expect(again.body.code).toBe('session_finished');
    const me = await http()
      .get('/api/play/auth/me')
      .set('Cookie', student)
      .expect(200);
    expect((me.body as StudentProfile).totalStars).toBe(2);

    // Bạn khác không gửi kết quả hộ được
    const other = studentCookie(
      await login(creds[1].username, creds[1].password).expect(200),
    );
    await http()
      .post(sessionUrl)
      .set('Cookie', other)
      .send({ score: 0, durationMs: 1, answers: [] })
      .expect(404);

    // 5. Học sinh thấy lịch sử của mình; giáo viên thấy lượt chơi trong hồ sơ em
    const mine = await http()
      .get('/api/play/sessions')
      .set('Cookie', student)
      .expect(200);
    expect(mine.body).toHaveLength(1);

    const detail = await http()
      .get(`/api/admin/students/${an.id}`)
      .set('Cookie', admin)
      .expect(200);
    const d = detail.body as StudentDetail;
    expect(d).toMatchObject({ totalStars: 2, sessionCount: 1 });
    expect(d.sessions[0]).toMatchObject({
      gameSlug: GAME,
      gameName: 'Word Quiz',
      lessonTitle: `${TAG} lesson`,
      stars: 2,
      correctCount: 3,
      wrongCount: 1,
    });
    const list = await http()
      .get('/api/admin/students')
      .set('Cookie', admin)
      .expect(200);
    const row = (list.body as StudentAdmin[]).find((s) => s.id === an.id);
    expect(row?.lastPlayedAt).toBeTruthy();

    // Em đã có lịch sử → không xoá được; em chưa chơi → xoá được
    const del = await http()
      .delete(`/api/admin/students/${an.id}`)
      .set('Cookie', admin)
      .expect(409);
    expect(del.body.code).toBe('student_has_history');
  });

  it('bỏ qua từ ở game không tính giờ thì tính là sai', async () => {
    const created = await http()
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send({ names: [`Skip ${TAG}`] })
      .expect(201);
    const [c] = created.body as StudentCredentials[];
    studentIds.push(c.id);
    const cookie = studentCookie(await login(c.username, c.password));
    const started = await http()
      .post('/api/play/sessions')
      .set('Cookie', cookie)
      .send({ gameSlug: GAME, lessonId })
      .expect(201);
    const { content } = started.body as StartSessionResponse;
    const res = await http()
      .post(`/api/play/sessions/${content.sessionId}/finish`)
      .set('Cookie', cookie)
      .send({
        score: 10,
        durationMs: 1000,
        answers: [
          { vocabularyId: content.words[0].id, correct: true, attempts: 1 },
        ],
      })
      .expect(200);
    expect(res.body).toMatchObject({
      stars: 1,
      correctCount: 1,
      wrongCount: 3,
    });
    expect((res.body as FinishSessionResponse).mistakes).toHaveLength(3);
  });

  it('game tắt hoặc bài học không gán cho game thì không bắt đầu được', async () => {
    const created = await http()
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send({ names: [`Guard ${TAG}`] })
      .expect(201);
    const [c] = created.body as StudentCredentials[];
    studentIds.push(c.id);
    const cookie = studentCookie(await login(c.username, c.password));

    const wrongGame = await http()
      .post('/api/play/sessions')
      .set('Cookie', cookie)
      .send({ gameSlug: 'picture-match', lessonId })
      .expect(409);
    expect(wrongGame.body.code).toBe('lesson_unavailable');

    await http()
      .patch(`/api/admin/games/${GAME}`)
      .set('Cookie', admin)
      .send({ isEnabled: false })
      .expect(200);
    try {
      const off = await http()
        .post('/api/play/sessions')
        .set('Cookie', cookie)
        .send({ gameSlug: GAME, lessonId })
        .expect(409);
      expect(off.body.code).toBe('game_unavailable');
    } finally {
      await http()
        .patch(`/api/admin/games/${GAME}`)
        .set('Cookie', admin)
        .send({ isEnabled: true })
        .expect(200);
    }

    // Em chưa chơi lượt nào → xoá được
    await http()
      .delete(`/api/admin/students/${c.id}`)
      .set('Cookie', admin)
      .expect(204);
  });

  it('đặt lại mật khẩu và khoá tài khoản đăng xuất em khỏi mọi máy', async () => {
    const created = await http()
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send({ names: [`Reset ${TAG}`] })
      .expect(201);
    const [c] = created.body as StudentCredentials[];
    studentIds.push(c.id);
    const oldCookie = studentCookie(await login(c.username, c.password));
    // Phiên tính theo giây: đợi sang giây mới để "trước khi đặt lại" rõ ràng.
    await new Promise((r) => setTimeout(r, 1100));

    const reset = await http()
      .post(`/api/admin/students/${c.id}/reset-password`)
      .set('Cookie', admin)
      .expect(200);
    const { password } = reset.body as StudentCredentials;
    expect(password).not.toBe(c.password);
    await http().get('/api/play/auth/me').set('Cookie', oldCookie).expect(401);
    await login(c.username, c.password).expect(401);
    const fresh = studentCookie(await login(c.username, password).expect(200));
    await http().get('/api/play/auth/me').set('Cookie', fresh).expect(200);

    await new Promise((r) => setTimeout(r, 1100));
    await http()
      .patch(`/api/admin/students/${c.id}`)
      .set('Cookie', admin)
      .send({ isActive: false })
      .expect(200);
    await http().get('/api/play/auth/me').set('Cookie', fresh).expect(401);
    const blocked = await login(c.username, password).expect(403);
    expect(blocked.body.code).toBe('account_disabled');
  });

  // Tiêu chí "xong" của MVP: sửa nghĩa một từ trong Admin → lượt chơi tiếp theo thấy ngay.
  it('giáo viên sửa nghĩa một từ thì lượt chơi tiếp theo nhận ngay bản mới', async () => {
    const created = await http()
      .post('/api/admin/students')
      .set('Cookie', admin)
      .send({ names: [`Edit ${TAG}`] })
      .expect(201);
    const [c] = created.body as StudentCredentials[];
    studentIds.push(c.id);
    const cookie = studentCookie(await login(c.username, c.password));
    const start = async () => {
      const res = await http()
        .post('/api/play/sessions')
        .set('Cookie', cookie)
        .send({ gameSlug: GAME, lessonId })
        .expect(201);
      return (res.body as StartSessionResponse).content;
    };

    // Phát đủ cả 5 từ của bài để chắc chắn có từ được sửa.
    const setWordsPerRound = (wordsPerRound: number) =>
      http()
        .patch(`/api/admin/games/${GAME}`)
        .set('Cookie', admin)
        .send({ config: { wordsPerRound, timeLimitSec: 0 } })
        .expect(200);
    await setWordsPerRound(5);
    try {
      const before = await start();
      const ant = before.words.find((w) => w.word === 'ant')!;
      expect(ant.meaning).toBe('con kiến');

      await http()
        .patch(`/api/admin/vocabulary/${ant.id}`)
        .set('Cookie', admin)
        .send({ meaning: 'chú kiến nhỏ', ipa: '/ænt/' })
        .expect(200);

      const after = await start();
      expect(after.words.find((w) => w.id === ant.id)).toMatchObject({
        meaning: 'chú kiến nhỏ',
        ipa: '/ænt/',
      });

      // Màn kết quả (ôn lại từ sai) cũng hiện nghĩa mới.
      const finished = await http()
        .post(`/api/play/sessions/${after.sessionId}/finish`)
        .set('Cookie', cookie)
        .send({ score: 0, durationMs: 1000, answers: [] })
        .expect(200);
      const mistakes = (finished.body as FinishSessionResponse).mistakes;
      expect(mistakes.find((w) => w.id === ant.id)?.meaning).toBe(
        'chú kiến nhỏ',
      );
    } finally {
      await setWordsPerRound(4);
    }
  });
});
