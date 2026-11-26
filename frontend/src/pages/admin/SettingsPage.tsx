import { ADMIN_PASSWORD_MIN, changePasswordSchema } from '@novel/shared';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Field } from '../../components/admin/Field';
import { useChangePassword } from '../../hooks/useAdminSession';
import { authErrorMessage } from '../../utils/authErrors';

type Key = 'currentPassword' | 'newPassword' | 'confirmPassword';
type FieldErrors = Partial<Record<Key, string>>;

export function SettingsPage() {
  const change = useChangePassword();
  const [errors, setErrors] = useState<FieldErrors>({});

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const errs: FieldErrors = {};

    const parsed = changePasswordSchema.safeParse({
      currentPassword: form.get('currentPassword'),
      newPassword: form.get('newPassword'),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as Key] ??= issue.message;
      }
    }
    if (form.get('confirmPassword') !== form.get('newPassword')) {
      errs.confirmPassword = 'Hai mật khẩu mới chưa khớp nhau';
    }
    setErrors(errs);
    if (!parsed.success || errs.confirmPassword) return;

    change.mutate(parsed.data, { onSuccess: () => formEl.reset() });
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">Đổi mật khẩu</h1>
      <p className="mt-1 text-sm text-ink/70">
        Sau khi đổi, các thiết bị khác đang đăng nhập sẽ phải đăng nhập lại.
      </p>

      <form
        noValidate
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-xl border border-admin-line bg-white p-6"
      >
        <Field
          label="Mật khẩu hiện tại"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword}
        />
        <Field
          label="Mật khẩu mới"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hint={`Ít nhất ${ADMIN_PASSWORD_MIN} ký tự.`}
          error={errors.newPassword}
        />
        <Field
          label="Nhập lại mật khẩu mới"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        {change.isError && (
          <p
            role="alert"
            className="rounded-lg border-2 border-tomato/40 bg-tomato/10 px-3 py-2 text-sm"
          >
            {authErrorMessage(change.error)}
          </p>
        )}
        {change.isSuccess && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border-2 border-mint/50 bg-mint/10 px-3 py-2 text-sm"
          >
            <CheckCircle2 aria-hidden className="size-4 text-[#1a8a5c]" />
            Đã đổi mật khẩu.
          </p>
        )}

        <button
          type="submit"
          disabled={change.isPending}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-admin-accent/90 disabled:cursor-wait disabled:opacity-70"
        >
          {change.isPending && (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          )}
          Đổi mật khẩu
        </button>
      </form>
    </div>
  );
}
