// C1 — ngân hàng câu hỏi trên database thật. Cần `npm run db:up`.
// Mọi câu hỏi test tạo đều có chủ điểm = TAG; đoạn văn / bài học có tiền tố TAG. Xoá hết khi xong.
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type {
  LessonDetail,
  Paginated,
  PassageAdmin,
  QuestionAdmin,
  QuestionImportResult,
} from '@novel/shared';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, loginAsTestAdmin } from './helpers.js';

const TAG = `e2q${process.pid}`;

/** 20 câu trắc nghiệm + 10 câu word form, đúng định dạng giáo viên dán từ Word. */
function examText() {
  const lines: string[] = [];
  for (let i = 1; i <= 20; i++) {
    lines.push(
      `${i}. She ___ to school every day (${i}).`,
      'A. go   B. goes   C. going   D. gone',
      'Đáp án: B',
      'Giải thích: Hiện tại đơn, chủ ngữ số ít.',
      '',
    );
  }
  lines.push('# Word form');
  for (let i = 21; i <= 30; i++) {
    lines.push(`${i}. He is very ___ (friend) #${i}.`, 'Đáp án: friendly', '');
  }
  return lines.join('\n');
}

describe('Question bank (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: string;
  let cleanupAdmin: () => Promise<void>;
  const http = () => request(app.getHttpServer());
  const as = {
    get: (p: string) => http().get(p).set('Cookie', admin),
    post: (p: string) => http().post(p).set('Cookie', admin),
    put: (p: string) => http().put(p).set('Cookie', admin),
    patch: (p: string) => http().patch(p).set('Cookie', admin),
    del: (p: string) => http().delete(p).set('Cookie', admin),
  };
  const defaults = { stage: 'secondary', level: 2, grammarTag: TAG };

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    ({ cookie: admin, cleanup: cleanupAdmin } = await loginAsTestAdmin(
      app,
      `${TAG}-admin`,
    ));
  });

  afterAll(async () => {
    await prisma.lesson.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.question.deleteMany({ where: { grammarTag: TAG } });
    await prisma.passage.deleteMany({ where: { title: { startsWith: TAG } } });
    await cleanupAdmin();
    await app.close();
  });

  it('khu câu hỏi cần giáo viên', async () => {
    await http().get('/api/admin/questions').expect(401);
    await http().post('/api/admin/questions/import').expect(401);
    await http().get('/api/admin/passages').expect(401);
  });

  it('dán 20 câu trắc nghiệm + 10 câu word form: xem trước rồi lưu', async () => {
    const dry = await as
      .post('/api/admin/questions/import')
      .send({ format: 'text', content: examText(), defaults })
      .expect(200);
    const preview = dry.body as QuestionImportResult;
    expect(preview).toMatchObject({ dryRun: true, created: 0, errors: [] });
    expect(preview.questions).toHaveLength(30);
    expect(await prisma.question.count({ where: { grammarTag: TAG } })).toBe(0);

    const saved = await as
      .post('/api/admin/questions/import')
      .send({ format: 'text', content: examText(), defaults, dryRun: false })
      .expect(200);
    expect(saved.body).toMatchObject({ dryRun: false, created: 30 });

    const list = (
      await as.get(`/api/admin/questions?grammarTag=${TAG}&pageSize=100`)
    ).body as Paginated<QuestionAdmin>;
    expect(list.total).toBe(30);
    const mcq = list.items.find((q) => q.type === 'mcq')!;
    expect(mcq).toMatchObject({
      options: ['go', 'goes', 'going', 'gone'],
      correct: 1,
      accepted: [],
      level: 2,
      stage: 'secondary',
    });
    const wf = (
      await as.get(`/api/admin/questions?grammarTag=${TAG}&type=word_form`)
    ).body as Paginated<QuestionAdmin>;
    expect(wf.total).toBe(10);
    expect(wf.items[0]).toMatchObject({
      accepted: ['friendly'],
      correct: null,
    });
  });

  it('văn bản có lỗi: báo theo dòng và không ghi câu nào', async () => {
    const before = await prisma.question.count({ where: { grammarTag: TAG } });
    const res = await as
      .post('/api/admin/questions/import')
      .send({
        format: 'text',
        content: '1. ok\nA. a  B. b\nĐáp án: A\n2. bad\nA. a  B. b\nĐáp án: Z',
        defaults,
        dryRun: false,
      })
      .expect(200);
    expect(res.body).toMatchObject({
      dryRun: true,
      created: 0,
      errors: [{ line: 4 }],
    });
    expect(await prisma.question.count({ where: { grammarTag: TAG } })).toBe(
      before,
    );
  });

  it('đoạn văn trong văn bản dán được tạo kèm, câu hỏi trỏ về đoạn đó', async () => {
    const res = await as
      .post('/api/admin/questions/import')
      .send({
        format: 'text',
        content: `# Đoạn văn: ${TAG} My school\nIt has (1) ___ rooms.\n1. A. many  B. much\nĐáp án: A`,
        defaults,
        dryRun: false,
      })
      .expect(200);
    expect(res.body).toMatchObject({ created: 1, passagesCreated: 1 });
    const passages = (await as.get('/api/admin/passages'))
      .body as PassageAdmin[];
    const p = passages.find((x) => x.title === `${TAG} My school`)!;
    expect(p).toMatchObject({
      questionCount: 1,
      text: 'It has (1) ___ rooms.',
    });
    // Đoạn văn còn câu hỏi thì không xoá được.
    const del = await as.del(`/api/admin/passages/${p.id}`).expect(409);
    expect(del.body.code).toBe('passage_in_use');
  });

  it('nhập CSV', async () => {
    const csv = [
      'type,prompt,options,answer,grammar',
      `mcq,Pick one,yes|no,A,${TAG}`,
      `Sắp xếp câu,Arrange,to school|I|go,I go to school.,${TAG}`,
      `bogus,x,,A,${TAG}`,
    ].join('\n');
    const res = await as
      .post('/api/admin/questions/import')
      .send({ format: 'csv', content: csv, defaults })
      .expect(200);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.errors).toEqual([
      { line: 4, message: 'Không hiểu dạng câu "bogus"' },
    ]);
  });

  it('tạo, sửa, ngừng dùng, gắn vào Unit; câu đã gắn thì không xoá được', async () => {
    const created = await as
      .post('/api/admin/questions')
      .send({
        type: 'error',
        prompt: 'She [go] to [school] every [day].',
        correct: 0,
        grammarTag: TAG,
      })
      .expect(201);
    const q = created.body as QuestionAdmin;
    expect(q.options).toEqual(['go', 'school', 'day']);

    // Dữ liệu sai theo dạng câu → 400.
    await as
      .post('/api/admin/questions')
      .send({ type: 'mcq', prompt: 'x', options: ['a'], correct: 0 })
      .expect(400);

    const replaced = await as
      .put(`/api/admin/questions/${q.id}`)
      .send({
        type: 'verb_form',
        prompt: 'She ___ (go) home.',
        accepted: ['goes'],
        grammarTag: TAG,
      })
      .expect(200);
    expect(replaced.body).toMatchObject({
      type: 'verb_form',
      options: [],
      correct: null,
      accepted: ['goes'],
    });

    const off = await as
      .patch(`/api/admin/questions/${q.id}/status`)
      .send({ status: 'INACTIVE' })
      .expect(200);
    expect(off.body.status).toBe('INACTIVE');

    const lesson = await as
      .post('/api/admin/lessons')
      .send({ title: `${TAG} Unit 1`, stage: 'secondary' })
      .expect(201);
    const withQs = await as
      .put(`/api/admin/lessons/${lesson.body.id}/questions`)
      .send({ questionIds: [q.id] })
      .expect(200);
    const detail = withQs.body as LessonDetail;
    expect(detail.questionCount).toBe(1);
    expect(detail.questions.map((x) => x.id)).toEqual([q.id]);
    await as
      .put(`/api/admin/lessons/${lesson.body.id}/questions`)
      .send({ questionIds: ['nope'] })
      .expect(400);

    const inUse = await as.del(`/api/admin/questions/${q.id}`).expect(409);
    expect(inUse.body.code).toBe('question_in_use');

    const tags = (await as.get('/api/admin/questions/tags')).body as string[];
    expect(tags).toContain(TAG);
  });
});
