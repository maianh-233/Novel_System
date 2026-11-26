import {
  QUESTION_TYPE_INFO,
  QUESTION_TYPES,
  type Level,
  type QuestionAdmin,
  type QuestionQuery,
} from '@novel/shared';
import {
  BookText,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardPaste,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AudienceBadge } from '../../components/admin/AudienceFields';
import { PassagesDialog } from '../../components/admin/PassagesDialog';
import { QuestionDialog } from '../../components/admin/QuestionDialog';
import { QuestionImportDialog } from '../../components/admin/QuestionImportDialog';
import { useToast } from '../../components/admin/toastContext';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  IconButton,
  LevelBadge,
  LoadingBlock,
  PageHeader,
  Toggle,
} from '../../components/admin/ui';
import {
  useQuestionList,
  useQuestionMutations,
  useQuestionTags,
} from '../../hooks/useQuestionsAdmin';
import { errorMessage } from '../../services/api';
import { LEVEL_LABEL } from '../../utils/levels';
import { answerText, plainText } from '../../utils/questions';

const PAGE_SIZE = 20;

/** Bộ lọc lưu trên URL: tải lại trang hoặc gửi link vẫn giữ nguyên. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? undefined;
  const query: QuestionQuery = {
    q: get('q'),
    type: get('type') as QuestionQuery['type'],
    grammarTag: get('grammarTag'),
    stage: get('stage') as QuestionQuery['stage'],
    level: (Number(params.get('level')) || undefined) as Level | undefined,
    status: get('status') as QuestionQuery['status'],
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: PAGE_SIZE,
  };
  const set = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in patch)) next.delete('page'); // đổi bộ lọc → về trang 1
    setParams(next, { replace: true });
  };
  return { query, set };
}

const selectClass =
  'rounded-lg border-2 border-admin-line bg-white px-2.5 py-1.5 outline-none focus:border-admin-accent';

export function QuestionsPage() {
  const { query, set } = useFilters();
  const { data, isPending, isFetching, error } = useQuestionList(query);
  const { data: tags = [] } = useQuestionTags();
  const m = useQuestionMutations();
  const toast = useToast();
  const [editing, setEditing] = useState<QuestionAdmin | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [passages, setPassages] = useState(false);
  const [deleting, setDeleting] = useState<QuestionAdmin | null>(null);
  const [searchText, setSearchText] = useState(query.q ?? '');

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilter = Boolean(
    query.q ||
    query.type ||
    query.grammarTag ||
    query.stage ||
    query.level ||
    query.status,
  );

  return (
    <>
      <PageHeader
        title="Câu hỏi"
        description="Ngân hàng câu hỏi dùng chung cho Unit, bài tập và đề thi. Câu đã dùng thì chuyển sang “Ngừng dùng” thay vì xoá."
        actions={
          <>
            <Button icon={BookText} onClick={() => setPassages(true)}>
              Đoạn văn
            </Button>
            <Button icon={ClipboardPaste} onClick={() => setImporting(true)}>
              Dán từ Word / CSV
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEditing('new')}
            >
              Thêm câu hỏi
            </Button>
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-admin-line bg-white p-3">
        <form
          role="search"
          className="relative min-w-52 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: searchText.trim() });
          }}
        >
          <label htmlFor="question-search" className="sr-only">
            Tìm trong đề bài
          </label>
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/45"
          />
          <input
            id="question-search"
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Tìm trong đề bài, giải thích… (Enter)"
            className="w-full rounded-lg border-2 border-admin-line py-1.5 pr-3 pl-9 outline-none focus:border-admin-accent"
          />
        </form>
        <select
          aria-label="Dạng câu"
          value={query.type ?? ''}
          onChange={(e) => set({ type: e.target.value })}
          className={selectClass}
        >
          <option value="">Mọi dạng</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_INFO[t].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Chủ điểm ngữ pháp"
          value={query.grammarTag ?? ''}
          onChange={(e) => set({ grammarTag: e.target.value })}
          className={selectClass}
        >
          <option value="">Mọi chủ điểm</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          aria-label="Cấp học"
          value={query.stage ?? ''}
          onChange={(e) => set({ stage: e.target.value })}
          className={selectClass}
        >
          <option value="">Mọi cấp học</option>
          <option value="secondary">Cấp 2</option>
          <option value="primary">Tiểu học</option>
          <option value="both">Cả hai cấp</option>
        </select>
        <select
          aria-label="Cấp độ"
          value={query.level ? String(query.level) : ''}
          onChange={(e) => set({ level: e.target.value })}
          className={selectClass}
        >
          <option value="">Mọi cấp độ</option>
          {([1, 2, 3] as const).map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
        <select
          aria-label="Trạng thái"
          value={query.status ?? ''}
          onChange={(e) => set({ status: e.target.value })}
          className={selectClass}
        >
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">Đang dùng</option>
          <option value="INACTIVE">Ngừng dùng</option>
        </select>
      </div>

      <div className="mt-4">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : data.total === 0 ? (
          <EmptyState
            icon={CircleHelp}
            title={hasFilter ? 'Không có câu nào khớp' : 'Chưa có câu hỏi nào'}
          >
            {hasFilter
              ? 'Thử bỏ bớt bộ lọc.'
              : 'Bấm “Dán từ Word / CSV” để dán cả đề một lần, hoặc “Thêm câu hỏi” để soạn từng câu.'}
          </EmptyState>
        ) : (
          <div
            className={`overflow-x-auto rounded-xl border border-admin-line bg-white ${isFetching ? 'opacity-70' : ''}`}
          >
            <table className="w-full min-w-[820px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Đề bài</th>
                  <th className="px-4 py-2.5 font-medium">Dạng</th>
                  <th className="px-4 py-2.5 font-medium">Đáp án</th>
                  <th className="px-4 py-2.5 font-medium">Chủ điểm</th>
                  <th className="px-4 py-2.5 font-medium">Cấp độ</th>
                  <th className="px-4 py-2.5 font-medium">Đang dùng</th>
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {data.items.map((q) => (
                  <tr
                    key={q.id}
                    className={q.status === 'INACTIVE' ? 'text-ink/50' : ''}
                  >
                    <td className="max-w-sm px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEditing(q)}
                        className="block w-full cursor-pointer truncate text-left font-medium hover:text-admin-accent"
                        title={plainText(q.prompt)}
                      >
                        {plainText(q.prompt)}
                      </button>
                      <span className="mt-0.5 flex flex-wrap gap-1 text-xs">
                        <AudienceBadge stage={q.stage} grade={null} />
                        {q.passage && <Badge>📄 {q.passage.title}</Badge>}
                        {q.lessonCount > 0 && (
                          <Badge tone="blue">{q.lessonCount} Unit</Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {QUESTION_TYPE_INFO[q.type].label}
                    </td>
                    <td className="max-w-48 truncate px-4 py-2.5 text-ink/75">
                      {answerText(q)}
                    </td>
                    <td className="px-4 py-2.5 text-ink/75">
                      {q.grammarTag ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <LevelBadge level={q.level} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Toggle
                        checked={q.status === 'ACTIVE'}
                        label={`Dùng câu "${plainText(q.prompt).slice(0, 40)}"`}
                        disabled={m.setStatus.isPending}
                        onChange={(on) =>
                          m.setStatus.mutate(
                            { id: q.id, status: on ? 'ACTIVE' : 'INACTIVE' },
                            {
                              onError: (e) => toast(errorMessage(e), 'error'),
                            },
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          icon={Pencil}
                          label="Sửa câu hỏi"
                          onClick={() => setEditing(q)}
                        />
                        <IconButton
                          icon={Trash2}
                          label="Xoá câu hỏi"
                          onClick={() => {
                            m.remove.reset();
                            setDeleting(q);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <nav
            aria-label="Phân trang"
            className="mt-3 flex items-center justify-between text-ink/70"
          >
            <span>
              {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.total)} trong{' '}
              {data.total} câu
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                icon={ChevronLeft}
                label="Trang trước"
                disabled={data.page <= 1}
                onClick={() => set({ page: data.page - 1 })}
              />
              <span className="px-2">
                Trang {data.page}/{pages}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Trang sau"
                disabled={data.page >= pages}
                onClick={() => set({ page: data.page + 1 })}
              />
            </div>
          </nav>
        )}
      </div>

      {editing && (
        <QuestionDialog
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {importing && (
        <QuestionImportDialog onClose={() => setImporting(false)} />
      )}
      {passages && <PassagesDialog onClose={() => setPassages(false)} />}

      <ConfirmDialog
        open={deleting !== null}
        title="Xoá câu hỏi?"
        confirmLabel="Xoá câu hỏi"
        loading={m.remove.isPending}
        error={m.remove.error ? errorMessage(m.remove.error) : null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          m.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast('Đã xoá câu hỏi');
              setDeleting(null);
            },
          })
        }
      >
        Câu hỏi sẽ bị xoá hẳn. Câu đang nằm trong Unit thì không xoá được — hãy
        tắt “Đang dùng”.
      </ConfirmDialog>
    </>
  );
}
