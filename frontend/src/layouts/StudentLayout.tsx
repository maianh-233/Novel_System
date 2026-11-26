import { Outlet } from 'react-router';
import { Logo } from '../components/student/Logo';
import { StudentBar } from '../components/student/StudentBar';
import { useLearner } from '../hooks/useStudentSession';

/** `data-stage` đổi bộ design token: tiểu học "dán sticker", cấp 2 gọn và trưởng thành hơn. */
export function StudentLayout() {
  const { stage } = useLearner();
  return (
    <div data-stage={stage} className="min-h-dvh bg-notebook">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Logo />
        <StudentBar />
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
