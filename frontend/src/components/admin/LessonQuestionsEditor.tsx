import {
  QUESTION_TYPE_INFO,
  QUESTION_TYPES,
  type LessonDetail,
  type QuestionAdmin,
  type QuestionType,
} from '@novel/shared';
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useLessonMutations } from '../../hooks/useContentAdmin';
import { useQuestionList } from '../../hooks/useQuestionsAdmin';
import { errorMessage } from '../../services/api';
import { plainText } from '../../utils/questions';
import { useToast } from './toastContext';
import {
  Badge,
  Button,
  ErrorNote,
  IconButton,
  LevelBadge,
  LoadingBlock,
} from './ui';

/** Câu hỏi của Unit: danh sách theo thứ tự (bên trái) + tìm câu trong ngân hàng để thêm (bên phải). */
export function LessonQuestionsEditor({ lesson }: { lesson: LessonDetail }) {
  const { setQuestions } = useLessonMutations();
  const toast = useToast();
  const [draft, setDraft] = useState<QuestionAdmin[]>(lesson.questions);
  const savedIds = lesson.questions.map((q) => q.id).join(',');
  const dirty = draft.map((q) => q.id).join(',') !== savedIds;
  const selected = new Set(draft.map((q) => q.id));

  const move = (i: number, delta: -1 | 1) =>
    setDraft((list) => {
      const next = [...list];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });

  const add = (qs: QuestionAdmin[]) =>
    setDraft((list) => [
      ...list,
      ...qs.filter((q) => !list.some((x) => x.id === q.id)),
    ]);

  const save = () =>
    setQuestions.mutate(
      { id: lesson.id, questionIds: draft.map((q) => q.id) },
      {
        onSuccess: (l) => {
          setDraft(l.questions);
          toast(`Đã lưu ${l.questions.length} câu hỏi`);
        },
      },
    );

  return (
    <section
      aria-labelledby="questions-title"
      className="grid gap-4 lg:grid-cols-2"
    >
      <div className="flex flex-col rounded-xl border border-admin-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-line px-4 py-3">
          <h2 id="questions-title" className="font-semibold">
            Câu hỏi của Unit{' '}
            <span className="font-normal text-ink/60">({draft.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {dirty && <Badge tone="amber">Chưa lưu</Badge>}
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => setDraft(lesson.questions)}
              >
                Bỏ thay đổi
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!dirty}
              loading={setQuestions.isPending}
              onClick={save}
            >
              Lưu câu hỏi
            </Button>
          </div>
        </div>
        {setQuestions.error && (
          <div className="px-4 pt-3">
            <ErrorNote>{errorMessage(setQuestions.error)}</ErrorNote>
          </div>
        )}
        {draft.length === 0 ? (
          <p className="px-4 py-10 text-center text-ink/60">
            Chưa có câu hỏi. Tìm câu trong ngân hàng ở khung bên cạnh, hoặc{' '}
            <Link to="/admin/questions" className="text-admin-accent underline">
              soạn câu mới
            </Link>
            .
          </p>
        ) : (
          <ol className="max-h-[28rem] divide-y divide-admin-line overflow-y-auto">
            {draft.map((q, i) => (
              <li key={q.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-6 text-right text-xs text-ink/45">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate ${q.status === 'INACTIVE' ? 'text-ink/45 line-through' : ''}`}
                  >
                    {plainText(q.prompt)}
                  </p>
                  <p className="truncate text-xs text-ink/60">
                    {QUESTION_TYPE_INFO[q.type].label}
                    {q.grammarTag ? ` · ${q.grammarTag}` : ''}
                  </p>
                </div>
                <IconButton
                  icon={ArrowUp}
                  label="Đưa câu lên"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                />
                <IconButton
                  icon={ArrowDown}
                  label="Đưa câu xuống"
                  disabled={i === draft.length - 1}
                  onClick={() => move(i, 1)}
                />
                <IconButton
                  icon={X}
                  label="Bỏ câu khỏi Unit"
                  onClick={() =>
                    setDraft((list) => list.filter((x) => x.id !== q.id))
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <QuestionPicker selected={selected} onAdd={add} />
    </section>
  );
}

function QuestionPicker({
  selected,
  onAdd,
}: {
  selected: Set<string>;
  onAdd: (qs: QuestionAdmin[]) => void;
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<QuestionType | ''>('');
  const { data, isPending, isFetching } = useQuestionList({
    q: q.trim() || undefined,
    type: type || undefined,
    status: 'ACTIVE',
    pageSize: 50,
  });
  const notAdded = data?.items.filter((x) => !selected.has(x.id)) ?? [];

  return (
    <div className="flex flex-col rounded-xl border border-admin-line bg-white">
      <div className="space-y-2 border-b border-admin-line px-4 py-3">
        <h2 className="font-semibold">Thêm từ ngân hàng câu hỏi</h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-40 flex-1">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/45"
            />
            <input
              type="search"
              aria-label="Tìm câu hỏi để thêm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm trong đề bài"
              className="w-full rounded-lg border-2 border-admin-line py-1.5 pr-3 pl-9 outline-none focus:border-admin-accent"
            />
          </div>
          <select
            aria-label="Lọc theo dạng câu"
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType | '')}
            className="rounded-lg border-2 border-admin-line bg-white px-2.5 py-1.5 outline-none focus:border-admin-accent"
          >
            <option value="">Mọi dạng</option>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_INFO[t].label}
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
            Đang hiện {data.items.length}/{data.total} câu — tìm hoặc lọc để thu
            hẹp.
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
              Không có câu nào khớp.
            </li>
          )}
          {data?.items.map((x) => {
            const added = selected.has(x.id);
            return (
              <li key={x.id} className="flex items-center gap-2 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{plainText(x.prompt)}</p>
                  <p className="truncate text-xs text-ink/60">
                    {QUESTION_TYPE_INFO[x.type].label}
                    {x.grammarTag ? ` · ${x.grammarTag}` : ''}
                  </p>
                </div>
                <LevelBadge level={x.level} />
                {added ? (
                  <span className="w-16 text-center text-xs text-ink/50">
                    Đã thêm
                  </span>
                ) : (
                  <Button className="w-16" onClick={() => onAdd([x])}>
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
