import { Play } from 'lucide-react';
import { TINT_BG, type CatalogGame, type Tint } from '../../games/catalog';

// Sticker dán hơi lệch cho giống dán tay; khi trỏ chuột vào thì "dán thẳng" lại.
const TILTS = ['-rotate-1', 'rotate-[0.75deg]', '-rotate-[0.5deg]', 'rotate-1'];

export function GameSticker({
  game,
  tint,
  index,
}: {
  game: CatalogGame;
  tint: Tint;
  index: number;
}) {
  const Icon = game.icon;
  return (
    <article
      className={`sticker flex h-full flex-col bg-white p-3 transition-transform duration-200 hover:rotate-0 ${TILTS[index % TILTS.length]}`}
    >
      <div
        className={`grid h-28 place-items-center bg-dots rounded-xl border-[3px] border-ink ${TINT_BG[tint]}`}
      >
        <span className="grid size-16 place-items-center rounded-full border-[3px] border-ink bg-white">
          <Icon aria-hidden className="size-9" strokeWidth={2.25} />
        </span>
      </div>
      <h3 className="mt-3 px-1 font-display text-2xl leading-tight font-extrabold">
        {game.name}
      </h3>
      <p className="mt-1 flex-1 px-1 text-sm leading-snug text-ink/75">
        {game.blurb}
      </p>
      <div className="mt-3 px-1 pb-1">
        {game.ready ? (
          <button
            type="button"
            className="sticker pressable inline-flex cursor-pointer items-center gap-2 bg-mint px-4 py-2 font-display text-lg font-bold"
          >
            <Play aria-hidden className="size-5 fill-ink" />
            Chơi
          </button>
        ) : (
          <span className="inline-block rounded-full border-2 border-dashed border-ink/40 px-3 py-1 text-sm text-ink/70">
            Sắp có
          </span>
        )}
      </div>
    </article>
  );
}
