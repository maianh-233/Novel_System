import {
  classCreateSchema,
  GRADES,
  STAGE_LABEL,
  stageOfGrade,
  type ClassGroupAdmin,
} from '@novel/shared';
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  School,
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
  SelectField,
  Toggle,
} from '../../components/admin/ui';
import { useClasses, useClassMutations } from '../../hooks/useClassesAdmin';
import { errorMessage } from '../../services/api';

export function ClassesPage() {
  const { data: classes, isPending, error } = useClasses();
  const m = useClassMutations();
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ClassGroupAdmin | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ClassGroupAdmin | null>(null);

  const archivedCount = classes?.filter((c) => c.isArchived).length ?? 0;
  const shown = classes?.filter((c) => showArchived || !c.isArchived) ?? [];

  const setArchived = (c: ClassGroupAdmin, isArchived: boolean) =>
    m.update.mutate(
      { id: c.id, isArchived },
      {
        onSuccess: () =>
          toast(
            isArchived
              ? `Đã lưu trữ lớp ${c.name}`
              : `Đã dùng lại lớp ${c.name}`,
          ),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );

  return (
    <>
      <PageHeader
        title="Lớp học"
        description="Khối của lớp quyết định cấp học của các em: khối 1–5 là tiểu học, khối 6–9 là cấp 2 (giao diện, độ khó game và bài học khác nhau). Cuối năm lưu trữ lớp cũ thay vì xoá."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setEditing('new')}
          >
            Tạo lớp
          </Button>
        }
      />

      <div className="mt-6 space-y-3">
        {archivedCount > 0 && (
          <label className="inline-flex items-center gap-2 text-ink/75">
            <Toggle
              checked={showArchived}
              onChange={setShowArchived}
              label="Hiện lớp đã lưu trữ"
            />
            Hiện {archivedCount} lớp đã lưu trữ
          </label>
        )}
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : shown.length === 0 ? (
          <EmptyState icon={School} title="Chưa có lớp nào">
            Tạo lớp (vd: 7A, khối 7), rồi xếp học sinh vào lớp ở trang Học sinh.
            Em chưa xếp lớp được coi là học sinh tiểu học.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
            <table className="w-full min-w-[560px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Lớp</th>
                  <th className="px-4 py-2.5 font-medium">Khối</th>
                  <th className="px-4 py-2.5 font-medium">Cấp học</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Học sinh
                  </th>
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {shown.map((c) => (
                  <tr key={c.id} className={c.isArchived ? 'text-ink/50' : ''}>
                    <td className="px-4 py-2.5 font-medium">
                      {c.name} {c.isArchived && <Badge>Đã lưu trữ</Badge>}
                    </td>
                    <td className="px-4 py-2.5">{c.grade}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        tone={c.stage === 'secondary' ? 'blue' : 'neutral'}
                      >
                        {STAGE_LABEL[c.stage]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/admin/students?class=${c.id}`}
                        className="text-admin-accent hover:underline"
                      >
                        {c.studentCount} em
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          icon={Pencil}
                          label={`Sửa lớp ${c.name}`}
                          onClick={() => setEditing(c)}
                        />
                        <IconButton
                          icon={c.isArchived ? ArchiveRestore : Archive}
                          label={
                            c.isArchived
                              ? `Dùng lại lớp ${c.name}`
                              : `Lưu trữ lớp ${c.name}`
                          }
                          disabled={m.update.isPending}
                          onClick={() => setArchived(c, !c.isArchived)}
                        />
                        <IconButton
                          icon={Trash2}
                          label={`Xoá lớp ${c.name}`}
                          onClick={() => {
                            m.remove.reset();
                            setDeleting(c);
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
      </div>

      {editing && (
        <ClassDialog
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Xoá lớp?"
        confirmLabel="Xoá lớp"
        loading={m.remove.isPending}
        error={m.remove.error ? errorMessage(m.remove.error) : null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          m.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast(`Đã xoá lớp ${deleting.name}`);
              setDeleting(null);
            },
          })
        }
      >
        Chỉ xoá được lớp chưa có học sinh. Lớp đã có em thì nên{' '}
        <strong>lưu trữ</strong> để giữ thông tin lớp.
      </ConfirmDialog>
    </>
  );
}

function ClassDialog({
  initial,
  onClose,
}: {
  initial: ClassGroupAdmin | null;
  onClose: () => void;
}) {
  const { create, update } = useClassMutations();
  const toast = useToast();
  const [grade, setGrade] = useState(initial?.grade ?? 6);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = initial ? update : create;
  const stageChanges =
    initial !== null &&
    initial.studentCount > 0 &&
    stageOfGrade(grade) !== initial.stage;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = classCreateSchema.safeParse({
      name: new FormData(e.currentTarget).get('name'),
      grade,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues)
        errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    const done = () => {
      toast(initial ? 'Đã lưu lớp' : `Đã tạo lớp ${parsed.data.name}`);
      onClose();
    };
    if (initial)
      update.mutate({ id: initial.id, ...parsed.data }, { onSuccess: done });
    else create.mutate(parsed.data, { onSuccess: done });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Sửa lớp ${initial.name}` : 'Tạo lớp'}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="class-form"
            loading={mutation.isPending}
          >
            {initial ? 'Lưu' : 'Tạo lớp'}
          </Button>
        </>
      }
    >
      <form
        id="class-form"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <Field
          label="Tên lớp"
          name="name"
          defaultValue={initial?.name}
          placeholder="7A"
          autoFocus
          error={errors.name}
        />
        <SelectField
          label="Khối"
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          error={errors.grade}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              Khối {g} — {STAGE_LABEL[stageOfGrade(g)]}
            </option>
          ))}
        </SelectField>
        {stageChanges && (
          <p className="rounded-lg bg-sun/25 px-3 py-2 text-[#5c4100]">
            Đổi sang {STAGE_LABEL[stageOfGrade(grade)].toLowerCase()}:{' '}
            {initial.studentCount} em trong lớp sẽ thấy giao diện, bài học và độ
            khó game của cấp học mới.
          </p>
        )}
        {mutation.error && (
          <ErrorNote>{errorMessage(mutation.error)}</ErrorNote>
        )}
      </form>
    </Modal>
  );
}
