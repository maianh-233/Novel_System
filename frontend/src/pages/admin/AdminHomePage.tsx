import { Link } from 'react-router';
import { useAdminMe } from '../../hooks/useAdminSession';
import { ADMIN_NAV } from '../../layouts/adminNav';

export function AdminHomePage() {
  const { data: admin } = useAdminMe();
  const sections = ADMIN_NAV.filter((item) => item.path !== '');

  return (
    <>
      <h1 className="text-xl font-semibold">
        Chào {admin?.username}, hôm nay mình làm gì nhỉ?
      </h1>
      <p className="mt-1 text-ink/70">
        Các mục quản lý sẽ lần lượt được mở theo kế hoạch.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ path, label, icon: Icon, upcoming }) => (
          <li key={path}>
            <Link
              to={`/admin/${path}`}
              className="flex h-full gap-4 rounded-xl border border-admin-line bg-white p-5 hover:border-admin-accent/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-admin-accent/10 text-admin-accent">
                <Icon aria-hidden className="size-5" />
              </span>
              <span>
                <span className="block font-medium">{label}</span>
                {upcoming && (
                  <span className="mt-1 block text-ink/65">
                    {upcoming.description}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
