import { ApiError, NETWORK_ERROR } from '../services/api';

/** Lỗi đăng nhập của học sinh, viết cho các em đọc. */
export function studentAuthErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Có lỗi rồi. Em thử lại nhé.';
  if (error.status === NETWORK_ERROR)
    return 'Chưa kết nối được. Em nhờ thầy cô kiểm tra mạng nhé.';
  if (error.status === 429)
    return 'Em nhập sai nhiều lần quá. Đợi 1 phút rồi thử lại nhé.';
  switch (error.code) {
    case 'invalid_credentials':
      return 'Tên đăng nhập hoặc mật khẩu chưa đúng. Em xem lại phiếu nhé.';
    case 'account_disabled':
      return 'Tài khoản của em đang tạm khoá. Em hỏi thầy cô nhé.';
  }
  return error.message;
}

/** Chỉ quay lại trang trong khu học sinh — chặn chuyển sang trang ngoài hoặc khu giáo viên. */
export function safeStudentRedirect(next: string | null): string {
  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\') &&
    !next.startsWith('/admin') &&
    !next.startsWith('/login')
  ) {
    return next;
  }
  return '/';
}
