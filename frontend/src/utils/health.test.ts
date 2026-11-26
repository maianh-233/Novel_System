import { describe, expect, it } from 'vitest';
import { describeHealth } from './health';

describe('describeHealth', () => {
  it('báo lỗi khi không gọi được API', () => {
    expect(describeHealth(undefined, true).tone).toBe('down');
  });

  it('đang chờ khi chưa có dữ liệu', () => {
    expect(describeHealth(undefined, false).tone).toBe('pending');
  });

  it('cảnh báo khi database không chạy', () => {
    const res = describeHealth(
      { status: 'degraded', database: 'down', time: '' },
      false,
    );
    expect(res.tone).toBe('warn');
  });

  it('ok khi mọi thứ chạy', () => {
    const res = describeHealth(
      { status: 'ok', database: 'up', time: '' },
      false,
    );
    expect(res.tone).toBe('ok');
  });
});
