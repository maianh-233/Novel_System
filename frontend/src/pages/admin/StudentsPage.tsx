import {
  STAGE_LABEL,
  studentBulkCreateSchema,
  type ClassGroupAdmin,
  type StudentCredentials,
} from '@novel/shared';
import { School, Star, UserPlus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CredentialsDialog } from '../../components/admin/CredentialsDialog';
import { useToast } from '../../components/admin/toastContext';
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Modal,
  PageHeader,
  SelectField,
  TextAreaField,
} from '../../components/admin/ui';
import { useClasses, useClassMutations } from '../../hooks/useClassesAdmin';
import { useStudentMutations, useStudents } from '../../hooks/useStudentsAdmin';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/dates';

/** Giá trị bộ lọc lớp: '' = tất cả, NO_CLASS = chưa xếp lớp, còn lại là id lớp. */
const NO_CLASS = 'none';

export function StudentsPage() {
  const { data: students, isPending, error } = useStudents();
  const { data: classes = [] } = useClasses();
  const [params, setParams] = useSearchParams();
  const filter = params.get('class') ?? '';
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [created, setCreated] = useState<StudentCredentials[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const shown = (students ?? []).filter((s) =>
    filter === ''
      ? true
      : filter === NO_CLASS
        ? s.classGroup === null
        : s.classGroup?.id === filter,
  );
  // Chỉ tính các em đang hiện: đổi bộ lọc thì không xếp nhầm em đã chọn ở lớp khác.
  const shownSelected = shown.filter((s) => selected.has(s.id));
  const allShownSelected =
    shown.length > 0 && shownSelected.length === shown.length;

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const s of shown) {
        if (allShownSelected) next.delete(s.id);
        else next.add(s.id);
      }
      return next;
    });

  const setFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('class', value);
    else next.delete('class');
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Học sinh"
        description="Tạo tài khoản cho cả lớp một lần, in phiếu đăng nhập phát cho các em. Chọn nhiều em rồi bấm “Xếp lớp” để chuyển lớp. Bấm vào tên để xem lịch sử chơi."
        actions={
          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => setAdding(true)}
          >
            Thêm học sinh
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-60">
          <SelectField
            label="Lớp"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tất cả học sinh</option>
            <option value={NO_CLASS}>Chưa xếp lớp</option>
            <ClassOptions classes={classes} includeArchived />
          </SelectField>
        </div>
        <Button
          icon={School}
          disabled={shownSelected.length === 0}
          onClick={() => setAssigning(true)}
        >
          Xếp lớp
          {shownSelected.length > 0 ? ` (${shownSelected.length} em)` : ''}
        </Button>
      </div>

      <div className="mt-4">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : students.length === 0 ? (
          <EmptyState icon={Users} title="Chưa có học sinh nào">
            Bấm “Thêm học sinh”, dán danh sách tên cả lớp (mỗi dòng một em) — hệ
            thống tự tạo tên đăng nhập và mật khẩu dễ gõ.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={Users} title="Không có em nào ở đây">
            Chọn lớp khác, hoặc chọn các em ở “Tất cả học sinh” rồi bấm “Xếp
            lớp”.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="w-10 py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả học sinh đang hiện"
                      checked={allShownSelected}
                      onChange={toggleAll}
                      className="size-4 cursor-pointer accent-admin-accent"
                    />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Học sinh</th>
                  <th className="px-4 py-2.5 font-medium">Lớp</th>
                  <th className="px-4 py-2.5 font-medium">Tên đăng nhập</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sao</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Lượt chơi
                  </th>
                  <th className="px-4 py-2.5 font-medium">Chơi gần nhất</th>
                  <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {shown.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'text-ink/50'}>
                    <td className="py-2.5 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${s.displayName}`}
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="size-4 cursor-pointer accent-admin-accent"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/admin/students/${s.id}`}
                        className="font-medium text-admin-accent hover:underline"
                      >
                        {s.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.classGroup ? (
                        <span title={STAGE_LABEL[s.classGroup.stage]}>
                          {s.classGroup.name}
                        </span>
                      ) : (
                        <span className="text-ink/50">Chưa xếp</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono">{s.username}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Star
                          aria-hidden
                          className="size-3.5 fill-sun text-[#b07d00]"
                        />
                        {s.totalStars}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{s.sessionCount}</td>
                    <td className="px-4 py-2.5 text-ink/70">
                      {s.lastPlayedAt
                        ? formatDateTime(s.lastPlayedAt)
                        : 'Chưa chơi'}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.isActive ? (
                        <Badge tone="green">Đang dùng</Badge>
                      ) : (
                        <Badge>Đã khoá</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assigning && (
        <AssignClassDialog
          studentIds={shownSelected.map((s) => s.id)}
          classes={classes}
          onClose={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            setSelected(new Set());
          }}
        />
      )}
      {adding && (
        <AddStudentsDialog
          classes={classes}
          defaultClassId={
            classes.some((c) => c.id === filter && !c.isArchived) ? filter : ''
          }
          onClose={() => setAdding(false)}
          onCreated={(list) => {
            setAdding(false);
            setCreated(list);
          }}
        />
      )}
      {created && (
        <CredentialsDialog
          title={`Đã tạo ${created.length} tài khoản`}
          list={created}
          onClose={() => setCreated(null)}
        />
      )}
    </>
  );
}

/** Các lớp để chọn. Lớp đã lưu trữ chỉ hiện ở bộ lọc (không xếp thêm em vào được). */
function ClassOptions({
  classes,
  includeArchived = false,
}: {
  classes: ClassGroupAdmin[];
  includeArchived?: boolean;
}) {
  return classes
    .filter((c) => includeArchived || !c.isArchived)
    .map((c) => (
      <option key={c.id} value={c.id}>
        {c.name} (khối {c.grade}){c.isArchived ? ' — đã lưu trữ' : ''}
      </option>
    ));
}

function AssignClassDialog({
  studentIds,
  classes,
  onClose,
  onDone,
}: {
  studentIds: string[];
  classes: ClassGroupAdmin[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { assign } = useClassMutations();
  const toast = useToast();
  const active = classes.filter((c) => !c.isArchived);
  const [classId, setClassId] = useState(active[0]?.id ?? NO_CLASS);

  const submit = () =>
    assign.mutate(
      { studentIds, classId: classId === NO_CLASS ? null : classId },
      {
        onSuccess: ({ updated }) => {
          const target = classes.find((c) => c.id === classId);
          toast(
            target
              ? `Đã xếp ${updated} em vào lớp ${target.name}`
              : `Đã bỏ ${updated} em khỏi lớp`,
          );
          onDone();
        },
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Xếp lớp cho ${studentIds.length} em`}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button variant="primary" onClick={submit} loading={assign.isPending}>
            Xếp lớp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {active.length === 0 && (
          <p className="text-ink/70">
            Chưa có lớp nào đang dùng.{' '}
            <Link to="/admin/classes" className="text-admin-accent underline">
              Tạo lớp
            </Link>{' '}
            trước nhé.
          </p>
        )}
        <SelectField
          label="Chuyển vào lớp"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <ClassOptions classes={classes} />
          <option value={NO_CLASS}>Bỏ khỏi lớp (coi như tiểu học)</option>
        </SelectField>
        <p className="text-ink/70">
          Khối của lớp quyết định giao diện, bài học và độ khó game các em thấy.
        </p>
        {assign.error && <ErrorNote>{errorMessage(assign.error)}</ErrorNote>}
      </div>
    </Modal>
  );
}

