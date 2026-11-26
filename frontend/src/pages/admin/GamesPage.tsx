import {
  GAME_DEFINITIONS,
  GAME_GROUPS,
  gameUpdateSchema,
  type GameAdmin,
  type GameDefinition,
  type LessonSummary,
} from '@novel/shared';
import { ImageIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useToast } from '../../components/admin/toastContext';
import {
  Badge,
  Button,
  ErrorNote,
  LoadingBlock,
  PageHeader,
  Toggle,
} from '../../components/admin/ui';
import { GAME_ICONS } from '../../games/catalog';
import {
  useGames,
  useLessons,
  useUpdateGame,
} from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';

export function GamesPage() {
  const { data: games, isPending, error } = useGames();
  const { data: lessons = [] } = useLessons();
  const bySlug = new Map((games ?? []).map((g) => [g.slug, g]));

  return (
    <>
      <PageHeader
        title="Trò chơi"
        description="Bật/tắt trò chơi, chọn số từ mỗi lượt, thời gian và bài học mà học sinh được chơi."
      />
      <div className="mt-6 space-y-8">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : (
          (Object.keys(GAME_GROUPS) as Array<keyof typeof GAME_GROUPS>).map(
            (group) => (
              <section key={group} aria-labelledby={`g-${group}`}>
                <h2 id={`g-${group}`} className="font-semibold">
                  {GAME_GROUPS[group].title}
                </h2>
                <ul className="mt-3 grid gap-4 xl:grid-cols-2">
                  {GAME_DEFINITIONS.filter((d) => d.group === group).map(
                    (def) => {
                      const game = bySlug.get(def.slug);
                      return game ? (
                        <li key={def.slug}>
                          {/* key theo dữ liệu đã lưu → lưu xong form tự làm mới */}
                          <GameCard
                            key={JSON.stringify(game)}
                            def={def}
                            game={game}
                            lessons={lessons}
                          />
                        </li>
                      ) : null;
                    },
                  )}
                </ul>
              </section>
            ),
          )
        )}
      </div>
    </>
  );
}

function GameCard({
  def,
  game,
  lessons,
}: {
  def: GameDefinition;
  game: GameAdmin;
  lessons: LessonSummary[];
}) {
  const update = useUpdateGame();
  const toast = useToast();
  const Icon = GAME_ICONS[def.slug];
  const [lessonIds, setLessonIds] = useState<string[]>(game.lessonIds);
  const [error, setError] = useState<string>();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = gameUpdateSchema.safeParse({
      config: {
        wordsPerRound: form.get('wordsPerRound'),
        timeLimitSec: form.get('timeLimitSec'),
      },
      lessonIds,
    });
    if (!parsed.success) {
      setError('Số từ mỗi lượt từ 3 đến 50; thời gian từ 0 đến 600 giây.');
      return;
    }
    setError(undefined);
    update.mutate(
      { slug: def.slug, ...parsed.data },
      { onSuccess: () => toast(`Đã lưu ${def.name}`) },
    );
  };

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className={`flex h-full flex-col rounded-xl border border-admin-line bg-white p-4 ${game.isEnabled ? '' : 'bg-white/60'}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-admin-accent/10 text-admin-accent">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{def.name}</p>
          <p className="text-ink/65">{def.blurb}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {def.requires.includes('image') && (
              <Badge tone="blue">
                <ImageIcon aria-hidden className="mr-1 size-3" />
                Cần từ có hình
              </Badge>
            )}
            {def.minWords > 0 && <Badge>Tối thiểu {def.minWords} từ</Badge>}
          </div>
        </div>
        <Toggle
          checked={game.isEnabled}
          label={game.isEnabled ? `Tắt ${def.name}` : `Bật ${def.name}`}
          disabled={update.isPending}
          onChange={(isEnabled) =>
            update.mutate(
              { slug: def.slug, isEnabled },
              {
                onSuccess: () =>
                  toast(
                    isEnabled ? `Đã bật ${def.name}` : `Đã tắt ${def.name}`,
                  ),
                onError: (e) => toast(errorMessage(e), 'error'),
              },
            )
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <NumberField
          label="Số từ mỗi lượt"
          name="wordsPerRound"
          min={3}
          max={50}
          defaultValue={game.config.wordsPerRound}
        />
        <NumberField
          label="Thời gian (giây)"
          name="timeLimitSec"
          min={0}
          max={600}
          step={5}
          defaultValue={game.config.timeLimitSec}
          hint="0 = không giới hạn"
        />
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">
          Bài học dùng trong trò chơi
        </legend>
        {lessons.length === 0 ? (
          <p className="mt-1 text-ink/60">
            Chưa có bài học.{' '}
            <Link
              to="/admin/lessons"
              className="text-admin-accent hover:underline"
            >
              Tạo bài học
            </Link>
          </p>
        ) : (
          <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-admin-line p-2">
            {lessons.map((l) => (
              <label
                key={l.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-admin-bg"
              >
                <input
                  type="checkbox"
                  checked={lessonIds.includes(l.id)}
                  onChange={(e) =>
                    setLessonIds((ids) =>
                      e.target.checked
                        ? [...ids, l.id]
                        : ids.filter((x) => x !== l.id),
                    )
                  }
                  className="size-4 accent-admin-accent"
                />
                <span className="flex-1">{l.title}</span>
                <span className="text-xs text-ink/50">{l.wordCount} từ</span>
                {!l.isPublished && <Badge>Bản nháp</Badge>}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {(error || update.error) && (
        <div className="mt-3">
          <ErrorNote>{error ?? errorMessage(update.error)}</ErrorNote>
        </div>
      )}

      <div className="mt-auto flex justify-end pt-4">
        <Button type="submit" variant="primary" loading={update.isPending}>
          Lưu
        </Button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="number"
        inputMode="numeric"
        {...props}
        className="mt-1.5 w-full rounded-lg border-2 border-admin-line bg-white px-3 py-2 font-normal outline-none focus:border-admin-accent"
      />
      {hint && (
        <span className="mt-1 block text-xs font-normal text-ink/55">
          {hint}
        </span>
      )}
    </label>
  );
}
