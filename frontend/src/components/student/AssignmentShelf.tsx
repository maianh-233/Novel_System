import { ASSIGNMENT_STATUS_LABEL, type PlayAssignment } from '@novel/shared';
import { Check, Loader2, NotebookPen, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePlayAssignments } from '../../hooks/useStudentAssignments';
import { useStartAttempt } from '../../hooks/useStudentExams';
import { useStudentMe } from '../../hooks/useStudentSession';
import { errorMessage } from '../../services/api';
import { formatScore } from '../../utils/datetime';
import { formatDue, isDueSoon } from '../../utils/due';

const STATUS_BG: Record<PlayAssignment['status'], string> = {
  todo: 'bg-white',
  overdue: 'bg-tomato/25',
  late: 'bg-sun/40',
  done: 'bg-mint/40',
};

/** Trang chủ: bài thầy cô giao, quá hạn và hạn gần lên trước, bài đã xong để cuối. */
export function AssignmentShelf() {
  const { data: me } = useStudentMe();
  const { data } = usePlayAssignments(!!me);
  const [showDone, setShowDone] = useState(false);
  const start = useStartAttempt();
  const navigate = useNavigate();
  if (!me || !data || data.length === 0) return null;

  const pending = data.filter(
    (a) => a.status === 'todo' || a.status === 'overdue',
  );
  const finished = data.filter(
    (a) => a.status === 'done' || a.status === 'late',
  );
  const shown = showDone ? data : pending;

  const openExam = (examId: string) =>
    start.mutate(examId, {
      onSuccess: (r) =>
        navigate(
          `/exams/attempts/${r.status === 'in_progress' ? r.attempt.id : r.result.id}`,
        ),
    });

  return (
    <section aria-labelledby="assignments-heading">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="sticker grid size-14 shrink-0 place-items-center bg-sun"
        >
          <NotebookPen className="size-7" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <h2
            id="assignments-heading"
            className="font-display text-3xl leading-tight font-extrabold"
          >
            Bài được giao
          </h2>
          <p className="text-ink/70">
            {pending.length > 0
              ? `${pending.length} bài cần làm`
              : 'Em đã làm xong hết rồi!'}
          </p>
        </div>
      </div>

      {start.isError && (
        <p role="alert" className="sticker mt-4 bg-tomato/15 px-4 py-3">
          {errorMessage(start.error)}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {shown.map((a) => (
            <li key={a.id}>
              <AssignmentCard
                a={a}
                busy={
                  start.isPending &&
                  a.open?.kind === 'exam' &&
                  start.variables === a.open.examId
                }
                onExam={openExam}
              />
            </li>
          ))}
        </ul>
      )}

      {finished.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="mt-3 cursor-pointer text-ink/70 underline underline-offset-4"
        >
          {showDone ? 'Ẩn bài đã xong' : `Xem ${finished.length} bài đã xong`}
        </button>
      )}
    </section>
  );
}

function AssignmentCard({
  a,
  busy,
  onExam,
}: {
  a: PlayAssignment;
  busy: boolean;
  onExam: (examId: string) => void;
}) {
  const { target: t, open } = a;
  const done = a.status === 'done' || a.status === 'late';
  const soon = a.status === 'todo' && isDueSoon(a.dueAt);
  const what =
    t.kind === 'exam'
      ? `Làm đề: ${t.exam.title}`
      : `${t.game.name} · ${t.lesson.title} · đạt ${t.minStars} sao`;
  const action = done
    ? 'Làm lại'
    : a.status === 'overdue'
      ? 'Làm ngay'
      : 'Làm bài';
  const buttonClass =
    'sticker pressable inline-flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 font-bold disabled:opacity-60';

  return (
    <article
      className={`sticker flex h-full flex-col gap-2 p-4 ${STATUS_BG[a.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl leading-tight font-bold">
          {a.title}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-sm font-bold">
          {done && <Check aria-hidden className="size-4" strokeWidth={3} />}
          {ASSIGNMENT_STATUS_LABEL[a.status]}
        </span>
      </div>
      <p className="text-ink/75">{what}</p>
      {a.note && <p className="text-ink/75 italic">“{a.note}”</p>}
      <p
        className={`text-sm ${soon || a.status === 'overdue' ? 'font-bold' : 'text-ink/70'}`}
      >
        Hạn: {formatDue(a.dueAt)}
        {a.best !== null && (
          <span className="ml-3 inline-flex items-center gap-1 font-normal text-ink/70">
            {t.kind === 'exam' ? (
              `Điểm cao nhất: ${formatScore(a.best)}/10`
            ) : (
              <>
                Sao cao nhất: {a.best}
                <Star aria-hidden className="size-4 fill-sun" />
              </>
            )}
          </span>
        )}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {open?.kind === 'lesson_game' && (
          <Link
            to={`/play/${open.gameSlug}?lesson=${open.lessonId}`}
            className={`${buttonClass} bg-sky`}
          >
            {action}
          </Link>
        )}
        {open?.kind === 'exam' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onExam(open.examId)}
            className={`${buttonClass} bg-sky`}
          >
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {action}
          </button>
        )}
        {a.attemptId && (
          <Link
            to={`/exams/attempts/${a.attemptId}`}
            className={`${buttonClass} bg-white`}
          >
            Xem bài
          </Link>
        )}
        {!open && a.unavailable && (
          <span className="text-ink/70">{a.unavailable}</span>
        )}
      </div>
    </article>
  );
}
