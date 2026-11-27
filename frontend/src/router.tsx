import { Loader2 } from 'lucide-react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAdmin } from './components/admin/RequireAdmin';
import { RequireStudent } from './components/student/RequireStudent';
import { ADMIN_NAV } from './layouts/adminNav';
import { StudentLayout } from './layouts/StudentLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { AttemptPage } from './pages/student/AttemptPage';
import { ExamsPage } from './pages/student/ExamsPage';
import { HomePage } from './pages/student/HomePage';
import { PlayPage } from './pages/student/PlayPage';
import { ProfilePage } from './pages/student/ProfilePage';
import { StudentLoginPage } from './pages/student/StudentLoginPage';

/*
 * Khu giáo viên được tách thành file JS riêng và chỉ tải khi vào /admin —
 * máy của học sinh không phải tải code quản trị.
 */
const adminLayout = () =>
  import('./layouts/AdminLayout').then((m) => ({ Component: m.AdminLayout }));

const adminPages = {
  home: () =>
    import('./pages/admin/AdminHomePage').then((m) => ({
      Component: m.AdminHomePage,
    })),
  login: () =>
    import('./pages/admin/LoginPage').then((m) => ({ Component: m.LoginPage })),
  vocabulary: () =>
    import('./pages/admin/VocabularyPage').then((m) => ({
      Component: m.VocabularyPage,
    })),
  categories: () =>
    import('./pages/admin/CategoriesPage').then((m) => ({
      Component: m.CategoriesPage,
    })),
  lessons: () =>
    import('./pages/admin/LessonsPage').then((m) => ({
      Component: m.LessonsPage,
    })),
  lesson: () =>
    import('./pages/admin/LessonEditPage').then((m) => ({
      Component: m.LessonEditPage,
    })),
  questions: () =>
    import('./pages/admin/QuestionsPage').then((m) => ({
      Component: m.QuestionsPage,
    })),
  exams: () =>
    import('./pages/admin/ExamsPage').then((m) => ({ Component: m.ExamsPage })),
  exam: () =>
    import('./pages/admin/ExamEditPage').then((m) => ({
      Component: m.ExamEditPage,
    })),
  examResults: () =>
    import('./pages/admin/ExamResultsPage').then((m) => ({
      Component: m.ExamResultsPage,
    })),
  assignments: () =>
    import('./pages/admin/AssignmentsPage').then((m) => ({
      Component: m.AssignmentsPage,
    })),
  assignment: () =>
    import('./pages/admin/AssignmentDetailPage').then((m) => ({
      Component: m.AssignmentDetailPage,
    })),
  games: () =>
    import('./pages/admin/GamesPage').then((m) => ({ Component: m.GamesPage })),
  classes: () =>
    import('./pages/admin/ClassesPage').then((m) => ({
      Component: m.ClassesPage,
    })),
  students: () =>
    import('./pages/admin/StudentsPage').then((m) => ({
      Component: m.StudentsPage,
    })),
  student: () =>
    import('./pages/admin/StudentDetailPage').then((m) => ({
      Component: m.StudentDetailPage,
    })),
  settings: () =>
    import('./pages/admin/SettingsPage').then((m) => ({
      Component: m.SettingsPage,
    })),
  placeholder: () => import('./pages/admin/PlaceholderPage'),
};

/** Hiện trong lúc tải code khu giáo viên lần đầu. */
const adminLoading = (
  <div className="grid min-h-dvh place-items-center bg-admin-bg">
    <Loader2
      aria-label="Đang tải"
      className="size-8 animate-spin text-admin-accent"
    />
  </div>
);

// Mục nào trong menu chưa làm thì hiện trang tạm, để không bấm vào ra 404.
const upcomingAdminRoutes: RouteObject[] = ADMIN_NAV.flatMap((item) =>
  item.upcoming
    ? [
        {
          path: item.path,
          lazy: async () => {
            const { PlaceholderPage } = await adminPages.placeholder();
            const upcoming = item.upcoming!;
            return {
              Component: () => (
                <PlaceholderPage
                  title={item.label}
                  icon={item.icon}
                  {...upcoming}
                />
              ),
            };
          },
        },
      ]
    : [],
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <StudentLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <StudentLoginPage /> },
      {
        element: <RequireStudent />,
        children: [
          { path: 'play/:slug', element: <PlayPage /> },
          { path: 'me', element: <ProfilePage /> },
          { path: 'exams', element: <ExamsPage /> },
          { path: 'exams/attempts/:id', element: <AttemptPage /> },
        ],
      },
    ],
  },
  {
    path: '/admin/login',
    lazy: adminPages.login,
    hydrateFallbackElement: adminLoading,
  },
  {
    path: '/admin',
    element: <RequireAdmin />,
    hydrateFallbackElement: adminLoading,
    children: [
      {
        lazy: adminLayout,
        children: [
          { index: true, lazy: adminPages.home },
          { path: 'vocabulary', lazy: adminPages.vocabulary },
          { path: 'categories', lazy: adminPages.categories },
          { path: 'lessons', lazy: adminPages.lessons },
          { path: 'lessons/:id', lazy: adminPages.lesson },
          { path: 'questions', lazy: adminPages.questions },
          { path: 'exams', lazy: adminPages.exams },
          { path: 'exams/:id', lazy: adminPages.exam },
          { path: 'exams/:id/results', lazy: adminPages.examResults },
          { path: 'assignments', lazy: adminPages.assignments },
          { path: 'assignments/:id', lazy: adminPages.assignment },
          { path: 'games', lazy: adminPages.games },
          { path: 'classes', lazy: adminPages.classes },
          { path: 'students', lazy: adminPages.students },
          { path: 'students/:id', lazy: adminPages.student },
          { path: 'settings', lazy: adminPages.settings },
          ...upcomingAdminRoutes,
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
