import {
  VOCABULARY_STATUSES,
  type Level,
  type VocabularyAdmin,
  type VocabularyQuery,
} from '@novel/shared';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileUp,
  ImageIcon,
  Music,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ImportDialog } from '../../components/admin/ImportDialog';
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
} from '../../components/admin/ui';
import { VocabularyDialog } from '../../components/admin/VocabularyDialog';
import {
  useCategories,
  useVocabularyList,
  useVocabularyMutations,
} from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';
import { LEVEL_LABEL } from '../../utils/levels';

const PAGE_SIZE = 20;

/** Bộ lọc lưu trên URL: tải lại trang hoặc gửi link vẫn giữ nguyên. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const query: VocabularyQuery = {
    q: params.get('q') ?? undefined,
    categoryId: params.get('categoryId') ?? undefined,
    level: (Number(params.get('level')) || undefined) as Level | undefined,
    status: (params.get('status') as VocabularyQuery['status']) ?? undefined,
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

export function VocabularyPage() {
  const { query, set } = useFilters();
  const { data, isPending, isFetching, error } = useVocabularyList(query);
  const { data: categories = [] } = useCategories();
  const { remove } = useVocabularyMutations();
  const toast = useToast();

  const [editing, setEditing] = useState<VocabularyAdmin | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<VocabularyAdmin | null>(null);
  const [searchText, setSearchText] = useState(query.q ?? '');

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilter = Boolean(
    query.q || query.categoryId || query.level || query.status,
  );

  return (
    <>
      <PageHeader
        title="Từ vựng"
        description="Kho từ dùng chung cho mọi trò chơi. Từ tắt “Đang sử dụng” sẽ không xuất hiện trong game."
        actions={
          <>
            <Button
              icon={FileUp}
              onClick={() => setImporting(true)}
              disabled={!categories.length}
            >
              Nhập CSV
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEditing('new')}
              disabled={!categories.length}
            >
              Thêm từ
            </Button>
          </>
        }
      />

      {/* Bộ lọc */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-admin-line bg-white p-3">
        <form
          role="search"
          className="relative min-w-52 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: searchText.trim() });
          }}
        >
          <label htmlFor="vocab-search" className="sr-only">
            Tìm từ hoặc nghĩa
          </label>
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/45"
          />
          <input
            id="vocab-search"
            type="search"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              if (e.target.value === '') set({ q: undefined });
            }}
            placeholder="Tìm từ hoặc nghĩa, rồi nhấn Enter"
            className="w-full rounded-lg border-2 border-admin-line py-2 pr-3 pl-9 outline-none focus:border-admin-accent"
          />
        </form>
        <FilterSelect
          label="Chủ đề"
          value={query.categoryId ?? ''}
          onChange={(v) => set({ categoryId: v })}
          options={categories.map((c) => [
            c.id,
            `${c.icon ?? ''} ${c.name}`.trim(),
          ])}
        />
        <FilterSelect
          label="Cấp độ"
          value={query.level ? String(query.level) : ''}
          onChange={(v) => set({ level: v })}
          options={([1, 2, 3] as const).map((l) => [String(l), LEVEL_LABEL[l]])}
        />
        <FilterSelect
          label="Trạng thái"
          value={query.status ?? ''}
          onChange={(v) => set({ status: v })}
          options={VOCABULARY_STATUSES.map((s) => [
            s,
            s === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng',
          ])}
        />
        {hasFilter && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchText('');
              set({
                q: undefined,
                categoryId: undefined,
                level: undefined,
                status: undefined,
              });
            }}
          >
            Xoá bộ lọc
          </Button>
        )}
      </div>

      <div className="mt-4">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : data.items.length === 0 ? (
          hasFilter ? (
            <EmptyState icon={Search} title="Không có từ nào khớp bộ lọc">
              Thử từ khoá khác hoặc xoá bộ lọc.
            </EmptyState>
          ) : (
            <EmptyState icon={BookOpen} title="Kho từ vựng đang trống">
              Thêm từ đầu tiên, hoặc nhập nhiều từ cùng lúc bằng file CSV.
            </EmptyState>
          )
        ) : (
          <div
            className={`overflow-x-auto rounded-xl border border-admin-line bg-white transition-opacity ${isFetching ? 'opacity-70' : ''}`}
          >
            <table className="w-full min-w-[720px] text-left">
              <caption className="sr-only">Danh sách từ vựng</caption>
              <thead className="border-b border-admin-line bg-admin-bg/60 text-xs text-ink/60">
                <tr>
                  <th scope="col" className="w-14 px-3 py-2.5 font-medium">
                    <span className="sr-only">Hình</span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Từ
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Nghĩa
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Chủ đề
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Cấp độ
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Dữ liệu
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {data.items.map((v) => (
                  <tr
                    key={v.id}
                    className={v.status === 'INACTIVE' ? 'text-ink/50' : ''}
                  >
                    <td className="px-3 py-2">
                      <span className="grid size-10 place-items-center overflow-hidden rounded-md bg-admin-bg text-lg">
                        {v.imageUrl ? (
                          <img
                            src={v.imageUrl}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span aria-hidden>{v.category.icon ?? '·'}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{v.word}</p>
                      {v.ipa && <p className="text-xs text-ink/55">{v.ipa}</p>}
                    </td>
                    <td className="px-3 py-2">{v.meaning}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {v.category.name}
                    </td>
                    <td className="px-3 py-2">
                      <LevelBadge level={v.level} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <ImageIcon
                          aria-label={v.imageUrl ? 'Có hình' : 'Chưa có hình'}
                          className={`size-4 ${v.imageUrl ? 'text-[#13734c]' : 'text-ink/20'}`}
                        />
                        <Music
                          aria-label={
                            v.audioUrl ? 'Có âm thanh' : 'Chưa có âm thanh'
                          }
                          className={`size-4 ${v.audioUrl ? 'text-[#13734c]' : 'text-ink/20'}`}
                        />
                        {v.status === 'INACTIVE' && <Badge>Ngừng dùng</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <IconButton
                          icon={Pencil}
                          label={`Sửa "${v.word}"`}
                          onClick={() => setEditing(v)}
                        />
                        <IconButton
                          icon={Trash2}
                          label={`Xoá "${v.word}"`}
                          onClick={() => {
                            remove.reset();
                            setDeleting(v);
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
              {data.total} từ
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
        <VocabularyDialog
          word={editing === 'new' ? null : editing}
          categories={categories}
          defaultCategoryId={query.categoryId}
          onClose={() => setEditing(null)}
        />
      )}
      {importing && (
        <ImportDialog
          categories={categories}
          onClose={() => setImporting(false)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Xoá từ vựng?"
        confirmLabel="Xoá từ"
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast(`Đã xoá "${deleting.word}"`);
              setDeleting(null);
            },
          })
        }
      >
        Từ <strong>{deleting?.word}</strong> sẽ bị xoá khỏi kho và khỏi mọi bài
        học. Nếu chỉ muốn tạm ẩn khỏi trò chơi, hãy sửa từ và tắt “Đang sử
        dụng”.
      </ConfirmDialog>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="text-xs text-ink/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-lg border-2 border-admin-line bg-white px-2.5 py-2 text-sm text-ink outline-none focus:border-admin-accent"
      >
        <option value="">Tất cả</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
