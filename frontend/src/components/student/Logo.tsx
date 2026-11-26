import { Link } from 'react-router';

/** Logo: hai ô chữ N + G như các ô chữ trong game, kèm tên. */
export function Logo() {
  return (
    <Link
      to="/"
      aria-label="Novel Game — về trang chủ"
      className="inline-flex items-center gap-3"
    >
      <span aria-hidden className="flex">
        <span className="sticker grid size-11 -rotate-6 place-items-center bg-tomato font-display text-2xl font-extrabold">
          N
        </span>
        <span className="sticker -ml-1.5 grid size-11 rotate-6 place-items-center bg-sun font-display text-2xl font-extrabold">
          G
        </span>
      </span>
      <span className="font-display text-2xl font-extrabold tracking-tight">
        Novel Game
      </span>
    </Link>
  );
}
