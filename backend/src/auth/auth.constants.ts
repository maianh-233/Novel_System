/** Cookie chứa phiên đăng nhập của giáo viên. Chỉ gửi kèm các request tới /api. */
export const ADMIN_COOKIE = 'ng_admin';
export const ADMIN_COOKIE_PATH = '/api';

/** Mọi route dưới tiền tố này đều cần giáo viên đã đăng nhập (trừ route @PublicAdmin). */
export const ADMIN_PATH_PREFIX = '/api/admin/';

export const PUBLIC_ADMIN_KEY = 'publicAdmin';
