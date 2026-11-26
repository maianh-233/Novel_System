// Giai đoạn 2 — quản trị nội dung trên database thật. Cần `npm run db:up`.
// Test chỉ tạo dữ liệu có tiền tố riêng và xoá hết khi xong; file tải lên ghi vào thư mục tạm.
import type { NestExpressApplication } from '@nestjs/platform-express';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import type {
  CategoryAdmin,
  GameAdmin,
  LessonDetail,
  LessonGamePreview,
  VocabularyAdmin,
} from '@novel/shared';
import { StorageService } from './../src/media/storage.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { createApp, loginAsTestAdmin, tinyWav } from './helpers.js';

const TAG = `e2e${process.pid}`;

describe('Content management (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let cookie: string;
  let cleanupAdmin: () => Promise<void>;
  let uploadDir: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    // UPLOAD_DIR do vitest.config.e2e.ts đặt sẵn (thư mục tạm).
    uploadDir = process.env.UPLOAD_DIR!;
    app = await createApp();
    expect(app.get(StorageService).root).toBe(resolve(uploadDir));
    prisma = app.get(PrismaService);
    ({ cookie, cleanup: cleanupAdmin } = await loginAsTestAdmin(
      app,
      `${TAG}-admin`,
    ));
  });

  afterAll(async () => {
    const lessons = await prisma.lesson.findMany({
      where: { title: { startsWith: TAG } },
      select: { id: true },
    });
    await prisma.lesson.deleteMany({
      where: { id: { in: lessons.map((l) => l.id) } },
    });
    const cats = await prisma.category.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const catIds = cats.map((c) => c.id);
    await prisma.lessonVocabulary.deleteMany({
      where: { vocabulary: { categoryId: { in: catIds } } },
    });
    await prisma.vocabulary.deleteMany({
      where: { categoryId: { in: catIds } },
    });
    await prisma.category.deleteMany({ where: { id: { in: catIds } } });
    await cleanupAdmin();
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('mọi API quản trị nội dung đều cần đăng nhập', async () => {
    for (const [method, path] of [
      ['get', '/api/admin/categories'],
      ['get', '/api/admin/vocabulary'],
      ['get', '/api/admin/lessons'],
      ['get', '/api/admin/games'],
      ['post', '/api/admin/media/images'],
    ] as const) {
      const res = await http()[method](path);
      expect({ path, status: res.status }).toEqual({ path, status: 401 });
    }
  });

  it('luồng chính: chủ đề → từ có ảnh + âm thanh → bài học → game nhận được từ', async () => {
    // 1. Chủ đề mới
    const cat = await http()
      .post('/api/admin/categories')
      .set('Cookie', cookie)
      .send({ name: `${TAG} Animals`, icon: '🦋' });
    expect(cat.status).toBe(201);
    const category = cat.body as CategoryAdmin;
    expect(category).toMatchObject({ slug: `${TAG}-animals`, wordCount: 0 });

    // 2. Tải ảnh (PNG 1200×900 → thu về WebP cạnh dài 800) và âm thanh
    const png = await sharp({
      create: { width: 1200, height: 900, channels: 3, background: '#ffcc00' },
    })
      .png()
      .toBuffer();
    const img = await http()
      .post('/api/admin/media/images')
      .set('Cookie', cookie)
      .attach('file', png, 'butterfly.png');
    expect(img.status).toBe(201);
    expect(img.body.url).toMatch(/^\/uploads\/images\/[0-9a-f-]+\.webp$/);

    const served = await http().get(img.body.url).buffer(true);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    const meta = await sharp(served.body as Buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 800, 600]);

    const audio = await http()
      .post('/api/admin/media/audio')
      .set('Cookie', cookie)
      .attach('file', tinyWav(), 'butterfly.wav');
    expect(audio.status).toBe(201);
    expect(audio.body.url).toMatch(/^\/uploads\/audio\/.+\.wav$/);

    // 3. Từ vựng
    const created = await http()
      .post('/api/admin/vocabulary')
      .set('Cookie', cookie)
      .send({
        word: 'Butterfly',
        meaning: 'Con bướm',
        ipa: '/ˈbʌtəflaɪ/',
        categoryId: category.id,
        level: 3,
        imageUrl: img.body.url,
        audioUrl: audio.body.url,
      });
    expect(created.status).toBe(201);
    const butterfly = created.body as VocabularyAdmin;
    expect(butterfly).toMatchObject({ level: 3, status: 'ACTIVE' });

    const plain = await http()
      .post('/api/admin/vocabulary')
      .set('Cookie', cookie)
      .send({ word: 'moth', meaning: 'con bướm đêm', categoryId: category.id });
    expect(plain.status).toBe(201);

    // 4. Bài học
    const lessonRes = await http()
      .post('/api/admin/lessons')
      .set('Cookie', cookie)
      .send({ title: `${TAG} Lesson`, isPublished: true });
    expect(lessonRes.status).toBe(201);
    const lesson = lessonRes.body as LessonDetail;

    const withWords = await http()
      .put(`/api/admin/lessons/${lesson.id}/words`)
      .set('Cookie', cookie)
      .send({ vocabularyIds: [plain.body.id, butterfly.id] });
    expect(withWords.status).toBe(200);
    expect((withWords.body as LessonDetail).words.map((w) => w.word)).toEqual([
      'moth',
      'Butterfly',
    ]);

    // 5. Gán bài học cho Picture Match (ghi nhớ cấu hình gốc để trả lại sau)
    const before = (
      (await http().get('/api/admin/games').set('Cookie', cookie))
        .body as GameAdmin[]
    ).find((g) => g.slug === 'picture-match')!;
    const game = await http()
      .patch('/api/admin/games/picture-match')
      .set('Cookie', cookie)
      .send({
        lessonIds: [lesson.id],
        config: { wordsPerRound: 4, timeLimitSec: 0 },
      });
    expect(game.status).toBe(200);
    expect((game.body as GameAdmin).lessonIds).toContain(lesson.id);

    const preview = await http()
      .get(`/api/admin/lessons/${lesson.id}/preview`)
      .set('Cookie', cookie);
    expect(preview.status).toBe(200);
    const pm = (preview.body as LessonGamePreview[]).find(
      (p) => p.gameSlug === 'picture-match',
    )!;
    expect(pm.words).toEqual([
      expect.objectContaining({
        word: 'Butterfly',
        meaning: 'Con bướm',
        imageUrl: img.body.url,
        audioUrl: audio.body.url,
      }),
    ]);
    expect(pm.excluded).toEqual([
      { id: plain.body.id, word: 'moth', reason: 'Thiếu hình ảnh' },
    ]);

    // Trả Picture Match về đúng như trước khi test — không để lại dấu vết trong dữ liệu thật.
    const restored = await http()
      .patch('/api/admin/games/picture-match')
      .set('Cookie', cookie)
      .send({ lessonIds: before.lessonIds, config: before.config });
    expect(restored.body).toEqual(before);
  });

  it('sửa một trường không làm đổi các trường khác', async () => {
    const cat = await http()
      .post('/api/admin/categories')
      .set('Cookie', cookie)
      .send({ name: `${TAG} Patch` });
    const v = await http()
      .post('/api/admin/vocabulary')
      .set('Cookie', cookie)
      .send({
        word: 'owl',
        meaning: 'cú',
        categoryId: cat.body.id,
        level: 3,
        status: 'INACTIVE',
      });
    const patched = await http()
      .patch(`/api/admin/vocabulary/${v.body.id}`)
      .set('Cookie', cookie)
      .send({ meaning: 'con cú' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      meaning: 'con cú',
      level: 3,
      status: 'INACTIVE',
    });
  });

  it('chặn từ trùng (không phân biệt hoa thường) và dữ liệu sai', async () => {
    const cat = await http()
      .post('/api/admin/categories')
      .set('Cookie', cookie)
      .send({ name: `${TAG} Dup` });
    const first = await http()
      .post('/api/admin/vocabulary')
      .set('Cookie', cookie)
      .send({ word: 'Lion', meaning: 'sư tử', categoryId: cat.body.id });
    expect(first.status).toBe(201);
    const dup = await http()
      .post('/api/admin/vocabulary')
      .set('Cookie', cookie)
      .send({ word: 'lion', meaning: 'sư tử', categoryId: cat.body.id });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('duplicate_word');

    const bad = await http()
      .post('/api/admin/vocabulary')
      .set('Cookie', cookie)
      .send({
        word: 'l1on',
        meaning: '',
        categoryId: cat.body.id,
        imageUrl: 'http://evil.example/x.png',
      });
    expect(bad.status).toBe(400);
  });

  it('không xoá chủ đề còn từ; tìm kiếm + lọc + phân trang', async () => {
    const cat = await http()
      .post('/api/admin/categories')
      .set('Cookie', cookie)
      .send({ name: `${TAG} Search` });
    for (const [word, meaning] of [
      ['zebra', 'ngựa vằn'],
      ['zoo', 'sở thú'],
      ['zero', 'số không'],
    ]) {
      await http()
        .post('/api/admin/vocabulary')
        .set('Cookie', cookie)
        .send({ word, meaning, categoryId: cat.body.id });
    }
    const page1 = await http()
      .get('/api/admin/vocabulary')
      .query({ categoryId: cat.body.id, q: 'Z', pageSize: 2, page: 1 })
      .set('Cookie', cookie);
    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(3);
    expect(page1.body.items).toHaveLength(2);

    const byMeaning = await http()
      .get('/api/admin/vocabulary')
      .query({ categoryId: cat.body.id, q: 'ngựa' })
      .set('Cookie', cookie);
    expect(byMeaning.body.items.map((v: VocabularyAdmin) => v.word)).toEqual([
      'zebra',
    ]);

    const del = await http()
      .delete(`/api/admin/categories/${cat.body.id}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('category_not_empty');
  });

  it('nhập CSV: kiểm tra trước, có lỗi thì không ghi, sửa xong thì ghi', async () => {
    const cat = await http()
      .post('/api/admin/categories')
      .set('Cookie', cookie)
      .send({ name: `${TAG} Csv` });
    const badCsv = 'word,meaning,level\nkite,cái diều,1\nyo-yo,,1\n';
    const withError = await http()
      .post('/api/admin/vocabulary/import')
      .set('Cookie', cookie)
      .send({ csv: badCsv, defaultCategoryId: cat.body.id, dryRun: false });
    expect(withError.status).toBe(200);
    expect(withError.body).toMatchObject({
      dryRun: true,
      created: 1,
      updated: 0,
    });
    expect(withError.body.errors[0].line).toBe(3);
    expect(
      await prisma.vocabulary.count({ where: { categoryId: cat.body.id } }),
    ).toBe(0);

    const goodCsv =
      'word,meaning,level\nkite,cái diều,1\nyo-yo,con quay yo-yo,2\n';
    const dry = await http()
      .post('/api/admin/vocabulary/import')
      .set('Cookie', cookie)
      .send({ csv: goodCsv, defaultCategoryId: cat.body.id, dryRun: true });
    expect(dry.body).toMatchObject({ dryRun: true, created: 2, errors: [] });
    expect(
      await prisma.vocabulary.count({ where: { categoryId: cat.body.id } }),
    ).toBe(0);

    const commit = await http()
      .post('/api/admin/vocabulary/import')
      .set('Cookie', cookie)
      .send({ csv: goodCsv, defaultCategoryId: cat.body.id, dryRun: false });
    expect(commit.body).toMatchObject({
      dryRun: false,
      created: 2,
      updated: 0,
    });

    // Nhập lại: từ đã có được cập nhật, không tạo trùng
    const again = await http()
      .post('/api/admin/vocabulary/import')
      .set('Cookie', cookie)
      .send({
        csv: 'word,meaning\nKITE,con diều',
        defaultCategoryId: cat.body.id,
        dryRun: false,
      });
    expect(again.body).toMatchObject({ created: 0, updated: 1 });
    const kite = await prisma.vocabulary.findFirst({
      where: {
        categoryId: cat.body.id,
        word: { equals: 'kite', mode: 'insensitive' },
      },
    });
    expect(kite?.meaning).toBe('con diều');
  });

  it('từ chối file không phải ảnh dù đặt đuôi .png', async () => {
    const res = await http()
      .post('/api/admin/media/images')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('<script>alert(1)</script>'), 'evil.png');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('unsupported_image');
  });

  it('trang học sinh chỉ thấy chủ đề không bị ẩn', async () => {
    const cat = await http()
      .post('/api/admin/categories')
      .set('Cookie', cookie)
      .send({ name: `${TAG} Hidden` });
    await http()
      .patch(`/api/admin/categories/${cat.body.id}`)
      .set('Cookie', cookie)
      .send({ isHidden: true });
    const pub = await http().get('/api/content/categories');
    expect(pub.status).toBe(200);
    expect(pub.body.some((c: { id: string }) => c.id === cat.body.id)).toBe(
      false,
    );
  });
});
