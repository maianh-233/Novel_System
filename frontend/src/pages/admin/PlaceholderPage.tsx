import type { LucideIcon } from 'lucide-react';

/** Trang tạm cho các mục quản trị sẽ làm ở giai đoạn sau (docs/PLAN.md). */
export function PlaceholderPage({
  title,
  icon: Icon,
  description,
  phase,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
  phase: string;
}) {
  return (
    <>
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-6 flex max-w-xl items-start gap-4 rounded-xl border border-dashed border-admin-line bg-white p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-admin-accent/10 text-admin-accent">
          <Icon aria-hidden className="size-5" />
        </span>
        <div>
          <p className="font-medium">Mục này đang được xây dựng</p>
          <p className="mt-1 text-sm text-ink/70">{description}</p>
          <p className="mt-3 text-xs text-ink/55">Dự kiến: {phase}</p>
        </div>
      </div>
    </>
  );
}
