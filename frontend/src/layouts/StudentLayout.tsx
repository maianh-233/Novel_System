import { Outlet } from 'react-router';
import { Logo } from '../components/student/Logo';

export function StudentLayout() {
  return (
    <div className="min-h-dvh bg-notebook">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
