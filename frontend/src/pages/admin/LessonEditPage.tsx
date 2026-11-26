import {
  GAME_DEFINITIONS,
  GAME_GROUPS,
  lessonUpdateSchema,
  type GameAdmin,
  type LessonDetail,
  type LessonGamePreview,
  type Level,
  type VocabularyAdmin,
} from '@novel/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  CircleAlert,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AudienceFields,
  type Audience,
} from '../../components/admin/AudienceFields';
import { Field } from '../../components/admin/Field';
import { useToast } from '../../components/admin/toastContext';
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorNote,
  IconButton,
  LevelBadge,
  LevelPicker,
  LoadingBlock,
  TextAreaField,
  Toggle,
} from '../../components/admin/ui';
import { GAME_ICONS } from '../../games/catalog';
import {
  useCategories,
  useGames,
  useLesson,
  useLessonMutations,
  useLessonPreview,
  useUpdateGame,
  useVocabularyList,
} from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';

export function LessonEditPage() {
  const { id = '' } = useParams();
  const { data: lesson, isPending, error } = useLesson(id);

  if (isPending) return <LoadingBlock />;
  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorNote>{errorMessage(error)}</ErrorNote>
      </div>
    );
  }
  // key: đổi bài học → làm mới toàn bộ bản nháp.
  return <LessonEditor key={lesson.id} lesson={lesson} />;
}

function BackLink() {
  return (
    <Link
      to="/admin/lessons"
      className="inline-flex items-center gap-1.5 text-ink/70 hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Tất cả bài học
    </Link>
  );
}

function LessonEditor({ lesson }: { lesson: LessonDetail }) {
  const m = useLessonMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <Toggle
              checked={lesson.isPublished}
              label="Công khai cho học sinh"
              disabled={m.update.isPending}
              onChange={(isPublished) =>
                m.update.mutate(
                  { id: lesson.id, isPublished },
                  {
                    onSuccess: () =>
                      toast(
                        isPublished
                          ? 'Đã công khai bài học'
                          : 'Đã chuyển về bản nháp',
                      ),
                    onError: (e) => toast(errorMessage(e), 'error'),
                  },
                )
              }
            />
            <span>{lesson.isPublished ? 'Công khai' : 'Bản nháp'}</span>
          </span>
          <Button
            variant="ghost"
            icon={Trash2}
            onClick={() => {
              m.remove.reset();
              setDeleting(true);
            }}
          >
            Xoá
          </Button>
        </div>
      </div>

      <LessonInfoForm lesson={lesson} />
      <LessonWordsEditor lesson={lesson} />
      <LessonGames lesson={lesson} />

      <ConfirmDialog
        open={deleting}
        title="Xoá bài học?"
        confirmLabel="Xoá bài học"
        loading={m.remove.isPending}
        error={m.remove.error ? errorMessage(m.remove.error) : null}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          m.remove.mutate(lesson.id, {
            onSuccess: () => {
              toast(`Đã xoá "${lesson.title}"`);
              navigate('/admin/lessons', { replace: true });
            },
          })
        }
      >
        Bài học <strong>{lesson.title}</strong> sẽ bị xoá và gỡ khỏi mọi trò
        chơi. Từ vựng trong kho vẫn giữ nguyên.
      </ConfirmDialog>
    </div>
  );
}

// ───────────── Thông tin ─────────────

