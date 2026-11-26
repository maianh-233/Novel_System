import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useStudentMe } from '../../hooks/useStudentSession';

/** Chỉ hiển thị khi học sinh đã đăng nhập; ngược lại chuyển về trang đăng nhập rồi quay lại. */
export function RequireStudent() {
  const { data: me, isPending, isError, refetch } = useStudentMe();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="grid min-h-[50dvh] place-items-center">
        <Loader2 aria-label="Đang tải" className="size-10 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="sticker mx-auto max-w-md bg-white p-8 text-center">
        <p className="font-display text-2xl font-bold">Chưa kết nối được</p>
        <p className="mt-1 text-ink/70">Em nhờ thầy cô kiểm tra mạng nhé.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="sticker pressable mt-5 cursor-pointer bg-sky px-5 py-2 font-display text-lg font-bold"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!me) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
