import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Ô nhập có nhãn + thông báo lỗi gắn đúng với ô (đọc được bằng trình đọc màn hình). */
export function Field({ label, error, hint, type, ...input }: FieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const describedBy =
    [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-lg border-2 bg-white px-3 py-2.5 text-base outline-none transition-colors focus:border-admin-accent ${isPassword ? 'pr-11' : ''} ${error ? 'border-tomato' : 'border-admin-line'}`}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center text-ink/60 hover:text-ink"
          >
            {reveal ? (
              <EyeOff aria-hidden className="size-5" />
            ) : (
              <Eye aria-hidden className="size-5" />
            )}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink/60">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-sm text-[#c62f25]">
          {error}
        </p>
      )}
    </div>
  );
}
