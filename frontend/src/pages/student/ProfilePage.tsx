import { Gamepad2, Loader2, Star } from 'lucide-react';
import { Link } from 'react-router';
import { usePlayHistory, useStudentMe } from '../../hooks/useStudentSession';
import { errorMessage } from '../../services/api';

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Hồ sơ của em: tổng số sao và những lượt chơi gần đây. */
export function ProfilePage() {
  const { data: me } = useStudentMe();
  const history = usePlayHistory();
  if (!me) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section className="sticker flex flex-wrap items-center gap-6 bg-white p-6 sm:p-8">
        <span
          aria-hidden
          className="sticker grid size-20 shrink-0 -rotate-3 place-items-center bg-violet font-display text-4xl font-extrabold text-white"
        >
          {me.displayName.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">
            {me.displayName}
          </h1>
          <p className="text-ink/60">Tên đăng nhập: {me.username}</p>
        </div>
        <div className="sticker rotate-2 bg-sun px-5 py-3 text-center">
          <p className="inline-flex items-center gap-2 font-display text-4xl font-extrabold">
            <Star aria-hidden className="size-8 fill-ink" />
            {me.totalStars}
          </p>
          <p className="text-sm font-medium">sao đã nhận</p>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-extrabold">
          Em đã chơi gần đây
        </h2>
        {history.isPending ? (
          <Loader2 aria-label="Đang tải" className="mt-4 size-8 animate-spin" />
        ) : history.isError ? (
          <p className="mt-3 text-tomato">{errorMessage(history.error)}</p>
        ) : history.data.length === 0 ? (
          <div className="sticker mt-4 bg-white p-6 text-center">
            <p className="text-lg">Em chưa chơi lượt nào.</p>
            <Link
              to="/"
              className="sticker pressable mt-4 inline-flex items-center gap-2 bg-mint px-5 py-2.5 font-display text-xl font-bold"
            >
              <Gamepad2 aria-hidden className="size-5" strokeWidth={2.5} />
              Chọn trò chơi
            </Link>
          </div>
        ) : (
          <ul className="sticker mt-4 divide-y-2 divide-dashed divide-grid bg-white px-5">
            {history.data.map((s) => (
              <li key={s.id} className="flex items-center gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl leading-tight font-bold">
                    {s.gameName}
                  </p>
                  <p className="truncate text-ink/65">
                    {s.lessonTitle} ·{' '}
                    {dateFormat.format(new Date(s.finishedAt))}
                  </p>
                </div>
                <span className="text-ink/70">
                  {s.correctCount}/{s.correctCount + s.wrongCount} đúng
                </span>
                <span className="flex" role="img" aria-label={`${s.stars} sao`}>
                  {[0, 1, 2].map((i) => (
                    <Star
                      key={i}
                      aria-hidden
                      className={`size-6 ${i < s.stars ? 'fill-sun' : 'fill-white text-ink/25'}`}
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
