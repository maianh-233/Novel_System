import {
  studentBulkCreateSchema,
  type StudentCredentials,
} from '@novel/shared';
import { Star, UserPlus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CredentialsDialog } from '../../components/admin/CredentialsDialog';
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Modal,
  PageHeader,
  TextAreaField,
} from '../../components/admin/ui';
import { useStudentMutations, useStudents } from '../../hooks/useStudentsAdmin';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/dates';

export function StudentsPage() {
  const { data: students, isPending, error } = useStudents();
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<StudentCredentials[] | null>(null);

  return (
    <>
      <PageHeader
        title="Học sinh"
        description="Tạo tài khoản cho cả lớp một lần, in phiếu đăng nhập phát cho các em. Bấm vào tên để xem lịch sử chơi."
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

      <div className="mt-6">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : students.length === 0 ? (
          <EmptyState icon={Users} title="Chưa có học sinh nào">
            Bấm “Thêm học sinh”, dán danh sách tên cả lớp (mỗi dòng một em) — hệ
            thống tự tạo tên đăng nhập và mật khẩu dễ gõ.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
            <table className="w-full min-w-[640px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Học sinh</th>
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
                {students.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'text-ink/50'}>
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/admin/students/${s.id}`}
                        className="font-medium text-admin-accent hover:underline"
                      >
                        {s.displayName}
                      </Link>
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

      {adding && (
        <AddStudentsDialog
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

function AddStudentsDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (list: StudentCredentials[]) => void;
}) {
  const { create } = useStudentMutations();
  const [fieldError, setFieldError] = useState<string>();

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
    create.mutate(parsed.data.names, { onSuccess: onCreated });
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
        {create.error && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
      </form>
    </Modal>
  );
}
