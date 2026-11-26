// C2 — luyện đề và thi trên database thật. Cần `npm run db:up`.
// Test tạo câu hỏi (chủ điểm = TAG), đề (tên bắt đầu bằng TAG) và học sinh riêng; xoá hết khi xong.
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type {
  AttemptResponse,
  ExamDetail,
  ExamResults,
  PlayExam,
  QuestionAdmin,
  StudentCredentials,
} from '@novel/shared';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, loginAsTestAdmin } from './helpers.js';

const TAG = `e2x${process.pid}`;

function studentCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ng_student='));
  if (!cookie) throw new Error('Không có cookie ng_student');
  return cookie.split(';')[0];
}

describe('Exams (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: string;
  let cleanupAdmin: () => Promise<void>;
  const studentIds: string[] = [];
  const q: Record<'mcq' | 'fill' | 'reorder', QuestionAdmin> = {} as never;
  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(p).set('Cookie', cookie),
    post: (p: string) => http().post(p).set('Cookie', cookie),
    put: (p: string) => http().put(p).set('Cookie', cookie),
    patch: (p: string) => http().patch(p).set('Cookie', cookie),
  });

  /** Tạo một học sinh (lớp 7) và đăng nhập. */
  async function newStudent(name: string) {
    const cls = await prisma.classGroup.create({
      data: { name: `${TAG} ${name}`, grade: 7, stage: 'secondary' },
    });
    const res = await as(admin)
      .post('/api/admin/students')
      .send({ names: [`${name} ${TAG}`], classId: cls.id })
      .expect(201);
    const [cred] = res.body as StudentCredentials[];
    studentIds.push(cred.id);
    const login = await http()
      .post('/api/play/auth/login')
      .send({ username: cred.username, password: cred.password })
      .expect(200);
    return { id: cred.id, cookie: studentCookie(login) };
  }

  /** Tạo đề công khai gồm 3 câu (2 + 1 + 1 điểm). */
  async function newExam(settings: Record<string, unknown> = {}) {
    const created = await as(admin)
      .post('/api/admin/exams')
      .send({ title: `${TAG} Đề`, isPublished: true, ...settings })
      .expect(201);
    const exam = created.body as ExamDetail;
    await as(admin)
      .put(`/api/admin/exams/${exam.id}/structure`)
      .send({
        sections: [
          {
            title: 'Ngữ pháp',
            items: [
              { questionId: q.mcq.id, points: 2 },
              { questionId: q.fill.id, points: 1 },
            ],
          },
          { title: 'Viết', items: [{ questionId: q.reorder.id, points: 1 }] },
        ],
      })
      .expect(200);
    return exam.id;
  }

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    ({ cookie: admin, cleanup: cleanupAdmin } = await loginAsTestAdmin(
      app,
      `${TAG}-admin`,
    ));
    const make = async (body: Record<string, unknown>) =>
      (
        await as(admin)
          .post('/api/admin/questions')
          .send({ grammarTag: TAG, ...body })
          .expect(201)
      ).body as QuestionAdmin;
    q.mcq = await make({
      type: 'mcq',
      prompt: 'She ___ to school.',
      options: ['go', 'goes', 'going', 'gone'],
      correct: 1,
      explanation: 'Chủ ngữ số ít.',
    });
    q.fill = await make({
      type: 'word_form',
      prompt: 'He is very ___ (friend).',
      accepted: ['friendly'],
    });
    q.reorder = await make({
      type: 'reorder',
      prompt: 'Sắp xếp',
      options: ['to school', 'I', 'go'],
      accepted: ['I go to school'],
    });
  });

  afterAll(async () => {
    await prisma.exam.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.classGroup.deleteMany({
      where: { name: { startsWith: TAG } },
    });
    await prisma.question.deleteMany({ where: { grammarTag: TAG } });
    await cleanupAdmin();
    await app.close();
  });

  /** Trả lời đúng hết theo thứ tự em thấy (lựa chọn / cụm từ đã trộn). */
  function correctAnswers(
    view: Extract<AttemptResponse, { status: 'in_progress' }>['attempt'],
  ) {
    const items = view.sections.flatMap((s) => s.items);
    return items.map((it) => {
      const opts = it.question.options;
      if (it.question.type === 'mcq')
        return { itemId: it.itemId, response: opts.indexOf('goes') };
      if (it.question.type === 'reorder')
        return {
          itemId: it.itemId,
          response: ['I', 'go', 'to school'].map((f) => opts.indexOf(f)),
        };
      return { itemId: it.itemId, response: 'Friendly.' };
    });
  }

  it('luồng chính: bắt đầu → tự lưu → vào lại làm tiếp → nộp → điểm thang 10', async () => {
    const examId = await newExam({ mode: 'practice' });
    const s = await newStudent('An');
    const st = as(s.cookie);

    const list = (await st.get('/api/play/exams').expect(200))
      .body as PlayExam[];
    expect(list.find((e) => e.id === examId)).toMatchObject({
      state: 'open',
      questionCount: 3,
      attemptsUsed: 0,
    });

    const started = (
      await st.post(`/api/play/exams/${examId}/attempts`).expect(200)
    ).body as AttemptResponse;
    expect(started.status).toBe('in_progress');
    if (started.status !== 'in_progress') return;
    const view = started.attempt;
    // Máy em không bao giờ nhận đáp án / giải thích trước khi nộp.
    const raw = JSON.stringify(view);
    expect(raw).not.toContain('friendly');
    expect(raw).not.toContain('Chủ ngữ số ít');
    expect(raw).not.toContain('"correct"');
    expect(raw).not.toContain('"accepted"');
    expect(view.sections.map((x) => x.title)).toEqual(['Ngữ pháp', 'Viết']);

    const [a1, a2, a3] = correctAnswers(view);
    await st
      .put(`/api/play/attempts/${view.id}/answers/${a1.itemId}`)
      .send({ response: a1.response, flagged: true })
      .expect(200);
    await st
      .put(`/api/play/attempts/${view.id}/answers/${a2.itemId}`)
      .send({ response: a2.response })
      .expect(200);
    // Sai kiểu câu trả lời → 400, không lưu.
    await st
      .put(`/api/play/attempts/${view.id}/answers/${a3.itemId}`)
      .send({ response: 'text' })
      .expect(400);

    // Tắt máy, vào lại: cùng lượt, câu đã lưu vẫn còn.
    const again = (
      await st.post(`/api/play/exams/${examId}/attempts`).expect(200)
    ).body as AttemptResponse;
    expect(again.status === 'in_progress' && again.attempt.id).toBe(view.id);
    if (again.status !== 'in_progress') return;
    expect(again.attempt.answers[a1.itemId]).toEqual({
      response: a1.response,
      flagged: true,
    });

    const submitted = (
      await st.post(`/api/play/attempts/${view.id}/submit`).expect(200)
    ).body as AttemptResponse;
    if (submitted.status !== 'submitted') throw new Error('chưa nộp');
    // Đúng 3/4 điểm (câu sắp xếp bỏ trống) → 7,5 / 10; luyện tập xem đáp án ngay.
    expect(submitted.result).toMatchObject({
      score: 7.5,
      earned: 3,
      maxPoints: 4,
      correctCount: 2,
      autoSubmitted: false,
    });
    const items = submitted.result.items!;
    // Câu trong phần được trộn: so theo dạng câu, không theo vị trí.
    const byType = Object.fromEntries(items.map((i) => [i.question.type, i]));
    expect(byType.mcq.correct).toBe(true);
    expect(byType.word_form.correct).toBe(true);
    expect(byType.reorder.correct).toBe(false);
    // Chữ cái đáp án theo thứ tự lựa chọn em đã thấy.
    expect(byType.mcq.answer).toBe(
      `${'ABCD'[byType.mcq.question.options.indexOf('goes')]}. goes`,
    );
    expect(byType.mcq.correctIndex).toBe(
      byType.mcq.question.options.indexOf('goes'),
    );
    expect(byType.mcq.explanation).toBe('Chủ ngữ số ít.');

    // Nộp rồi thì không lưu thêm được; nộp lại trả kết quả cũ.
    await st
      .put(`/api/play/attempts/${view.id}/answers/${a3.itemId}`)
      .send({ response: a3.response })
      .expect(409);
    await st.post(`/api/play/attempts/${view.id}/submit`).expect(200);
  });

  it('đề thi: chỉ hiện điểm, đáp án sau giờ đóng; hết lượt làm thì không làm lại được', async () => {
    const closesAt = new Date(Date.now() + 3600_000).toISOString();
    const examId = await newExam({ mode: 'exam', closesAt, maxAttempts: 1 });
    const s = await newStudent('Binh');
    const st = as(s.cookie);
    const r = (await st.post(`/api/play/exams/${examId}/attempts`))
      .body as AttemptResponse;
    if (r.status !== 'in_progress') throw new Error();
    for (const a of correctAnswers(r.attempt)) {
      await st
        .put(`/api/play/attempts/${r.attempt.id}/answers/${a.itemId}`)
        .send({ response: a.response })
        .expect(200);
    }
    const done = (await st.post(`/api/play/attempts/${r.attempt.id}/submit`))
      .body as AttemptResponse;
    if (done.status !== 'submitted') throw new Error();
    expect(done.result).toMatchObject({
      score: 10,
      items: null,
      detailsAt: closesAt,
    });
    expect(JSON.stringify(done.result)).not.toContain('friendly');

    const again = await st
      .post(`/api/play/exams/${examId}/attempts`)
      .expect(409);
    expect(again.body.code).toBe('no_attempts_left');

    // Sau giờ đóng: xem được đáp án.
    await prisma.exam.update({
      where: { id: examId },
      data: { closesAt: new Date(Date.now() - 1000) },
    });
    const later = (await st.get(`/api/play/attempts/${r.attempt.id}`))
      .body as AttemptResponse;
    if (later.status !== 'submitted') throw new Error();
    expect(later.result.items).toHaveLength(3);
  });

  it('quá hạn: không nhận thêm câu, máy tự nộp những câu đã lưu', async () => {
    const examId = await newExam({ mode: 'practice', maxAttempts: 0 });
    const s = await newStudent('Chi');
    const st = as(s.cookie);
    const r = (await st.post(`/api/play/exams/${examId}/attempts`))
      .body as AttemptResponse;
    if (r.status !== 'in_progress') throw new Error();
    const [a1, a2] = correctAnswers(r.attempt);
    await st
      .put(`/api/play/attempts/${r.attempt.id}/answers/${a1.itemId}`)
      .send({ response: a1.response })
      .expect(200);

    // Còn trong 30 giây cho thêm: vẫn lưu được.
    await prisma.examAttempt.update({
      where: { id: r.attempt.id },
      data: { deadlineAt: new Date(Date.now() - 10_000) },
    });
    await st
      .put(`/api/play/attempts/${r.attempt.id}/answers/${a2.itemId}`)
      .send({ response: a2.response })
      .expect(200);

    // Quá 30 giây: từ chối và tự nộp.
    const deadline = new Date(Date.now() - 60_000);
    await prisma.examAttempt.update({
      where: { id: r.attempt.id },
      data: { deadlineAt: deadline },
    });
    const late = await st
      .put(`/api/play/attempts/${r.attempt.id}/answers/${a2.itemId}`)
      .send({ response: 'x' })
      .expect(409);
    expect(late.body.code).toBe('attempt_expired');
    const res = (await st.get(`/api/play/attempts/${r.attempt.id}`))
      .body as AttemptResponse;
    if (res.status !== 'submitted') throw new Error();
    expect(res.result).toMatchObject({
      autoSubmitted: true,
      earned: 3,
      score: 7.5,
      submittedAt: deadline.toISOString(),
    });
  });

  it('tài khoản bị khoá giữa chừng: không lưu, không nộp được; giáo viên vẫn thấy bài (tự nộp khi quá hạn)', async () => {
    const examId = await newExam({ mode: 'practice', shuffle: false });
    const s = await newStudent('Dung');
    const st = as(s.cookie);
    const r = (await st.post(`/api/play/exams/${examId}/attempts`))
      .body as AttemptResponse;
    if (r.status !== 'in_progress') throw new Error();
    const [a1] = correctAnswers(r.attempt);
    await st
      .put(`/api/play/attempts/${r.attempt.id}/answers/${a1.itemId}`)
      .send({ response: a1.response })
      .expect(200);

    await as(admin)
      .patch(`/api/admin/students/${s.id}`)
      .send({ isActive: false })
      .expect(200);
    await st
      .put(`/api/play/attempts/${r.attempt.id}/answers/${a1.itemId}`)
      .send({ response: 0 })
      .expect(401);
    await st.post(`/api/play/attempts/${r.attempt.id}/submit`).expect(401);

    // Hết giờ: bảng điểm của giáo viên tự nộp những câu em đã lưu trước khi bị khoá.
    await prisma.examAttempt.update({
      where: { id: r.attempt.id },
      data: { deadlineAt: new Date(Date.now() - 60_000) },
    });
    const results = (
      await as(admin).get(`/api/admin/exams/${examId}/results`).expect(200)
    ).body as ExamResults;
    expect(results.rows).toEqual([
      expect.objectContaining({
        attemptId: r.attempt.id,
        autoSubmitted: true,
        score: 5,
      }),
    ]);
  });

  it('giáo viên: bảng điểm, tỉ lệ đúng từng câu, dạng hay sai; khoá cấu trúc khi đã có bài', async () => {
    const examId = await newExam({ mode: 'practice', shuffle: false });
    for (const [name, all] of [
      ['Em', true],
      ['Giang', false],
    ] as const) {
      const s = await newStudent(name);
      const st = as(s.cookie);
      const r = (await st.post(`/api/play/exams/${examId}/attempts`))
        .body as AttemptResponse;
      if (r.status !== 'in_progress') throw new Error();
      const answers = correctAnswers(r.attempt);
      for (const a of all ? answers : answers.slice(0, 1)) {
        await st
          .put(`/api/play/attempts/${r.attempt.id}/answers/${a.itemId}`)
          .send({ response: a.response })
          .expect(200);
      }
      await st.post(`/api/play/attempts/${r.attempt.id}/submit`).expect(200);
    }
    const res = (await as(admin).get(`/api/admin/exams/${examId}/results`))
      .body as ExamResults;
    expect(res.rows.map((r) => r.score).sort((a, b) => a! - b!)).toEqual([
      5, 10,
    ]);
    expect(res.items.map((i) => [i.type, i.answered, i.correct])).toEqual([
      ['mcq', 2, 2],
      ['word_form', 2, 1],
      ['reorder', 2, 1],
    ]);
    expect(res.byTag).toEqual([{ tag: TAG, answered: 6, correct: 4 }]);
    // Dạng hay sai nhất đứng đầu.
    expect(res.byType[res.byType.length - 1]).toMatchObject({ type: 'mcq' });

    const locked = await as(admin)
      .put(`/api/admin/exams/${examId}/structure`)
      .send({ sections: [] })
      .expect(409);
    expect(locked.body.code).toBe('exam_has_attempts');
    // Nhân bản thành đề mới (bản nháp) để sửa.
    const copy = (
      await as(admin).post(`/api/admin/exams/${examId}/duplicate`).expect(201)
    ).body as ExamDetail;
    expect(copy).toMatchObject({ isPublished: false, questionCount: 3 });
  });

  it('chưa tới giờ mở / đề không công khai thì không làm được', async () => {
    const upcoming = await newExam({
      opensAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    const hidden = await newExam({ isPublished: false });
    const s = await newStudent('Hoa');
    const st = as(s.cookie);
    const r = await st.post(`/api/play/exams/${upcoming}/attempts`).expect(409);
    expect(r.body.code).toBe('exam_not_open');
    await st.post(`/api/play/exams/${hidden}/attempts`).expect(404);
    await http().get('/api/play/exams').expect(401);
    await http().get('/api/admin/exams').expect(401);
  });
});
