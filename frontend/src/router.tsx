import { createBrowserRouter } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/student/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <StudentLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [{ index: true, element: <AdminHomePage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
]);