function LessonInfoForm({ lesson }: { lesson: LessonDetail }) {
  const { update } = useLessonMutations();
  const toast = useToast();
  const [level, setLevel] = useState<Level>(lesson.level);
  const [audience, setAudience] = useState<Audience>({
    stage: lesson.stage,
    grade: lesson.grade,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = lessonUpdateSchema.safeParse({
      title: form.get('title'),
      description: form.get('description'),
      level,
      ...audience,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues)
        errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    update.mutate(
      { id: lesson.id, ...parsed.data },
      { onSuccess: () => toast('Đã lưu thông tin bài học') },
    );
  };

  return (
    <section
      aria-labelledby="info-title"
      className="rounded-xl border border-admin-line bg-white p-5"
    >
      <h1 id="info-title" className="text-xl font-semibold">
        {lesson.title}
      </h1>
      <form
        noValidate
        onSubmit={onSubmit}
        className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]"
      >
        <div className="space-y-4">
          <Field
            label="Tên bài học"
            name="title"
            defaultValue={lesson.title}
            error={errors.title}
          />
          <TextAreaField
            label="Mô tả"
            name="description"
            rows={2}
            defaultValue={lesson.description ?? ''}
            placeholder="Học sinh sẽ học gì trong bài này?"
            error={errors.description}
          />
          <AudienceFields
            value={audience}
            onChange={setAudience}
            error={errors.grade}
          />
        </div>
        <div className="flex flex-col justify-between gap-4">
          <LevelPicker value={level} onChange={setLevel} name="lesson-level" />
          <Button
            variant="primary"
            type="submit"
            loading={update.isPending}
            className="self-start md:self-end"
          >
            Lưu thông tin
          </Button>
        </div>
        {update.error && (
          <div className="md:col-span-2">
            <ErrorNote>{errorMessage(update.error)}</ErrorNote>
          </div>
        )}
      </form>
    </section>
  );
}

// ───────────── Danh sách từ ─────────────

function LessonWordsEditor({ lesson }: { lesson: LessonDetail }) {
  const { setWords } = useLessonMutations();
  const toast = useToast();
  const [draft, setDraft] = useState<VocabularyAdmin[]>(lesson.words);
  const savedIds = lesson.words.map((w) => w.id).join(',');
  const dirty = draft.map((w) => w.id).join(',') !== savedIds;
  const selected = new Set(draft.map((w) => w.id));

  const move = (i: number, delta: -1 | 1) =>
    setDraft((list) => {
      const next = [...list];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });

  const add = (words: VocabularyAdmin[]) =>
    setDraft((list) => [
      ...list,
      ...words.filter((w) => !list.some((x) => x.id === w.id)),
    ]);

  const save = () =>
    setWords.mutate(
      { id: lesson.id, vocabularyIds: draft.map((w) => w.id) },
      {
        onSuccess: (l) => {
          setDraft(l.words);
          toast(`Đã lưu ${l.words.length} từ`);
        },
      },
    );

  return (
    <section
      aria-labelledby="words-title"
      className="grid gap-4 lg:grid-cols-2"
    >
      <div className="flex flex-col rounded-xl border border-admin-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-line px-4 py-3">
          <h2 id="words-title" className="font-semibold">
            Từ trong bài{' '}
            <span className="font-normal text-ink/60">({draft.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {dirty && <Badge tone="amber">Chưa lưu</Badge>}
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(lesson.words)}>
                Bỏ thay đổi
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!dirty}
              loading={setWords.isPending}
              onClick={save}
            >
              Lưu danh sách từ
            </Button>
          </div>
        </div>
        {setWords.error && (
          <div className="px-4 pt-3">
            <ErrorNote>{errorMessage(setWords.error)}</ErrorNote>
          </div>
        )}
        {draft.length === 0 ? (
          <p className="px-4 py-10 text-center text-ink/60">
            Chưa có từ nào. Tìm và thêm từ ở khung bên cạnh.
          </p>
        ) : (
          <ol className="max-h-[28rem] divide-y divide-admin-line overflow-y-auto">
            {draft.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-6 text-right text-xs text-ink/45">
                  {i + 1}
                </span>
                <WordThumb word={w} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-medium ${w.status === 'INACTIVE' ? 'text-ink/45 line-through' : ''}`}
                  >
                    {w.word}
                  </p>
                  <p className="truncate text-xs text-ink/60">{w.meaning}</p>
                </div>
                <IconButton
                  icon={ArrowUp}
                  label={`Đưa "${w.word}" lên`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                />
                <IconButton
                  icon={ArrowDown}
                  label={`Đưa "${w.word}" xuống`}
                  disabled={i === draft.length - 1}
                  onClick={() => move(i, 1)}
                />
                <IconButton
                  icon={X}
                  label={`Bỏ "${w.word}" khỏi bài`}
                  onClick={() =>
                    setDraft((list) => list.filter((x) => x.id !== w.id))
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <WordPicker selected={selected} onAdd={add} />
    </section>
  );
}

function WordThumb({ word }: { word: VocabularyAdmin }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-admin-bg text-sm">
      {word.imageUrl ? (
        <img
          src={word.imageUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden>{word.category.icon ?? '·'}</span>
      )}
    </span>
  );
}

function WordPicker({
  selected,
  onAdd,
}: {
  selected: Set<string>;
  onAdd: (words: VocabularyAdmin[]) => void;
}) {
  const { data: categories = [] } = useCategories();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const { data, isPending, isFetching } = useVocabularyList({
    q: q.trim() || undefined,
    categoryId: categoryId || undefined,
    status: 'ACTIVE',
    pageSize: 50,
  });
  const notAdded = data?.items.filter((w) => !selected.has(w.id)) ?? [];

  return (
    <div className="flex flex-col rounded-xl border border-admin-line bg-white">
      <div className="space-y-2 border-b border-admin-line px-4 py-3">
        <h2 className="font-semibold">Thêm từ từ kho</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-40 flex-1">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/45"
            />
            <input
              type="search"
              aria-label="Tìm từ để thêm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm từ hoặc nghĩa"
              className="w-full rounded-lg border-2 border-admin-line py-1.5 pr-3 pl-9 outline-none focus:border-admin-accent"
            />
          </div>
          <select
            aria-label="Lọc theo chủ đề"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border-2 border-admin-line bg-white px-2.5 py-1.5 outline-none focus:border-admin-accent"
          >
            <option value="">Mọi chủ đề</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </select>
          <Button
            icon={Plus}
            disabled={notAdded.length === 0}
            onClick={() => onAdd(notAdded)}
          >
            Thêm tất cả ({notAdded.length})
          </Button>
        </div>
        {data && data.total > data.items.length && (
          <p className="text-xs text-ink/55">
            Đang hiện {data.items.length}/{data.total} từ — lọc theo chủ đề hoặc
            tìm để thu hẹp.
          </p>
        )}
      </div>
      {isPending ? (
        <LoadingBlock />
      ) : (
        <ul
          className={`max-h-[28rem] divide-y divide-admin-line overflow-y-auto ${isFetching ? 'opacity-70' : ''}`}
        >
          {data?.items.length === 0 && (
            <li className="px-4 py-10 text-center text-ink/60">
              Không có từ nào khớp.
            </li>
          )}
          {data?.items.map((w) => {
            const added = selected.has(w.id);
            return (
              <li key={w.id} className="flex items-center gap-2 px-3 py-1.5">
                <WordThumb word={w} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{w.word}</p>
                  <p className="truncate text-xs text-ink/60">
                    {w.meaning} · {w.category.name}
                  </p>
                </div>
                <LevelBadge level={w.level} />
                {added ? (
                  <span className="w-16 text-center text-xs text-ink/50">
                    Đã thêm
                  </span>
                ) : (
                  <Button
                    className="w-16 px-2!"
                    icon={Plus}
                    onClick={() => onAdd([w])}
                    aria-label={`Thêm "${w.word}"`}
                  >
                    Thêm
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────── Trò chơi + xem trước ─────────────

function LessonGames({ lesson }: { lesson: LessonDetail }) {
  const { data: games } = useGames();
  const { data: previews, isPending } = useLessonPreview(lesson.id);
  const updateGame = useUpdateGame();
  const toast = useToast();
  const bySlug = new Map((games ?? []).map((g) => [g.slug, g]));
  const previewBySlug = new Map((previews ?? []).map((p) => [p.gameSlug, p]));

  const toggle = (game: GameAdmin, on: boolean) => {
    const lessonIds = on
      ? [...game.lessonIds, lesson.id]
      : game.lessonIds.filter((id) => id !== lesson.id);
    updateGame.mutate(
      { slug: game.slug, lessonIds },
      { onError: (e) => toast(errorMessage(e), 'error') },
    );
  };

  return (
    <section
      aria-labelledby="games-title"
      className="rounded-xl border border-admin-line bg-white"
    >
      <div className="border-b border-admin-line px-4 py-3">
        <h2 id="games-title" className="font-semibold">
          Trò chơi dùng bài học này
        </h2>
        <p className="text-ink/65">
          Bật để học sinh chơi bài học này trong trò chơi đó. Cột bên phải cho
          biết trò chơi nhận được bao nhiêu từ (theo danh sách đã lưu).
        </p>
      </div>
      {isPending || !games ? (
        <LoadingBlock />
      ) : (
        <div className="divide-y divide-admin-line">
          {(Object.keys(GAME_GROUPS) as Array<keyof typeof GAME_GROUPS>).map(
            (group) => (
              <div key={group} className="px-4 py-3">
                <h3 className="text-xs font-medium text-ink/55">
                  {GAME_GROUPS[group].title}
                </h3>
                <ul className="mt-1">
                  {GAME_DEFINITIONS.filter((d) => d.group === group).map(
                    (def) => {
                      const game = bySlug.get(def.slug);
                      const preview = previewBySlug.get(def.slug);
                      if (!game || !preview) return null;
                      const on = game.lessonIds.includes(lesson.id);
                      const Icon = GAME_ICONS[def.slug];
                      return (
                        <li
                          key={def.slug}
                          className="flex flex-wrap items-center gap-3 py-2"
                        >
                          <Toggle
                            checked={on}
                            label={`Dùng bài học trong ${def.name}`}
                            disabled={updateGame.isPending}
                            onChange={(v) => toggle(game, v)}
                          />
                          <Icon aria-hidden className="size-4 text-ink/60" />
                          <span className="min-w-32 flex-1 font-medium">
                            {def.name}
                            {!game.isEnabled && (
                              <span className="ml-2">
                                <Badge>Đang tắt</Badge>
                              </span>
                            )}
                          </span>
                          <PreviewSummary
                            preview={preview}
                            minWords={def.minWords}
                          />
                        </li>
                      );
                    },
                  )}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function PreviewSummary({
  preview,
  minWords,
}: {
  preview: LessonGamePreview;
  minWords: number;
}) {
  const [open, setOpen] = useState(false);
  const reasons = new Map<string, string[]>();
  for (const e of preview.excluded)
    reasons.set(e.reason, [...(reasons.get(e.reason) ?? []), e.word]);

  return (
    <div className="flex flex-col items-end text-right">
      <span className="flex items-center gap-1.5">
        {preview.playable ? (
          <CheckCircle2 aria-hidden className="size-4 text-[#13734c]" />
        ) : (
          <CircleAlert aria-hidden className="size-4 text-[#b07a00]" />
        )}
        {preview.playable
          ? `${preview.words.length} từ dùng được`
          : `Cần ít nhất ${minWords} từ dùng được (hiện có ${preview.words.length})`}
        {preview.excluded.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="cursor-pointer text-admin-accent underline-offset-2 hover:underline"
          >
            {open ? 'Ẩn' : `${preview.excluded.length} từ bị loại`}
          </button>
        )}
      </span>
      {open && (
        <ul className="mt-1 text-xs text-ink/65">
          {[...reasons].map(([reason, words]) => (
            <li key={reason}>
              <span className="font-medium">{reason}:</span> {words.join(', ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
