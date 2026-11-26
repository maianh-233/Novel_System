import { EXAM_MODE_LABEL, type PlayExam } from '@novel/shared';
import { Clock, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePlayExams, useStartAttempt } from '../../hooks/useStudentExams';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/dates';
import { formatScore } from '../../utils/datetime';

/** Danh sách đề của em: đang mở, sắp mở, đã làm. */
export function ExamsPage() {
  const { data, isPending, error } = usePlayExams();
  const start = useStartAttempt();
  const navigate = useNavigate();

  const open = (examId: string) =>
    start.mutate(examId, {
      onSuccess: (r) =>
        navigate(
          `/exams/attempts/${r.status === 'in_progress' ? r.attempt.id : r.result.id}`,
        ),
    });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="font-display text-3xl font-extrabold">Luyện đề</h1>
      {start.isError && (
        <p role="alert" className="sticker bg-tomato/15 px-4 py-3">
          {errorMessage(start.error)}
        </p>
      )}
      {isPending ? (
        <Loader2
          aria-label="Đang tải"
          className="mx-auto size-8 animate-spin"
        />
      ) : error ? (
        <p className="sticker bg-white p-4">{errorMessage(error)}</p>
      ) : data.length === 0 ? (
        <p className="sticker bg-white p-6 text-center text-ink/70">
          Chưa có đề nào. Khi thầy cô mở đề, đề sẽ hiện ở đây.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((e) => (
            <li key={e.id}>
              <ExamCard
                exam={e}
                busy={start.isPending && start.variables === e.id}
                onOpen={() => open(e.id)}
                onReview={(id) => navigate(`/exams/attempts/${id}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExamCard({
  exam: e,
  busy,
  onOpen,
  onReview,
}: {
  exam: PlayExam;
  busy: boolean;
  onOpen: () => void;
  onReview: (attemptId: string) => void;
}) {
  const attemptsLeft =
    e.maxAttempts === 0 ? Infinity : e.maxAttempts - e.attemptsUsed;
  const canStart =
    e.state === 'open' && (e.inProgressAttemptId !== null || attemptsLeft > 0);

  return (
    <article className="sticker flex flex-col gap-2 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{e.title}</h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${
            e.mode === 'exam' ? 'bg-tomato/20' : 'bg-mint/30'
          }`}
        >
          {EXAM_MODE_LABEL[e.mode]}
        </span>
      </div>
      {e.description && <p className="text-ink/75">{e.description}</p>}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/70">
        <span className="inline-flex items-center gap-1">
          <FileText aria-hidden className="size-4" /> {e.questionCount} câu
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock aria-hidden className="size-4" /> {e.durationMin} phút
        </span>
        {e.closesAt && <span>Đóng lúc {formatDateTime(e.closesAt)}</span>}
        {e.maxAttempts > 0 && (
          <span>
            Đã làm {e.attemptsUsed}/{e.maxAttempts} lần
          </span>
        )}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {e.state === 'upcoming' && e.opensAt && (
          <span className="text-ink/70">
            Mở lúc {formatDateTime(e.opensAt)}
          </span>
        )}
        {canStart && (
          <button
            type="button"
            onClick={onOpen}
            disabled={busy}
            className="sticker pressable inline-flex cursor-pointer items-center gap-2 bg-sky px-4 py-2 font-bold disabled:opacity-60"
          >
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {e.inProgressAttemptId
              ? 'Làm tiếp'
              : e.attemptsUsed > 0
                ? 'Làm lại'
                : 'Bắt đầu'}
          </button>
        )}
        {e.lastAttempt && (
          <button
            type="button"
            onClick={() => onReview(e.lastAttempt!.id)}
            className="sticker pressable cursor-pointer bg-white px-4 py-2 font-bold"
          >
            Xem bài: {formatScore(e.lastAttempt.score)}/10
          </button>
        )}
        {e.state === 'open' && !canStart && (
          <span className="text-ink/70">Em đã làm đủ số lần.</span>
        )}
        {e.state === 'closed' && (
          <span className="text-ink/70">Đề đã đóng.</span>
        )}
      </div>
    </article>
  );
}
