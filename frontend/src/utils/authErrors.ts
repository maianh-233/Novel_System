import { ApiError, NETWORK_ERROR } from '../services/api';

/** Đổi lỗi API thành câu giải thích + cách xử lý cho giáo viên. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'Có lỗi không mong muốn. Thử lại nhé.';
  if (error.status === NETWORK_ERROR)
    return 'Không kết nối được máy chủ. Kiểm tra backend đang chạy rồi thử lại.';
  if (error.status === 429)
    return 'Đăng nhập sai quá nhiều lần. Đợi 1 phút rồi thử lại.';
  switch (error.code) {
    case 'invalid_credentials':
      return 'Sai tên đăng nhập hoặc mật khẩu.';
    case 'wrong_current_password':
      return 'Mật khẩu hiện tại không đúng.';
    case 'not_authenticated':
      return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.';
  }
  return error.message;
}

/** Chỉ chấp nhận đường dẫn nội bộ trong khu admin — chặn chuyển hướng sang trang ngoài. */
export function safeAdminRedirect(next: string | null): string {
  if (next && next.startsWith('/admin') && !next.startsWith('/admin/login')) {
    return next;
  }
  return '/admin';
}
