import { HttpException } from '@nestjs/common';
import type { MediaErrorCode } from '@novel/shared';

const TIMEOUT_MS = 10_000;

export const remoteUnavailable = (message: string) => {
  const code: MediaErrorCode = 'remote_unavailable';
  return new HttpException({ statusCode: 502, code, message }, 502);
};

/** Chờ tối đa bao lâu khi dịch vụ báo "gọi chậm lại" (429) trước khi thử lại. */
const MAX_RETRY_WAIT_MS = 5_000;

/** Số mili giây cần chờ theo header Retry-After (tính bằng giây); không có thì chờ 1 giây. */
export function retryAfterMs(header: string | null): number {
  const sec = Number(header);
  const ms = Number.isFinite(sec) && sec > 0 ? sec * 1000 : 1000;
  return Math.min(ms, MAX_RETRY_WAIT_MS);
}

/**
 * Gọi dịch vụ bên ngoài: có giới hạn thời gian, chỉ chấp nhận https tới đúng các máy chủ cho phép
 * (kể cả sau khi bị chuyển hướng), chặn file quá lớn, và khi bị báo 429 thì chờ rồi thử lại
 * (dịch vụ miễn phí như Wikimedia giới hạn số lần tải liên tiếp).
 */
export async function fetchRemote(
  url: string,
  allowedHosts: string[],
  opts: { maxBytes: number; serviceName: string; retries?: number },
): Promise<{ status: number; body: Buffer }> {
  const check = (u: string) => {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:' || !allowedHosts.includes(parsed.hostname))
      throw remoteUnavailable(`${opts.serviceName}: địa chỉ không được phép`);
  };
  check(url);

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Tên chung chung — không gửi thông tin nào về người dùng hay trường học.
        headers: { 'User-Agent': 'NovelGame/1.0 (educational app)' },
      });
    } catch {
      throw remoteUnavailable(
        `Không kết nối được ${opts.serviceName}. Kiểm tra mạng rồi thử lại.`,
      );
    }
    if (res.status !== 429 || attempt >= (opts.retries ?? 2)) break;
    await res.body?.cancel();
    await new Promise((r) =>
      setTimeout(r, retryAfterMs(res.headers.get('retry-after'))),
    );
  }
  check(res.url || url);

  const declared = Number(res.headers.get('content-length'));
  if (declared > opts.maxBytes) {
    throw remoteUnavailable(`${opts.serviceName}: file quá lớn`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > opts.maxBytes) {
    throw remoteUnavailable(`${opts.serviceName}: file quá lớn`);
  }
  return { status: res.status, body };
}
