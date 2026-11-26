import { categoryCreateSchema, type CategoryAdmin } from '@novel/shared';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Shapes,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Field } from '../../components/admin/Field';
import { useToast } from '../../components/admin/toastContext';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  IconButton,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../../components/admin/ui';
import {
  useCategories,
  useCategoryMutations,
} from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';

export function CategoriesPage() {
  const { data: categories, isPending, error } = useCategories();
  const m = useCategoryMutations();
  const toast = useToast();
  const [editing, setEditing] = useState<CategoryAdmin | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CategoryAdmin | null>(null);

  const move = (index: number, delta: -1 | 1) => {
    if (!categories) return;
    const ids = categories.map((c) => c.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    m.reorder.mutate(ids, {
      onError: (e) => toast(errorMessage(e), 'error'),
    });
  };

  const toggleHidden = (c: CategoryAdmin) =>
    m.update.mutate(
      { id: c.id, isHidden: !c.isHidden },
      {
        onSuccess: () =>
          toast(c.isHidden ? `Đã hiện "${c.name}"` : `Đã ẩn "${c.name}"`),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );

  return (
    <>
      <PageHeader
        title="Chủ đề"
        description="Thứ tự ở đây cũng là thứ tự học sinh nhìn thấy. Chủ đề bị ẩn vẫn giữ nguyên từ vựng."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setEditing('new')}
          >
            Thêm chủ đề
          </Button>
        }
      />

      <div className="mt-6">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : categories.length === 0 ? (
          <EmptyState icon={Shapes} title="Chưa có chủ đề nào">
            Tạo chủ đề đầu tiên, ví dụ "Animals" hay "Colors".
          </EmptyState>
        ) : (
          <ul className="divide-y divide-admin-line overflow-hidden rounded-xl border border-admin-line bg-white">
            {categories.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
              >
                <div className="flex flex-col">
                  <IconButton
                    icon={ArrowUp}
                    label={`Đưa "${c.name}" lên trên`}
                    disabled={i === 0 || m.reorder.isPending}
                    onClick={() => move(i, -1)}
                    className="size-6!"
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={`Đưa "${c.name}" xuống dưới`}
                    disabled={
                      i === categories.length - 1 || m.reorder.isPending
                    }
                    onClick={() => move(i, 1)}
                    className="size-6!"
                  />
                </div>
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-admin-bg text-xl"
                >
                  {c.icon ?? '📁'}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${c.isHidden ? 'text-ink/50' : ''}`}
                  >
                    {c.name}
                  </p>
                  <Link
                    to={`/admin/vocabulary?categoryId=${c.id}`}
                    className="text-xs text-admin-accent hover:underline"
                  >
                    {c.wordCount} từ vựng
                  </Link>
                </div>
                {c.isHidden && <Badge>Đang ẩn</Badge>}
                <div className="flex items-center gap-0.5">
                  <IconButton
                    icon={c.isHidden ? Eye : EyeOff}
                    label={
                      c.isHidden
                        ? `Hiện "${c.name}" cho học sinh`
                        : `Ẩn "${c.name}" khỏi học sinh`
                    }
                    onClick={() => toggleHidden(c)}
                  />
                  <IconButton
                    icon={Pencil}
                    label={`Sửa "${c.name}"`}
                    onClick={() => setEditing(c)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={`Xoá "${c.name}"`}
                    onClick={() => {
                      m.remove.reset();
                      setDeleting(c);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Xoá chủ đề?"
        confirmLabel="Xoá chủ đề"
        loading={m.remove.isPending}
        error={m.remove.error ? errorMessage(m.remove.error) : null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          m.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast(`Đã xoá "${deleting.name}"`);
              setDeleting(null);
            },
          })
        }
      >
        Chủ đề <strong>{deleting?.name}</strong> sẽ bị xoá hẳn. Chỉ xoá được chủ
        đề chưa có từ vựng nào.
      </ConfirmDialog>
    </>
  );
}

function CategoryDialog({
  category,
  onClose,
}: {
  category: CategoryAdmin | null;
  onClose: () => void;
}) {
  const m = useCategoryMutations();
  const toast = useToast();
  const [nameError, setNameError] = useState<string>();
  const mutation = category ? m.update : m.create;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = categoryCreateSchema.safeParse({
      name: form.get('name'),
      icon: form.get('icon'),
    });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0].message);
      return;
    }
    setNameError(undefined);
    const done = () => {
      toast(category ? 'Đã lưu chủ đề' : `Đã thêm "${parsed.data.name}"`);
      onClose();
    };
    if (category)
      m.update.mutate({ id: category.id, ...parsed.data }, { onSuccess: done });
    else m.create.mutate(parsed.data, { onSuccess: done });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Sửa chủ đề' : 'Thêm chủ đề'}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="category-form"
            loading={mutation.isPending}
          >
            {category ? 'Lưu' : 'Thêm chủ đề'}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <div className="grid grid-cols-[5.5rem_1fr] gap-3">
          <Field
            label="Biểu tượng"
            name="icon"
            defaultValue={category?.icon ?? ''}
            placeholder="🐶"
            maxLength={16}
            hint="Một emoji"
          />
          <Field
            label="Tên chủ đề"
            name="name"
            defaultValue={category?.name ?? ''}
            placeholder="Animals"
            autoFocus
            error={nameError}
          />
        </div>
        {mutation.error && (
          <ErrorNote>{errorMessage(mutation.error)}</ErrorNote>
        )}
      </form>
    </Modal>
  );
}
