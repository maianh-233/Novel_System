import { LogIn, LogOut, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useStudentLogout, useStudentMe } from '../../hooks/useStudentSession';

/** Góc phải đầu trang: sao + tên của em (bấm vào xem hồ sơ) và nút thoát; chưa đăng nhập thì nút "Đăng nhập". */
export function StudentBar() {
  const { data: me, isPending } = useStudentMe();
  const logout = useStudentLogout();
  const navigate = useNavigate();

  if (isPending) return null;

  if (!me) {
    return (
      <Link
        to="/login"
        className="sticker pressable inline-flex items-center gap-2 bg-white px-4 py-2 font-display text-lg font-bold"
      >
        <LogIn aria-hidden className="size-5" strokeWidth={2.5} />
        Đăng nhập
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/me"
        aria-label={`Hồ sơ của ${me.displayName}, ${me.totalStars} sao`}
        className="sticker pressable inline-flex items-center gap-2 bg-white py-1.5 pr-4 pl-1.5 font-display text-lg font-bold"
      >
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-sun px-2.5 py-0.5">
          <Star aria-hidden className="size-4 fill-ink" />
          {me.totalStars}
        </span>
        <span className="max-w-[10rem] truncate">{me.displayName}</span>
      </Link>
      <button
        type="button"
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => navigate('/', { replace: true }),
          })
        }
        aria-label="Thoát"
        title="Thoát"
        className="sticker pressable grid size-11 cursor-pointer place-items-center bg-white"
      >
        <LogOut aria-hidden className="size-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
