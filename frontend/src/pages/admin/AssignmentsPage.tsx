import { NotebookPen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { AssignmentDialog } from '../../components/admin/AssignmentDialog';
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  PageHeader,
} from '../../components/admin/ui';
import { useAssignments } from '../../hooks/useAssignmentsAdmin';
import { errorMessage } from '../../services/api';
import { audienceLabel, targetLabel } from '../../utils/assignments';
import { formatDateTime } from '../../utils/dates';

export function AssignmentsPage() {
  const { data, isPending, error } = useAssignments();
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => new Date());

  return (
    <>
      <PageHeader
        title="Bài tập"
        description="Giao một Unit + game (vd: tối thiểu 2 sao) hoặc một đề cho lớp nào đó hoặc cho tất cả, kèm hạn nộp. Tiến độ tính từ lượt chơi và bài thi của các em, không cần chấm tay."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setCreating(true)}
          >
            Giao bài
          </Button>
        }
      />
      <div className="mt-6">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : data.length === 0 ? (
          <EmptyState icon={NotebookPen} title="Chưa giao bài nào">
            Bấm “Giao bài”, chọn Unit + game hoặc đề, chọn lớp và hạn nộp. Các
            em sẽ thấy bài ở trang chủ.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Bài tập</th>
                  <th className="px-4 py-2.5 font-medium">Giao cho</th>
                  <th className="px-4 py-2.5 font-medium">Hạn nộp</th>
                  <th className="px-4 py-2.5 font-medium">Đã xong</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {data.map((a) => {
                  const past = new Date(a.dueAt) < now;
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/admin/assignments/${a.id}`}
                          className="font-medium text-admin-accent hover:underline"
                        >
                          {a.title}
                        </Link>
                        <span className="mt-0.5 block text-xs text-ink/60">
                          {targetLabel(a)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{audienceLabel(a)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {formatDateTime(a.dueAt)}{' '}
                        {past && <Badge>Đã qua hạn</Badge>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Progress done={a.doneCount} total={a.studentCount} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && <AssignmentDialog onClose={() => setCreating(false)} />}
    </>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const p = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-2 w-20 overflow-hidden rounded-full bg-admin-bg">
        <span
          className={`block h-full ${p === 100 ? 'bg-mint' : 'bg-admin-accent'}`}
          style={{ width: `${p}%` }}
        />
      </span>
      <span className="tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}
