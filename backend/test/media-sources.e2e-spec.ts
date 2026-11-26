// Giai đoạn 4 — tìm ảnh / tra từ điển. Chỉ kiểm tra phần không cần internet:
// quyền truy cập, kiểm tra đầu vào, tìm emoji (chỉ mục nằm sẵn trong máy chủ), Pixabay khi chưa có key.
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { ImageSearchResponse } from '@novel/shared';
import { RemoteMediaService } from './../src/media/remote-media.service.js';
import { createApp, loginAsTestAdmin } from './helpers.js';

const TAG = `e2e${process.pid}`;

describe('Image search + dictionary (e2e)', () => {
  let app: NestExpressApplication;
  let admin: string;
  let cleanup: () => Promise<void>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    ({ cookie: admin, cleanup } = await loginAsTestAdmin(app, `${TAG}-media`));
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('chỉ giáo viên đã đăng nhập mới dùng được', async () => {
    await http().get('/api/admin/media/search?q=cat').expect(401);
    await http()
      .post('/api/admin/media/import')
      .send({ source: 'emoji', id: 'Butterfly' })
      .expect(401);
    await http()
      .post('/api/admin/media/dictionary')
      .send({ word: 'cat' })
      .expect(401);
  });

  it('tìm emoji trong chỉ mục có sẵn, trả mã ảnh và ảnh xem trước', async () => {
    const res = await http()
      .get('/api/admin/media/search?q=butterfly')
      .set('Cookie', admin)
      .expect(200);
    const body = res.body as ImageSearchResponse;
    expect(body.results[0]).toMatchObject({
      source: 'emoji',
      id: 'Butterfly',
    });
    expect(body.results[0].previewUrl).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/microsoft\/fluentui-emoji\//,
    );
    expect(typeof body.pixabayEnabled).toBe('boolean');
  });

  it('kiểm tra đầu vào', async () => {
    await http()
      .get('/api/admin/media/search?q=')
      .set('Cookie', admin)
      .expect(400);
    await http()
      .get('/api/admin/media/search?q=cat&source=google')
      .set('Cookie', admin)
      .expect(400);
    await http()
      .post('/api/admin/media/import')
      .set('Cookie', admin)
      .send({ source: 'emoji', id: 'No such emoji anywhere' })
      .expect(404);
  });

  it('Pixabay: chưa có key thì báo rõ; id ảnh sai dạng không gọi ra ngoài', async () => {
    const remote = app.get(RemoteMediaService);
    if (!remote.pixabayEnabled) {
      const res = await http()
        .get('/api/admin/media/search?q=cat&source=pixabay')
        .set('Cookie', admin)
        .expect(400);
      expect(res.body.code).toBe('pixabay_disabled');
    } else {
      // Có key: id không phải số thì bị từ chối ngay, không tải gì.
      await http()
        .post('/api/admin/media/import')
        .set('Cookie', admin)
        .send({ source: 'pixabay', id: '../../etc' })
        .expect(404);
    }
  });
});
