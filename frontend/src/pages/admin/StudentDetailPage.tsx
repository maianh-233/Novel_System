import {
  studentUpdateSchema,
  type StudentCredentials,
  type StudentDetail,
} from '@novel/shared';
import {
  ArrowLeft,
  Gamepad2,
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CredentialsDialog } from '../../components/admin/CredentialsDialog';
import { Field } from '../../components/admin/Field';
import { useToast } from '../../components/admin/toastContext';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Modal,
} from '../../components/admin/ui';
import { useStudent, useStudentMutations } from '../../hooks/useStudentsAdmin';
import { errorMessage } from '../../services/api';
import { formatDateTime, formatDuration } from '../../utils/dates';

type Dialog = 'rename' | 'reset' | 'toggle' | 'delete' | null;

export function StudentDetailPage() {
  const { id = '' } = useParams();
  const { data: s, isPending, error, refetch } = useStudent(id);

  return (
    <>
      <Link
        to="/admin/students"
        className="inline-flex items-center gap-1.5 text-ink/70 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Danh sách học sinh
      </Link>
      <div className="mt-3">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : (
          <Detail student={s} onChanged={() => void refetch()} />
        )}
      </div>
    </>
  );
}

function Detail({
  student: s,
  onChanged,
}: {
  student: StudentDetail;
  onChanged: () => void;
}) {
  const { update, resetPassword, remove } = useStudentMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [credentials, setCredentials] = useState<StudentCredentials | null>(
    null,
  );
  const close = () => setDialog(null);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{s.displayName}</h1>
            {s.isActive ? (
              <Badge tone="green">Đang dùng</Badge>
            ) : (
              <Badge>Đã khoá</Badge>
            )}
          </div>
          <p className="mt-1 text-ink/70">
            Tên đăng nhập: <span className="font-mono">{s.username}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Pencil} onClick={() => setDialog('rename')}>
            Đổi tên
          </Button>
          <Button icon={KeyRound} onClick={() => setDialog('reset')}>
            Đặt lại mật khẩu
          </Button>
          <Button
            icon={s.isActive ? Lock : LockOpen}
            onClick={() => setDialog('toggle')}
          >
            {s.isActive ? 'Khoá' : 'Mở khoá'}
          </Button>
          {s.sessionCount === 0 && (
            <Button icon={Trash2} onClick={() => setDialog('delete')}>
              Xoá
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Tổng số sao">
          <span className="inline-flex items-center gap-1.5">
            <Star aria-hidden className="size-5 fill-sun text-[#b07d00]" />
            {s.totalStars}
          </span>
        </Stat>
        <Stat label="Lượt chơi">{s.sessionCount}</Stat>
        <Stat label="Chơi gần nhất">
          {s.lastPlayedAt ? formatDateTime(s.lastPlayedAt) : 'Chưa chơi'}
        </Stat>
      </dl>

      <h2 className="mt-8 text-base font-semibold">Lịch sử chơi</h2>
      <div className="mt-3">
        {s.sessions.length === 0 ? (
          <EmptyState icon={Gamepad2} title="Em chưa chơi lượt nào" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
            <table className="w-full min-w-[640px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Thời gian</th>
                  <th className="px-4 py-2.5 font-medium">Trò chơi</th>
                  <th className="px-4 py-2.5 font-medium">Bài học</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Đúng / Sai
                  </th>
                  <th className="px-4 py-2.5 font-medium">Sao</th>
                  <th className="px-4 py-2.5 font-medium">Thời lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {s.sessions.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 text-ink/70">
                      {formatDateTime(p.finishedAt)}
                    </td>
                    <td className="px-4 py-2.5">{p.gameName}</td>
                    <td className="px-4 py-2.5">{p.lessonTitle}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[#13734c]">{p.correctCount}</span>
                      {' / '}
                      <span className="text-[#b42318]">{p.wrongCount}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex"
                        role="img"
                        aria-label={`${p.stars} sao`}
                      >
                        {[0, 1, 2].map((i) => (
                          <Star
                            key={i}
                            aria-hidden
                            className={`size-4 ${i < p.stars ? 'fill-sun text-[#b07d00]' : 'text-ink/20'}`}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink/70">
                      {formatDuration(p.durationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog === 'rename' && (
        <RenameDialog
          student={s}
          onClose={close}
          onDone={() => {
            close();
            onChanged();
            toast('Đã đổi tên');
          }}
        />
      )}

      <ConfirmDialog
        open={dialog === 'reset'}
        title="Đặt lại mật khẩu?"
        confirmLabel="Đặt lại"
        loading={resetPassword.isPending}
        error={resetPassword.error && errorMessage(resetPassword.error)}
        onClose={close}
        onConfirm={() =>
          resetPassword.mutate(s.id, {
            onSuccess: (c) => {
              close();
              setCredentials(c);
            },
          })
        }
      >
        Hệ thống tạo mật khẩu mới cho <strong>{s.displayName}</strong>. Mật khẩu
        cũ hết dùng được và em sẽ bị đăng xuất trên mọi máy.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'toggle'}
        title={s.isActive ? 'Khoá tài khoản?' : 'Mở khoá tài khoản?'}
        confirmLabel={s.isActive ? 'Khoá' : 'Mở khoá'}
        loading={update.isPending}
        error={update.error && errorMessage(update.error)}
        onClose={close}
        onConfirm={() =>
          update.mutate(
            { id: s.id, isActive: !s.isActive },
            {
              onSuccess: () => {
                close();
                onChanged();
                toast(s.isActive ? 'Đã khoá tài khoản' : 'Đã mở khoá');
              },
            },
          )
        }
      >
        {s.isActive
          ? 'Em sẽ bị đăng xuất và không đăng nhập được nữa. Lịch sử chơi và số sao vẫn được giữ.'
          : 'Em đăng nhập lại được bằng mật khẩu hiện tại.'}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        title="Xoá tài khoản?"
        confirmLabel="Xoá"
        loading={remove.isPending}
        error={remove.error && errorMessage(remove.error)}
        onClose={close}
        onConfirm={() =>
          remove.mutate(s.id, {
            onSuccess: () => {
              toast('Đã xoá tài khoản');
              navigate('/admin/students', { replace: true });
            },
          })
        }
      >
        Xoá hẳn tài khoản <strong>{s.displayName}</strong>. Em chưa chơi lượt
        nào nên không mất lịch sử học tập.
      </ConfirmDialog>

      {credentials && (
        <CredentialsDialog
          title="Mật khẩu mới"
          list={[credentials]}
          onClose={() => setCredentials(null)}
        />
      )}
    </>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-admin-line bg-white px-4 py-3">
      <dt className="text-xs text-ink/60">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{children}</dd>
    </div>
  );
}

function RenameDialog({
  student,
  onClose,
  onDone,
}: {
  student: StudentDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const { update } = useStudentMutations();
  const [fieldError, setFieldError] = useState<string>();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = studentUpdateSchema.safeParse({
      displayName: new FormData(e.currentTarget).get('displayName'),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0].message);
      return;
    }
    update.mutate({ id: student.id, ...parsed.data }, { onSuccess: onDone });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Đổi tên học sinh"
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="student-rename"
            loading={update.isPending}
          >
            Lưu
          </Button>
        </>
      }
    >
      <form
        id="student-rename"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <Field
          label="Tên hiển thị"
          name="displayName"
          defaultValue={student.displayName}
          autoFocus
          hint="Tên đăng nhập giữ nguyên."
          error={fieldError}
        />
        {update.error && <ErrorNote>{errorMessage(update.error)}</ErrorNote>}
      </form>
    </Modal>
  );
}