function AddStudentsDialog({
  classes,
  defaultClassId,
  onClose,
  onCreated,
}: {
  classes: ClassGroupAdmin[];
  defaultClassId: string;
  onClose: () => void;
  onCreated: (list: StudentCredentials[]) => void;
}) {
  const { create } = useStudentMutations();
  const [fieldError, setFieldError] = useState<string>();
  const [classId, setClassId] = useState(defaultClassId);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const names = String(new FormData(e.currentTarget).get('names') ?? '')
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    const parsed = studentBulkCreateSchema.safeParse({ names });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const line =
        typeof issue.path[1] === 'number' ? `Dòng ${issue.path[1] + 1}: ` : '';
      setFieldError(line + issue.message);
      return;
    }
    setFieldError(undefined);
    create.mutate(
      { names: parsed.data.names, classId: classId || null },
      { onSuccess: onCreated },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Thêm học sinh"
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="students-create"
            loading={create.isPending}
          >
            Tạo tài khoản
          </Button>
        </>
      }
    >
      <form
        id="students-create"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <TextAreaField
          label="Tên học sinh — mỗi dòng một em"
          name="names"
          rows={10}
          autoFocus
          placeholder={'Nguyễn Văn An\nLê Thị Ánh\nTrần Minh Khoa'}
          hint="Tối đa 60 em mỗi lần. Chỉ cần tên để gọi — không nhập ngày sinh, số điện thoại hay email."
          error={fieldError}
        />
        <SelectField
          label="Xếp vào lớp"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Chưa xếp lớp</option>
          <ClassOptions classes={classes} />
        </SelectField>
        {create.error && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
      </form>
    </Modal>
  );
}
