import {
  ASSIGNMENT_STATUS_LABEL,
  type AssignmentDetail,
  type AssignmentStatus,
} from '@novel/shared';
import { ArrowLeft, Copy, Pencil, Star, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AssignmentDialog } from '../../components/admin/AssignmentDialog';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  PageHeader,
} from '../../components/admin/ui';
import {
  useAssignment,
  useAssignmentMutations,
} from '../../hooks/useAssignmentsAdmin';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/dates';
import { formatScore } from '../../utils/datetime';
import { audienceLabel, targetLabel } from '../../utils/assignments';
import { Progress } from './AssignmentsPage';

const STATUS_TONE: Record<
  AssignmentStatus,
  'neutral' | 'green' | 'amber' | 'red'
> = {
  todo: 'neutral',
  done: 'green',
  late: 'amber',
  overdue: 'red',
};

export function AssignmentDetailPage() {
  const { id = '' } = useParams();
  const { data, isPending, error } = useAssignment(id);
  if (isPending) return <LoadingBlock />;
  if (error) return <ErrorNote>{errorMessage(error)}</ErrorNote>;
  return <Detail data={data} />;
}

function Detail({ data }: { data: AssignmentDetail }) {
  const navigate = useNavigate();
  const { remove } = useAssignmentMutations();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [classId, setClassId] = useState('');
  const [copied, setCopied] = useState(false);

  const classes = [
    ...new Map(
      data.rows
        .filter((r) => r.student.classId)
        .map((r) => [r.student.classId!, r.student.className!]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  const rows = classId
    ? data.rows.filter((r) => r.student.classId === classId)
    : data.rows;
  const notDone = rows.filter(
    (r) => r.status === 'todo' || r.status === 'overdue',
  );
  const isExam = data.target.kind === 'exam';

  // Dán vào nhóm Zalo / tin nhắn phụ huynh: "7A: An, Bình".
  const copyNotDone = async () => {
    const byClass = new Map<string, string[]>();
    for (const r of notDone) {
      const k = r.student.className ?? 'Chưa xếp lớp';
      byClass.set(k, [...(byClass.get(k) ?? []), r.student.displayName]);
    }
    const text = [...byClass]
      .map(([cls, names]) => `${cls}: ${names.join(', ')}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/assignments"
        className="inline-flex items-center gap-1.5 text-ink/70 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Bài tập
      </Link>
      <PageHeader
        title={data.title}
        description={`${targetLabel(data)} · Giao cho: ${audienceLabel(data)}`}
        actions={
          <>
            <Button icon={Pencil} onClick={() => setEditing(true)}>
              Sửa
            </Button>
            <Button
              icon={Trash2}
              variant="ghost"
              onClick={() => setDeleting(true)}
            >
              Xoá
            </Button>
          </>
        }
      />
      {data.note && (
        <p className="rounded-lg border border-admin-line bg-white px-4 py-3 text-ink/80">
          {data.note}
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ['Giao lúc', formatDateTime(data.assignedAt)],
          ['Hạn nộp', formatDateTime(data.dueAt)],
          [
            'Đã xong',
            <Progress
              key="p"
              done={data.doneCount}
              total={data.studentCount}
            />,
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-admin-line bg-white px-4 py-3"
          >
            <dt className="text-xs text-ink/60">{label}</dt>
            <dd className="mt-1 text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {data.rows.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có học sinh nào được giao">
          Lớp được chọn chưa có em nào có tài khoản đang hoạt động.
        </EmptyState>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {classes.length > 1 && (
              <select
                aria-label="Lọc theo lớp"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="rounded-lg border-2 border-admin-line bg-white px-3 py-1.5"
              >
                <option value="">Mọi lớp</option>
                {classes.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <span className="text-ink/70">
              {notDone.length === 0
                ? 'Em nào cũng đã làm xong.'
                : `${notDone.length} em chưa làm xong`}
            </span>
            {notDone.length > 0 && (
              <Button icon={Copy} onClick={() => void copyNotDone()}>
                {copied ? 'Đã sao chép' : 'Sao chép tên em chưa làm'}
              </Button>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
            <table className="w-full min-w-[640px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Học sinh</th>
                  <th className="px-4 py-2.5 font-medium">Lớp</th>
                  <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                  <th className="px-4 py-2.5 font-medium">
                    {isExam ? 'Điểm cao nhất' : 'Sao cao nhất'}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {isExam ? 'Lượt nộp' : 'Lượt chơi'}
                  </th>
                  <th className="px-4 py-2.5 font-medium">Xong lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {rows.map((r) => (
                  <tr key={r.student.id}>
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/admin/students/${r.student.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.student.displayName}
                      </Link>
                      <span className="block text-xs text-ink/55">
                        {r.student.username}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.student.className ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[r.status]}>
                        {ASSIGNMENT_STATUS_LABEL[r.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.best === null ? (
                        <span className="text-ink/45">—</span>
                      ) : isExam ? (
                        `${formatScore(r.best)}/10`
                      ) : (
                        <StarCount n={r.best} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.tries}
                    </td>
                    <td className="px-4 py-2.5 text-ink/75">
                      {r.doneAt ? formatDateTime(r.doneAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <AssignmentDialog editing={data} onClose={() => setEditing(false)} />
      )}
      <ConfirmDialog
        open={deleting}
        title="Xoá bài tập?"
        confirmLabel="Xoá"
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => navigate('/admin/assignments'),
          })
        }
      >
        Các em sẽ không thấy bài này nữa. Lượt chơi và bài thi của các em vẫn
        được giữ nguyên.
      </ConfirmDialog>
    </div>
  );
}

function StarCount({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} sao`}>
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`size-4 ${i <= n ? 'fill-sun text-[#b98900]' : 'text-ink/20'}`}
        />
      ))}
    </span>
  );
}
