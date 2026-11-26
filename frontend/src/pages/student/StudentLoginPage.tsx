import { studentLoginSchema } from '@novel/shared';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useStudentLogin, useStudentMe } from '../../hooks/useStudentSession';
import {
  safeStudentRedirect,
  studentAuthErrorMessage,
} from '../../utils/studentAuth';

type FieldErrors = Partial<Record<'username' | 'password', string>>;

const inputClass =
  'mt-1.5 w-full rounded-xl border-[3px] border-ink bg-white px-4 py-3 font-display text-2xl font-bold tracking-wide outline-none focus:border-sky';

export function StudentLoginPage() {
  const [params] = useSearchParams();
  const next = safeStudentRedirect(params.get('next'));
  const navigate = useNavigate();
  const { data: me } = useStudentMe();
  const login = useStudentLogin();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  if (me) return <Navigate to={next} replace />;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = studentLoginSchema.safeParse({
      username: form.get('username'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as keyof FieldErrors] ??= issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    login.mutate(parsed.data, {
      onSuccess: () => navigate(next, { replace: true }),
    });
  };

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="sticker bg-white p-7 sm:p-9">
        <h1 className="font-display text-4xl leading-tight font-extrabold">
          Chào em!
        </h1>
        <p className="mt-1 text-lg text-ink/70">
          Nhập tên đăng nhập và mật khẩu trên phiếu thầy cô phát nhé.
        </p>

        <form noValidate onSubmit={onSubmit} className="mt-7 space-y-5">
          <label className="block">
            <span className="font-display text-xl font-bold">
              Tên đăng nhập
            </span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              aria-invalid={!!errors.username}
              className={inputClass}
            />
            {errors.username && (
              <span className="mt-1 block text-tomato">{errors.username}</span>
            )}
          </label>

          <label className="block">
            <span className="font-display text-xl font-bold">Mật khẩu</span>
            <span className="relative block">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={!!errors.password}
                className={`${inputClass} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-lg hover:bg-paper"
              >
                {showPassword ? (
                  <EyeOff aria-hidden className="size-6" />
                ) : (
                  <Eye aria-hidden className="size-6" />
                )}
              </button>
            </span>
            {errors.password && (
              <span className="mt-1 block text-tomato">{errors.password}</span>
            )}
          </label>

          {login.isError && (
            <p
              role="alert"
              className="rounded-xl border-[3px] border-tomato bg-tomato/10 px-4 py-3 text-lg"
            >
              {studentAuthErrorMessage(login.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="sticker pressable flex w-full cursor-pointer items-center justify-center gap-2 bg-mint py-3.5 font-display text-2xl font-bold disabled:cursor-wait disabled:opacity-70"
          >
            {login.isPending ? (
              <Loader2 aria-hidden className="size-6 animate-spin" />
            ) : (
              <LogIn aria-hidden className="size-6" strokeWidth={2.5} />
            )}
            Vào chơi
          </button>
        </form>
      </div>
    </div>
  );
}
