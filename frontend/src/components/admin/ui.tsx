import { AlertCircle, Loader2, X, type LucideIcon } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import type { Level } from '@novel/shared';
import { LEVEL_LABEL } from '../../utils/levels';

// ───────────── Nút ─────────────

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-admin-accent text-white hover:bg-admin-accent/90',
  secondary: 'border border-admin-line bg-white hover:bg-admin-bg',
  danger: 'bg-[#d63a2f] text-white hover:bg-[#c1332a]',
  ghost: 'hover:bg-admin-bg',
};

export function Button({
  variant = 'secondary',
  icon: Icon,
  loading,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${VARIANT[variant]} ${className}`}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        Icon && <Icon aria-hidden className="size-4" />
      )}
      {children}
    </button>
  );
}

/** Nút chỉ có icon — bắt buộc có nhãn cho trình đọc màn hình. */
export function IconButton({
  icon: Icon,
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`grid size-8 cursor-pointer place-items-center rounded-lg text-ink/70 hover:bg-admin-bg hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

// ───────────── Hiển thị ─────────────

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue';
const TONE: Record<Tone, string> = {
  neutral: 'bg-admin-bg text-ink/70',
  green: 'bg-mint/15 text-[#13734c]',
  amber: 'bg-sun/25 text-[#7a5600]',
  red: 'bg-tomato/15 text-[#b42318]',
  blue: 'bg-admin-accent/10 text-admin-accent',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const LEVEL_TONE: Record<Level, Tone> = { 1: 'green', 2: 'amber', 3: 'red' };

export function LevelBadge({ level }: { level: Level }) {
  return <Badge tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Badge>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-ink/70">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-tomato/40 bg-tomato/10 px-3 py-2 text-sm"
    >
      <AlertCircle
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-[#b42318]"
      />
      <span className="whitespace-pre-line">{children}</span>
    </p>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-admin-line bg-white px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-admin-accent/10 text-admin-accent">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-ink/70">{children}</div>}
    </div>
  );
}

export function LoadingBlock({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-ink/60" role="status">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      {label}
    </div>
  );
}

// ───────────── Form ─────────────

const controlClass =
  'w-full rounded-lg border-2 border-admin-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-admin-accent aria-[invalid=true]:border-tomato';

export function SelectField({
  label,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        {...props}
        className={`mt-1.5 ${controlClass}`}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-err`} className="mt-1 text-sm text-[#c62f25]">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...props}
        className={`mt-1.5 ${controlClass}`}
      />
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

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-admin-accent' : 'bg-ink/20'}`}
    >
      <span
        aria-hidden
        className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

/** Chọn cấp độ Dễ / Vừa / Khó. */
export function LevelPicker({
  value,
  onChange,
  name = 'level',
}: {
  value: Level;
  onChange: (l: Level) => void;
  name?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Cấp độ</legend>
      <div className="mt-1.5 inline-flex rounded-lg border-2 border-admin-line bg-white p-0.5">
        {([1, 2, 3] as const).map((l) => (
          <label
            key={l}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky ${value === l ? 'bg-admin-accent text-white' : 'hover:bg-admin-bg'}`}
          >
            <input
              type="radio"
              name={name}
              value={l}
              checked={value === l}
              onChange={() => onChange(l)}
              className="sr-only"
            />
            {LEVEL_LABEL[l]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ───────────── Hộp thoại ─────────────

/** Hộp thoại dùng <dialog> gốc: có sẵn bẫy focus, phím Esc để đóng, nền mờ. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** true: rộng vừa; 'xl': rất rộng (form + xem trước cạnh nhau). */
  wide?: boolean | 'xl';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // bấm ra ngoài khung
      }}
      className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] rounded-xl border border-admin-line bg-white p-0 text-sm text-ink shadow-2xl backdrop:bg-ink/40 ${wide === 'xl' ? 'max-w-6xl' : wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between border-b border-admin-line px-5 py-3.5">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <IconButton icon={X} label="Đóng" onClick={onClose} />
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-admin-line px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  loading,
  error,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-ink/80">{children}</div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Modal>
  );
}
