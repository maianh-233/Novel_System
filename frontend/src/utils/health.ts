import type { HealthStatus } from '@novel/shared';

export type Tone = 'ok' | 'warn' | 'down' | 'pending';

export function describeHealth(
  data: HealthStatus | undefined,
  isError: boolean,
): { tone: Tone; label: string } {
  if (isError) return { tone: 'down', label: 'Không kết nối được máy chủ' };
  if (!data) return { tone: 'pending', label: 'Đang kiểm tra…' };
  if (data.database === 'down')
    return { tone: 'warn', label: 'Máy chủ chạy, database chưa sẵn sàng' };
  return { tone: 'ok', label: 'Máy chủ & database đang chạy' };
}
