import { adminLoginSchema } from '@novel/shared';
import { Loader2, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Field } from '../../components/admin/Field';
import { useAdminLogin, useAdminMe } from '../../hooks/useAdminSession';
import { authErrorMessage, safeAdminRedirect } from '../../utils/authErrors';

type FieldErrors = Partial<Record<'username' | 'password', string>>;

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeAdminRedirect(params.get('next'));
  const navigate = useNavigate();
  const { data: admin } = useAdminMe();
  const login = useAdminLogin();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  if (admin) return <Navigate to={next} replace />;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = adminLoginSchema.safeParse({
      username: form.get('username'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        errs[key] ??= issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    login.mutate(parsed.data, {
      onSuccess: () => navigate(next, { replace: true }),
    });
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-notebook px-5 py-10">
      <main className="w-full max-w-sm">
        <div className="flex justify-center" aria-hidden>
          {['N', 'G'].map((c, i) => (
            <span
              key={c}
              className={`sticker grid size-14 place-items-center font-display text-3xl font-extrabold ${i === 0 ? '-rotate-6 bg-tomato' : '-ml-2 rotate-6 bg-sun'}`}
            >
              {c}
            </span>
          ))}
        </div>

        <div className="sticker mt-6 bg-white p-7">
          <h1 className="font-display text-3xl leading-tight font-extrabold">
            Khu vực giáo viên
          </h1>
          <p className="mt-1 text-sm text-ink/70">
            Đăng nhập để quản lý từ vựng, bài học và học sinh.
          </p>

          <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field
              label="Tên đăng nhập"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              error={fieldErrors.username}
            />
            <Field
              label="Mật khẩu"
              name="password"
              type="password"
              autoComplete="current-password"
              error={fieldErrors.password}
            />

            {login.isError && (
              <p
                role="alert"
                className="rounded-lg border-2 border-tomato/40 bg-tomato/10 px-3 py-2 text-sm"
              >
                {authErrorMessage(login.error)}
              </p>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="sticker pressable flex w-full cursor-pointer items-center justify-center gap-2 bg-sky py-3 font-display text-xl font-bold disabled:cursor-wait disabled:opacity-70"
            >
              {login.isPending ? (
                <Loader2 aria-hidden className="size-5 animate-spin" />
              ) : (
                <LogIn aria-hidden className="size-5" strokeWidth={2.5} />
              )}
              Đăng nhập
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link to="/" className="underline underline-offset-4">
            Về trang học sinh
          </Link>
        </p>
      </main>
    </div>
  );
}
