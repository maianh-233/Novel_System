import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router';
import { usePlayExams } from '../../hooks/useStudentExams';
import { useStudentMe } from '../../hooks/useStudentSession';

/** Trang chủ: có đề đang mở / sắp mở thì hiện lối vào "Luyện đề". */
export function ExamShelf() {
  const { data: me } = useStudentMe();
  const { data: exams } = usePlayExams(!!me);
  const open = exams?.filter((e) => e.state === 'open') ?? [];
  const upcoming = exams?.filter((e) => e.state === 'upcoming') ?? [];
  if (!me || open.length + upcoming.length === 0) return null;

  const inProgress = open.filter((e) => e.inProgressAttemptId).length;
  return (
    <Link
      to="/exams"
      className="sticker pressable flex items-center gap-4 bg-white p-4"
    >
      <span
        aria-hidden
        className="sticker grid size-14 shrink-0 place-items-center bg-violet"
      >
        <ClipboardList className="size-7" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl font-extrabold">
          Luyện đề
        </span>
        <span className="block text-ink/75">
          {open.length > 0
            ? `${open.length} đề đang mở${inProgress ? ` · ${inProgress} bài đang làm dở` : ''}`
            : `${upcoming.length} đề sắp mở`}
        </span>
      </span>
    </Link>
  );
}
