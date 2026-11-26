export class ApiError extends Error {
  readonly status: number;
  /** Mã lỗi máy đọc được do backend gửi (vd: 'invalid_credentials'). */
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Lỗi mạng (backend không chạy, mất kết nối) dùng status 0. */
export const NETWORK_ERROR = 0;

/** Gọi API backend. Cookie đăng nhập (httpOnly) được gửi kèm tự động. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 'Không kết nối được máy chủ');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      code?: string;
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join('\n')
      : (body?.message ?? `${init?.method ?? 'GET'} ${path} → ${res.status}`);
    throw new ApiError(res.status, message, body?.code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const postJson = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const jsonBody = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const patchJson = <T>(path: string, body: unknown) =>
  api<T>(path, jsonBody('PATCH', body));

export const putJson = <T>(path: string, body: unknown) =>
  api<T>(path, jsonBody('PUT', body));

export const del = (path: string) => api<void>(path, { method: 'DELETE' });

/** Tải file lên (multipart). Không đặt Content-Type để trình duyệt tự thêm boundary. */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 'Không kết nối được máy chủ');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    const message =
      res.status === 413
        ? 'File quá lớn'
        : (body?.message ?? `Tải lên thất bại (${res.status})`);
    throw new ApiError(res.status, message, body?.code);
  }
  return (await res.json()) as T;
}

/** Thông báo lỗi để hiển thị cho người dùng. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === NETWORK_ERROR)
      return 'Không kết nối được máy chủ. Kiểm tra backend đang chạy rồi thử lại.';
    return error.message;
  }
  return 'Có lỗi không mong muốn. Thử lại nhé.';
}
