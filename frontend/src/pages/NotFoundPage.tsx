import { House } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-notebook p-6">
      <div className="sticker max-w-md bg-white p-8 text-center">
        <p aria-hidden className="flex justify-center gap-2">
          {['4', '0', '4'].map((d, i) => (
            <span
              key={i}
              className={`sticker grid size-16 place-items-center font-display text-4xl font-extrabold ${i === 1 ? 'rotate-6 bg-sun' : '-rotate-3 bg-tomato'}`}
            >
              {d}
            </span>
          ))}
        </p>
        <h1 className="mt-6 font-display text-3xl font-extrabold">
          Không tìm thấy trang này
        </h1>
        <p className="mt-1 text-ink/70">
          Mình quay về trang chủ chơi tiếp nhé.
        </p>
        <Link
          to="/"
          className="sticker pressable mt-6 inline-flex items-center gap-2 bg-sky px-6 py-3 font-display text-xl font-bold"
        >
          <House aria-hidden className="size-5" strokeWidth={2.5} />
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
