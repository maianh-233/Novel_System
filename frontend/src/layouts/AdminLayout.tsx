import { NavLink, Outlet } from 'react-router';
import { ServerStatus } from '../components/ServerStatus';

// Các mục sẽ được làm ở Giai đoạn 2 và 5 (docs/PLAN.md).
const NAV = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/vocabulary', label: 'Từ vựng' },
  { to: '/admin/categories', label: 'Chủ đề' },
  { to: '/admin/lessons', label: 'Bài học' },
  { to: '/admin/games', label: 'Trò chơi' },
  { to: '/admin/students', label: 'Học sinh' },
  { to: '/admin/analytics', label: 'Thống kê' },
];

export function AdminLayout() {
  return (
    <div className="flex min-h-dvh bg-admin-bg text-sm">
      <aside className="w-56 shrink-0 border-r border-admin-line bg-white px-3 py-5">
        <p className="px-3 pb-4 font-semibold">Novel Game · Giáo viên</p>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 ${isActive ? 'bg-admin-accent/10 font-medium text-admin-accent' : 'hover:bg-admin-bg'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-admin-line bg-white px-6">
          <ServerStatus />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
