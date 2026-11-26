import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function controllerWith(queryRaw: () => Promise<unknown>) {
  return new HealthController({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);
}

describe('HealthController', () => {
  it('báo ok khi database phản hồi', async () => {
    const res = await controllerWith(() => Promise.resolve([1])).check();
    expect(res).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('báo degraded khi database lỗi', async () => {
    const res = await controllerWith(() =>
      Promise.reject(new Error('down')),
    ).check();
    expect(res).toMatchObject({ status: 'degraded', database: 'down' });
  });
});
