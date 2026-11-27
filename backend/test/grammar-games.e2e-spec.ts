// C4 — game ngữ pháp chơi bằng câu hỏi của Unit, trên database thật. Cần `npm run db:up`.
// Test tạo lớp, học sinh, Unit, câu hỏi, đoạn văn riêng (có TAG); xoá hết và trả cấu hình
// game về như cũ khi xong. Dùng grammar-rush: không file e2e nào khác sửa game này.
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type {
  FinishSessionResponse,
  GameAdmin,
  LessonGamePreview,
  PlayGameInfo,
  QuestionAdmin,
  StartSessionResponse,
  StudentCredentials,
} from '@novel/shared';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, loginAsTestAdmin } from './helpers.js';

const TAG = `e2g${process.pid}`;
const GAME = 'grammar-rush';

function studentCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ng_student='));
  if (!cookie) throw new Error('Không có cookie ng_student');
  return cookie.split(';')[0];
}

describe('Grammar games (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: string;
  let cleanupAdmin: () => Promise<void>;
  let originalGame: GameAdmin;
  let lessonId: string;
  let classId: string;
  const studentIds: string[] = [];
  const mcq: QuestionAdmin[] = [];
  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(p).set('Cookie', cookie),
    post: (p: string) => http().post(p).set('Cookie', cookie),
    put: (p: string) => http().put(p).set('Cookie', cookie),
    patch: (p: string) => http().patch(p).set('Cookie', cookie),
  });

  async function newStudent(name: string, cls: string | null) {
    const res = await as(admin)
      .post('/api/admin/students')
      .send({ names: [`${name} ${TAG}`], classId: cls })
      .expect(201);
    const [cred] = res.body as StudentCredentials[];
    studentIds.push(cred.id);
    const login = await http()
      .post('/api/play/auth/login')
      .send({ username: cred.username, password: cred.password })
      .expect(200);
    return studentCookie(login);
  }

  const question = async (body: Record<string, unknown>) =>
    (
      await as(admin)
        .post('/api/admin/questions')
        .send({ grammarTag: TAG, ...body })
        .expect(201)
    ).body as QuestionAdmin;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    ({ cookie: admin, cleanup: cleanupAdmin } = await loginAsTestAdmin(
      app,
      `${TAG}-admin`,
    ));
    const cls = await as(admin)
      .post('/api/admin/classes')
      .send({ name: `${TAG}7A`, grade: 7 })
      .expect(201);
    classId = cls.body.id;

    // Unit: 4 câu trắc nghiệm (đáp án B), 1 câu sắp xếp (game khác),
    // 1 câu trắc nghiệm thuộc đoạn văn (game không dùng).
    for (let i = 0; i < 4; i++) {
      mcq.push(
        await question({
          type: 'mcq',
          prompt: `She ___ to school ${i}.`,
          options: ['go', 'goes', 'going', 'gone'],
          correct: 1,
        }),
      );
    }
    const reorder = await question({
      type: 'reorder',
      prompt: 'Sắp xếp',
      options: ['I', 'go', 'to school'],
      accepted: ['I go to school'],
    });
    const passage = await as(admin)
      .post('/api/admin/passages')
      .send({ title: `${TAG} đoạn`, text: 'Tom lives in Hanoi.' })
      .expect(201);
    const inPassage = await question({
      type: 'mcq',
      prompt: 'Where does Tom live?',
      options: ['Hanoi', 'Hue'],
      correct: 0,
      passageId: passage.body.id,
    });
    const lesson = await as(admin)
      .post('/api/admin/lessons')
      .send({ title: `${TAG} Unit`, isPublished: true, stage: 'secondary' })
      .expect(201);
    lessonId = lesson.body.id;
    await as(admin)
      .put(`/api/admin/lessons/${lessonId}/questions`)
      .send({
        questionIds: [...mcq.map((q) => q.id), reorder.id, inPassage.id],
      })
      .expect(200);

    const games = await as(admin).get('/api/admin/games').expect(200);
    originalGame = (games.body as GameAdmin[]).find((g) => g.slug === GAME)!;
    await as(admin)
      .patch(`/api/admin/games/${GAME}`)
      .send({
        isEnabled: true,
        config: { wordsPerRound: 4, timeLimitSec: 0 },
        lessonIds: [...originalGame.lessonIds, lessonId],
      })
      .expect(200);
  });

  afterAll(async () => {
    await as(admin).patch(`/api/admin/games/${GAME}`).send({
      isEnabled: originalGame.isEnabled,
      config: originalGame.config,
      lessonIds: originalGame.lessonIds,
    });
    await prisma.playSession.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.classGroup.deleteMany({ where: { id: classId } });
    await prisma.lesson.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.question.deleteMany({ where: { grammarTag: TAG } });
    await prisma.passage.deleteMany({ where: { title: { startsWith: TAG } } });
    await cleanupAdmin();
    await app.close();
  });

  it('giáo viên xem trước: game nhận 4 câu đúng dạng, câu thuộc đoạn văn bị loại', async () => {
    const res = await as(admin)
      .get(`/api/admin/lessons/${lessonId}/preview`)
      .expect(200);
    const rush = (res.body as LessonGamePreview[]).find(
      (p) => p.gameSlug === GAME,
    )!;
    expect(rush).toMatchObject({ playable: true, questionCount: 4, words: [] });
    expect(rush.excluded.map((e) => e.reason)).toEqual([
      'Thuộc một đoạn văn (chỉ dùng trong đề)',
    ]);
    // Không lộ đáp án ra màn xem trước.
    expect(rush).not.toHaveProperty('questions');
    const builder = (res.body as LessonGamePreview[]).find(
      (p) => p.gameSlug === 'sentence-builder',
    )!;
    expect(builder).toMatchObject({ playable: false, questionCount: 1 });
  });

  it('em tiểu học không chơi được game ngữ pháp', async () => {
    const primary = await newStudent('Tiểu học', null);
    const info = await as(primary).get(`/api/play/games/${GAME}`).expect(200);
    expect(info.body).toMatchObject({ isEnabled: false, lessons: [] });
  });

  it('em cấp 2 chơi: máy chủ chấm lại câu trả lời, không tin máy em', async () => {
    const cookie = await newStudent('Cấp 2', classId);
    const info = (await as(cookie).get(`/api/play/games/${GAME}`).expect(200))
      .body as PlayGameInfo;
    expect(info.lessons.find((l) => l.id === lessonId)).toMatchObject({
      questionCount: 4,
    });

    const start = async () =>
      (
        await as(cookie)
          .post('/api/play/sessions')
          .send({ gameSlug: GAME, lessonId })
          .expect(201)
      ).body as StartSessionResponse;
    const { content } = await start();
    expect(content.words).toEqual([]);
    expect(content.questions).toHaveLength(4);
    expect(content.questions[0]).toMatchObject({ correct: 1, passageId: null });
    const url = `/api/play/sessions/${content.sessionId}/finish`;
    const ids = content.questions.map((q) => q.id);

    // Câu không thuộc lượt, câu trả lời sai kiểu, từ vựng gửi vào lượt câu hỏi → từ chối.
    for (const bad of [
      { questionAnswers: [{ questionId: 'nope', response: 1, attempts: 1 }] },
      {
        questionAnswers: [
          { questionId: ids[0], response: 'goes', attempts: 1 },
        ],
      },
      { answers: [{ vocabularyId: 'w1', correct: true, attempts: 1 }] },
    ]) {
      await as(cookie)
        .post(url)
        .send({ score: 0, durationMs: 1000, answers: [], ...bad })
        .expect(400);
    }

    // 3 câu đúng (B), 1 câu sai → 75% → 2 sao. Điểm em gửi được giữ, sao do máy chủ tính.
    const finished = await as(cookie)
      .post(url)
      .send({
        score: 999,
        durationMs: 20_000,
        answers: [],
        questionAnswers: ids.map((questionId, i) => ({
          questionId,
          response: i === 0 ? 0 : 1,
          attempts: 1,
        })),
      })
      .expect(200);
    expect(finished.body as FinishSessionResponse).toMatchObject({
      stars: 2,
      correctCount: 3,
      wrongCount: 1,
      totalWords: 4,
      mistakes: [],
    });
    const rows = await prisma.playQuestionAnswer.findMany({
      where: { sessionId: content.sessionId },
    });
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.questionId === ids[0])).toMatchObject({
      correct: false,
      response: 0,
    });

    // Bỏ trống hết (game không tính giờ) → 0 câu đúng trên 4 câu được phát.
    const second = await start();
    const empty = await as(cookie)
      .post(`/api/play/sessions/${second.content.sessionId}/finish`)
      .send({ score: 0, durationMs: 1000, answers: [], questionAnswers: [] })
      .expect(200);
    expect(empty.body).toMatchObject({ stars: 0, correctCount: 0 });
  });
});
