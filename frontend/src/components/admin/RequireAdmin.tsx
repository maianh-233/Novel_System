import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAdminMe } from '../../hooks/useAdminSession';

/** Chỉ hiển thị khu admin khi giáo viên đã đăng nhập; ngược lại chuyển về trang đăng nhập. */
export function RequireAdmin() {
  const { data: admin, isPending, isError, refetch } = useAdminMe();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-admin-bg">
        <Loader2
          aria-label="Đang kiểm tra đăng nhập"
          className="size-8 animate-spin text-admin-accent"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-admin-bg p-6 text-center">
        <div>
          <p className="font-medium">Không kết nối được máy chủ.</p>
          <p className="mt-1 text-sm text-ink/70">
            Kiểm tra backend đang chạy rồi thử lại.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!admin) {
    const next = location.pathname + location.search;
    return (
      <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />
    );
  }

  return <Outlet />;
}
