import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAdmin } from './components/admin/RequireAdmin';
import { AdminLayout } from './layouts/AdminLayout';
import { ADMIN_NAV } from './layouts/adminNav';
import { StudentLayout } from './layouts/StudentLayout';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { LoginPage } from './pages/admin/LoginPage';
import { PlaceholderPage } from './pages/admin/PlaceholderPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/student/HomePage';

// Mục nào trong menu chưa làm thì hiện trang tạm, để không bấm vào ra 404.
const upcomingAdminRoutes: RouteObject[] = ADMIN_NAV.flatMap((item) =>
  item.upcoming
    ? [
        {
          path: item.path,
          element: (
            <PlaceholderPage
              title={item.label}
              icon={item.icon}
              {...item.upcoming}
            />
          ),
        },
      ]
    : [],
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <StudentLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <RequireAdmin />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminHomePage /> },
          { path: 'settings', element: <SettingsPage /> },
          ...upcomingAdminRoutes,
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
