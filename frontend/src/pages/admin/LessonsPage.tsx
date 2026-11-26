import { GAME_DEFINITIONS, lessonInputSchema } from '@novel/shared';
import { Library, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  AudienceBadge,
  AudienceFields,
  type Audience,
} from '../../components/admin/AudienceFields';
import { Field } from '../../components/admin/Field';
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  LevelBadge,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../../components/admin/ui';
import { useLessonMutations, useLessons } from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';

const gameName = (slug: string) =>
  GAME_DEFINITIONS.find((g) => g.slug === slug)?.name ?? slug;

export function LessonsPage() {
  const { data: lessons, isPending, error } = useLessons();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Bài học"
        description="Mỗi bài học là một bộ từ (có thể lấy từ nhiều chủ đề). Gán bài học cho trò chơi ở trang Trò chơi hoặc ngay trong bài học."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setCreating(true)}
          >
            Tạo bài học
          </Button>
        }
      />

      <div className="mt-6">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : lessons.length === 0 ? (
          <EmptyState icon={Library} title="Chưa có bài học nào">
            Tạo bài học, chọn từ vựng, rồi gán cho trò chơi để học sinh bắt đầu
            chơi.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/admin/lessons/${l.id}`}
                  className="flex h-full flex-col rounded-xl border border-admin-line bg-white p-5 hover:border-admin-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{l.title}</p>
                    {l.isPublished ? (
                      <Badge tone="green">Công khai</Badge>
                    ) : (
                      <Badge>Bản nháp</Badge>
                    )}
                  </div>
                  {l.description && (
                    <p className="mt-1 line-clamp-2 text-ink/65">
                      {l.description}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-ink/60">
                    <LevelBadge level={l.level} />
                    <AudienceBadge stage={l.stage} grade={l.grade} />
                    <span>{l.wordCount} từ</span>
                    <span aria-hidden>·</span>
                    <span title={l.gameSlugs.map(gameName).join(', ')}>
                      {l.gameSlugs.length
                        ? `Dùng trong ${l.gameSlugs.length} trò chơi`
                        : 'Chưa gán trò chơi'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating && <CreateLessonDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateLessonDialog({ onClose }: { onClose: () => void }) {
  const { create } = useLessonMutations();
  const navigate = useNavigate();
  const [titleError, setTitleError] = useState<string>();
  const [audience, setAudience] = useState<Audience>({
    stage: 'primary',
    grade: null,
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = lessonInputSchema.safeParse({
      title: form.get('title'),
      ...audience,
    });
    if (!parsed.success) {
      setTitleError(parsed.error.issues[0].message);
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (lesson) => navigate(`/admin/lessons/${lesson.id}`),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Tạo bài học"
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="lesson-create"
            loading={create.isPending}
          >
            Tạo và chọn từ
          </Button>
        </>
      }
    >
      <form
        id="lesson-create"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <Field
          label="Tên bài học"
          name="title"
          placeholder="Unit 3 — Con vật trong nông trại"
          autoFocus
          error={titleError}
        />
        <AudienceFields value={audience} onChange={setAudience} />
        {create.error && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
      </form>
    </Modal>
  );
}
