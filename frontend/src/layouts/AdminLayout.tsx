import { ExternalLink, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { ServerStatus } from '../components/ServerStatus';
import { ToastProvider } from '../components/admin/Toast';
import { useAdminLogout, useAdminMe } from '../hooks/useAdminSession';
import { ADMIN_NAV, ADMIN_SETTINGS_NAV, type AdminNavItem } from './adminNav';

function NavItem({
  item,
  onNavigate,
}: {
  item: AdminNavItem;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path ? `/admin/${item.path}` : '/admin'}
      end={item.path === ''}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 ${isActive ? 'bg-admin-accent/10 font-medium text-admin-accent' : 'text-ink/80 hover:bg-admin-bg hover:text-ink'}`
      }
    >
      <Icon aria-hidden className="size-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.upcoming && (
        <span className="rounded-full bg-admin-bg px-1.5 text-[11px] text-ink/50">
          sắp có
        </span>
      )}
    </NavLink>
  );
}

export function AdminLayout() {
  const { data: admin } = useAdminMe();
  const logout = useAdminLogout();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Trên điện thoại: bấm vào một mục thì đóng menu.
  const closeMenu = () => setMenuOpen(false);

  const onLogout = () =>
    logout.mutate(undefined, {
      onSettled: () => navigate('/admin/login', { replace: true }),
    });

  return (
    <div className="flex min-h-dvh bg-admin-bg text-sm">
      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-20 w-64 flex-col border-r border-admin-line bg-white px-3 py-4 md:sticky md:top-0 md:flex md:h-dvh ${menuOpen ? 'flex' : 'hidden'}`}
      >
        <Link
          to="/admin"
          className="flex items-center gap-2.5 px-2 pb-5"
          aria-label="Novel Game — trang quản trị"
        >
          <span aria-hidden className="flex">
            <span className="grid size-8 -rotate-6 place-items-center rounded-lg border-2 border-ink bg-tomato font-display text-lg font-extrabold">
              N
            </span>
            <span className="-ml-1 grid size-8 rotate-6 place-items-center rounded-lg border-2 border-ink bg-sun font-display text-lg font-extrabold">
              G
            </span>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-extrabold">
              Novel Game
            </span>
            <span className="block text-xs text-ink/60">Khu vực giáo viên</span>
          </span>
        </Link>

        <nav aria-label="Quản trị" className="flex flex-1 flex-col gap-0.5">
          {ADMIN_NAV.map((item) => (
            <NavItem key={item.path} item={item} onNavigate={closeMenu} />
          ))}
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-admin-line pt-3">
          <NavItem item={ADMIN_SETTINGS_NAV} onNavigate={closeMenu} />
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-ink/80 hover:bg-admin-bg hover:text-ink"
          >
            <ExternalLink aria-hidden className="size-[18px]" />
            Xem trang học sinh
          </a>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-10 bg-ink/30 md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-admin-line bg-white px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            className="-ml-1 grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-admin-bg md:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <div className="hidden flex-1 sm:block">
            <ServerStatus />
          </div>
          <div className="flex-1 sm:hidden" />

          <span className="text-ink/70">
            Xin chào, <strong className="text-ink">{admin?.username}</strong>
          </span>
          <button
            type="button"
            onClick={onLogout}
            disabled={logout.isPending}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-admin-line px-3 py-1.5 hover:bg-admin-bg disabled:opacity-60"
          >
            <LogOut aria-hidden className="size-4" />
            Đăng xuất
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </main>
      </div>
    </div>
  );
}
