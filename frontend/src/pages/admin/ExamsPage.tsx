import { EXAM_MODE_LABEL, examCreateSchema, examState } from '@novel/shared';
import { ClipboardList, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AudienceBadge } from '../../components/admin/AudienceFields';
import { Field } from '../../components/admin/Field';
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Modal,
  PageHeader,
  SelectField,
} from '../../components/admin/ui';
import { useExamMutations, useExams } from '../../hooks/useExamsAdmin';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/dates';

const STATE_LABEL = {
  upcoming: { text: 'Sắp mở', tone: 'amber' },
  open: { text: 'Đang mở', tone: 'green' },
  closed: { text: 'Đã đóng', tone: 'neutral' },
} as const;

export function ExamsPage() {
  const { data: exams, isPending, error } = useExams();
  const [creating, setCreating] = useState(false);
  // Giờ lúc mở trang, để tính Sắp mở / Đang mở / Đã đóng.
  const [now] = useState(() => new Date());

  return (
    <>
      <PageHeader
        title="Đề thi"
        description="Soạn đề từ ngân hàng câu hỏi, đặt giờ mở–đóng. Mọi học sinh có tài khoản đang hoạt động (đúng cấp học của đề) đều làm được khi đề mở. Máy chủ chấm và quy về thang 10."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setCreating(true)}
          >
            Tạo đề
          </Button>
        }
      />
      <div className="mt-6">
        {isPending ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorNote>{errorMessage(error)}</ErrorNote>
        ) : exams.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Chưa có đề nào">
            Tạo đề, chia phần (Phát âm, Ngữ pháp, Đọc hiểu…), chọn câu từ ngân
            hàng rồi bật “Công khai”.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-admin-line text-xs text-ink/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Đề</th>
                  <th className="px-4 py-2.5 font-medium">Chế độ</th>
                  <th className="px-4 py-2.5 font-medium">Thời gian</th>
                  <th className="px-4 py-2.5 font-medium">Giờ mở – đóng</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Lượt làm
                  </th>
                  <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {exams.map((e) => {
                  const st = STATE_LABEL[examState(e, now)];
                  return (
                    <tr key={e.id}>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/admin/exams/${e.id}`}
                          className="font-medium text-admin-accent hover:underline"
                        >
                          {e.title}
                        </Link>
                        <span className="mt-0.5 flex flex-wrap gap-1 text-xs text-ink/60">
                          <AudienceBadge stage={e.stage} grade={e.grade} />
                          {e.questionCount} câu · {e.totalPoints} điểm
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{EXAM_MODE_LABEL[e.mode]}</td>
                      <td className="px-4 py-2.5">{e.durationMin} phút</td>
                      <td className="px-4 py-2.5 text-ink/75">
                        {e.opensAt ? formatDateTime(e.opensAt) : 'Ngay'} –{' '}
                        {e.closesAt ? formatDateTime(e.closesAt) : 'Không đóng'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {e.attemptCount > 0 ? (
                          <Link
                            to={`/admin/exams/${e.id}/results`}
                            className="text-admin-accent hover:underline"
                          >
                            {e.attemptCount}
                          </Link>
                        ) : (
                          0
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.isPublished ? (
                          <Badge tone={st.tone}>{st.text}</Badge>
                        ) : (
                          <Badge>Bản nháp</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && <CreateExamDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateExamDialog({ onClose }: { onClose: () => void }) {
  const { create } = useExamMutations();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = examCreateSchema.safeParse({
      title: form.get('title'),
      mode: form.get('mode'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (exam) => navigate(`/admin/exams/${exam.id}`),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Tạo đề"
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="exam-create"
            loading={create.isPending}
          >
            Tạo và soạn đề
          </Button>
        </>
      }
    >
      <form
        id="exam-create"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <Field
          label="Tên đề"
          name="title"
          placeholder="Kiểm tra 15 phút — Unit 3"
          autoFocus
          error={error}
        />
        <SelectField label="Chế độ" name="mode" defaultValue="exam">
          <option value="exam">
            Thi — xem điểm khi nộp, đáp án sau giờ đóng đề
          </option>
          <option value="practice">Luyện tập — xem đáp án ngay khi nộp</option>
        </SelectField>
        {create.error && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
      </form>
    </Modal>
  );
}
