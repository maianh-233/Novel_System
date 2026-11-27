// C3 — bài tập về nhà trên database thật. Cần `npm run db:up`.
// Test tạo lớp, học sinh, Unit, đề, bài tập riêng (tên bắt đầu bằng TAG); xoá hết và trả
// cấu hình game về như cũ khi xong.
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type {
  AssignmentDetail,
  AttemptResponse,
  GameAdmin,
  PlayAssignment,
  QuestionAdmin,
  StartSessionResponse,
  StudentCredentials,
} from '@novel/shared';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, loginAsTestAdmin } from './helpers.js';

const TAG = `e2h${process.pid}`;
// Game riêng cho test này: các file e2e chạy song song, file khác đã sửa word-quiz / word-runner.
const GAME = 'missing-letters';
const inDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString();

function studentCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ng_student='));
  if (!cookie) throw new Error('Không có cookie ng_student');
  return cookie.split(';')[0];
}

describe('Assignments (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: string;
  let cleanupAdmin: () => Promise<void>;
  let originalGame: GameAdmin;
  let lessonId: string;
  let examId: string;
  const cls: Record<'a7' | 'b7' | 'p3', string> = {} as never;
  const studentIds: string[] = [];
  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(p).set('Cookie', cookie),
    post: (p: string) => http().post(p).set('Cookie', cookie),
    patch: (p: string) => http().patch(p).set('Cookie', cookie),
    put: (p: string) => http().put(p).set('Cookie', cookie),
    delete: (p: string) => http().delete(p).set('Cookie', cookie),
  });

  async function newStudent(name: string, classId: string) {
    const res = await as(admin)
      .post('/api/admin/students')
      .send({ names: [`${name} ${TAG}`], classId })
      .expect(201);
    const [cred] = res.body as StudentCredentials[];
    studentIds.push(cred.id);
    const login = await http()
      .post('/api/play/auth/login')
      .send({ username: cred.username, password: cred.password })
      .expect(200);
    return { id: cred.id, cookie: studentCookie(login) };
  }

  /** Chơi một lượt Word Quiz: đúng `correct` trên 4 từ. */
  async function play(cookie: string, correct: number) {
    const started = await as(cookie)
      .post('/api/play/sessions')
      .send({ gameSlug: GAME, lessonId })
      .expect(201);
    const { content } = started.body as StartSessionResponse;
    await as(cookie)
      .post(`/api/play/sessions/${content.sessionId}/finish`)
      .send({
        score: 10,
        durationMs: 5000,
        answers: content.words.map((w, i) => ({
          vocabularyId: w.id,
          correct: i < correct,
          attempts: 1,
        })),
      })
      .expect(200);
  }

  const mine = async (cookie: string) =>
    (
      (await as(cookie).get('/api/play/assignments').expect(200))
        .body as PlayAssignment[]
    ).filter((a) => a.title.startsWith(TAG));

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    ({ cookie: admin, cleanup: cleanupAdmin } = await loginAsTestAdmin(
      app,
      `${TAG}-admin`,
    ));
    for (const [key, name, grade] of [
      ['a7', '7A', 7],
      ['b7', '7B', 7],
      ['p3', '3A', 3],
    ] as const) {
      const c = await as(admin)
        .post('/api/admin/classes')
        .send({ name: `${TAG}${name}`.slice(-20), grade })
        .expect(201);
      cls[key] = c.body.id;
    }

    // Unit cấp 2 có 4 từ, gán cho Word Quiz (4 từ mỗi lượt, không tính giờ).
    const cat = await as(admin)
      .post('/api/admin/categories')
      .send({ name: `${TAG} Hw` })
      .expect(201);
    const ids: string[] = [];
    for (const [word, meaning] of [
      ['ant', 'con kiến'],
      ['bee', 'con ong'],
      ['cow', 'con bò'],
      ['dog', 'con chó'],
    ]) {
      const res = await as(admin)
        .post('/api/admin/vocabulary')
        .send({ word, meaning, categoryId: cat.body.id })
        .expect(201);
      ids.push(res.body.id);
    }
    const lesson = await as(admin)
      .post('/api/admin/lessons')
      .send({ title: `${TAG} Unit 3`, isPublished: true, stage: 'secondary' })
      .expect(201);
    lessonId = lesson.body.id;
    await as(admin)
      .put(`/api/admin/lessons/${lessonId}/words`)
      .send({ vocabularyIds: ids })
      .expect(200);
    const games = await as(admin).get('/api/admin/games').expect(200);
    originalGame = (games.body as GameAdmin[]).find((g) => g.slug === GAME)!;

    // Đề cấp 2 một câu, luyện tập.
    const q = (
      await as(admin)
        .post('/api/admin/questions')
        .send({
          grammarTag: TAG,
          type: 'mcq',
          prompt: 'She ___ to school.',
          options: ['go', 'goes', 'going', 'gone'],
          correct: 1,
        })
        .expect(201)
    ).body as QuestionAdmin;
    const exam = await as(admin)
      .post('/api/admin/exams')
      .send({ title: `${TAG} Đề`, mode: 'practice', maxAttempts: 0 })
      .expect(201);
    examId = exam.body.id;
    await as(admin)
      .put(`/api/admin/exams/${examId}/structure`)
      .send({
        sections: [{ title: 'P1', items: [{ questionId: q.id, points: 1 }] }],
      })
      .expect(200);
  });

  afterAll(async () => {
    await as(admin).patch(`/api/admin/games/${GAME}`).send({
      isEnabled: originalGame.isEnabled,
      config: originalGame.config,
      lessonIds: originalGame.lessonIds,
    });
    await prisma.assignment.deleteMany({
      where: { title: { startsWith: TAG } },
    });
    await prisma.playSession.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.exam.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.question.deleteMany({ where: { grammarTag: TAG } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.classGroup.deleteMany({
      where: { id: { in: Object.values(cls) } },
    });
    await prisma.lesson.deleteMany({ where: { title: { startsWith: TAG } } });
    const cats = await prisma.category.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    await prisma.vocabulary.deleteMany({
      where: { categoryId: { in: cats.map((c) => c.id) } },
    });
    await prisma.category.deleteMany({
      where: { id: { in: cats.map((c) => c.id) } },
    });
    await cleanupAdmin();
    await app.close();
  });

  it('cần đăng nhập đúng vai', async () => {
    await http().get('/api/admin/assignments').expect(401);
    await http().get('/api/play/assignments').expect(401);
  });

  it('từ chối nội dung học sinh không làm được', async () => {
    const base = {
      title: `${TAG} lỗi`,
      kind: 'lesson_game',
      lessonId,
      gameSlug: GAME,
      dueAt: inDays(3),
      classIds: [cls.a7],
    };
    // Game chưa gán cho Unit
    let res = await as(admin)
      .post('/api/admin/assignments')
      .send(base)
      .expect(400);
    expect(res.body.code).toBe('game_not_in_lesson');

    await as(admin)
      .patch(`/api/admin/games/${GAME}`)
      .send({
        isEnabled: true,
        config: { wordsPerRound: 4, timeLimitSec: 0 },
        lessonIds: [...originalGame.lessonIds, lessonId],
      })
      .expect(200);

    // Unit cấp 2 giao cho lớp 3
    res = await as(admin)
      .post('/api/admin/assignments')
      .send({ ...base, classIds: [cls.a7, cls.p3] })
      .expect(400);
    expect(res.body.code).toBe('audience_mismatch');

    // Đề chưa công khai
    res = await as(admin)
      .post('/api/admin/assignments')
      .send({ ...base, kind: 'exam', examId })
      .expect(400);
    expect(res.body.code).toBe('exam_unpublished');

    // Không chọn lớp
    await as(admin)
      .post('/api/admin/assignments')
      .send({ ...base, classIds: [] })
      .expect(400);
  });

  it('bài game: em đủ sao là xong, em chưa làm hiện ở đầu bảng, qua hạn là quá hạn', async () => {
    const an = await newStudent('An', cls.a7);
    const binh = await newStudent('Bình', cls.a7);
    const other = await newStudent('Chi', cls.b7);
    // Lượt chơi trước lúc giao bài không tính.
    await play(an.cookie, 4);

    const created = await as(admin)
      .post('/api/admin/assignments')
      .send({
        title: `${TAG} Unit 3 – Word Quiz`,
        kind: 'lesson_game',
        lessonId,
        gameSlug: GAME,
        minStars: 2,
        dueAt: inDays(3),
        classIds: [cls.a7],
      })
      .expect(201);
    const id = (created.body as AssignmentDetail).id;
    expect(created.body).toMatchObject({ studentCount: 2, doneCount: 0 });

    // Em lớp khác không thấy bài.
    expect(await mine(other.cookie)).toEqual([]);

    // An: 1/4 đúng = 1 sao → chưa xong; 3/4 = 2 sao → xong.
    await play(an.cookie, 1);
    let [a] = await mine(an.cookie);
    expect(a).toMatchObject({
      status: 'todo',
      best: 1,
      open: { kind: 'lesson_game', gameSlug: GAME, lessonId },
    });
    await play(an.cookie, 3);
    [a] = await mine(an.cookie);
    expect(a).toMatchObject({ status: 'done', best: 2 });

    let detail = (
      await as(admin).get(`/api/admin/assignments/${id}`).expect(200)
    ).body as AssignmentDetail;
    expect(detail.doneCount).toBe(1);
    expect(
      detail.rows.map((r) => [r.student.id, r.status, r.best, r.tries]),
    ).toEqual([
      [binh.id, 'todo', null, 0],
      [an.id, 'done', 2, 2],
    ]);

    // Dời hạn về quá khứ: Bình thành quá hạn.
    await as(admin)
      .patch(`/api/admin/assignments/${id}`)
      .send({ dueAt: inDays(-1) })
      .expect(200);
    detail = (await as(admin).get(`/api/admin/assignments/${id}`).expect(200))
      .body as AssignmentDetail;
    expect(detail.rows[0]).toMatchObject({
      student: { id: binh.id },
      status: 'overdue',
    });
    // An xong sau hạn mới → "nộp muộn".
    expect(detail.rows[1]).toMatchObject({ status: 'late' });
    [a] = await mine(binh.cookie);
    expect(a.status).toBe('overdue');

    // Danh sách của giáo viên có tiến độ.
    const list = (await as(admin).get('/api/admin/assignments').expect(200))
      .body as AssignmentDetail[];
    expect(list.find((x) => x.id === id)).toMatchObject({
      studentCount: 2,
      doneCount: 1,
    });

    await as(admin).delete(`/api/admin/assignments/${id}`).expect(204);
    expect(await mine(an.cookie)).toEqual([]);
  });

  it('bài đề giao cho tất cả: nộp bài là xong, có điểm', async () => {
    await as(admin)
      .patch(`/api/admin/exams/${examId}`)
      .send({ isPublished: true })
      .expect(200);
    const dung = await newStudent('Dũng', cls.b7);
    const em3 = await newStudent('Em', cls.p3);

    const created = await as(admin)
      .post('/api/admin/assignments')
      .send({
        title: `${TAG} Làm đề`,
        kind: 'exam',
        examId,
        forAll: true,
        dueAt: inDays(2),
      })
      .expect(201);
    const id = (created.body as AssignmentDetail).id;

    // Em tiểu học không được giao đề cấp 2.
    expect(await mine(em3.cookie)).toEqual([]);
    let [a] = await mine(dung.cookie);
    expect(a).toMatchObject({
      status: 'todo',
      open: { kind: 'exam', examId },
      examState: 'open',
    });

    const started = (
      await as(dung.cookie)
        .post(`/api/play/exams/${examId}/attempts`)
        .expect(200)
    ).body as AttemptResponse;
    if (started.status !== 'in_progress') throw new Error('Chưa vào làm');
    const item = started.attempt.sections[0].items[0];
    const goes = item.question.options.indexOf('goes');
    await as(dung.cookie)
      .put(`/api/play/attempts/${started.attempt.id}/answers/${item.itemId}`)
      .send({ response: goes })
      .expect(200);
    await as(dung.cookie)
      .post(`/api/play/attempts/${started.attempt.id}/submit`)
      .expect(200);

    [a] = await mine(dung.cookie);
    expect(a).toMatchObject({
      status: 'done',
      best: 10,
      attemptId: started.attempt.id,
    });
    const detail = (
      await as(admin).get(`/api/admin/assignments/${id}`).expect(200)
    ).body as AssignmentDetail;
    expect(detail.rows.find((r) => r.student.id === dung.id)).toMatchObject({
      status: 'done',
      best: 10,
    });
    expect(detail.rows.some((r) => r.student.id === em3.id)).toBe(false);
  });
});
