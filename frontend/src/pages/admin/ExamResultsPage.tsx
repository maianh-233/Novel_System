import { QUESTION_TYPE_INFO, type ExamResults } from '@novel/shared';
import { ArrowLeft, Download, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  PageHeader,
} from '../../components/admin/ui';
import { useExamResults } from '../../hooks/useExamsAdmin';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/dates';
import { formatScore } from '../../utils/datetime';
import { downloadText, examResultsCsv } from '../../utils/examCsv';

const pct = (correct: number, answered: number) =>
  answered ? Math.round((correct / answered) * 100) : null;

/** Thanh tỉ lệ đúng: đỏ dưới 50%, vàng dưới 75%, xanh từ 75%. */
function RateBar({ correct, answered }: { correct: number; answered: number }) {
  const p = pct(correct, answered);
  if (p === null) return <span className="text-ink/45">—</span>;
  const color = p < 50 ? 'bg-tomato' : p < 75 ? 'bg-sun' : 'bg-mint';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-24 overflow-hidden rounded-full bg-admin-bg">
        <span className={`block h-full ${color}`} style={{ width: `${p}%` }} />
      </span>
      <span className="w-10 text-right tabular-nums">{p}%</span>
    </span>
  );
}

export function ExamResultsPage() {
  const { id = '' } = useParams();
  const { data, isPending, error } = useExamResults(id);
  const [classId, setClassId] = useState('');

  if (isPending) return <LoadingBlock />;
  if (error) return <ErrorNote>{errorMessage(error)}</ErrorNote>;
  return <Results data={data} classId={classId} setClassId={setClassId} />;
}

function Results({
  data,
  classId,
  setClassId,
}: {
  data: ExamResults;
  classId: string;
  setClassId: (v: string) => void;
}) {
  const classes = [
    ...new Map(
      data.rows
        .filter((r) => r.student.classId)
        .map((r) => [r.student.classId!, r.student.className!]),
    ),
  ];
  const rows = classId
    ? data.rows.filter((r) => r.student.classId === classId)
    : data.rows;
  const scores = rows.flatMap((r) => (r.score === null ? [] : [r.score]));
  const avg = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
  const hardest = [...data.items]
    .filter((i) => i.answered > 0)
    .sort((a, b) => a.correct / a.answered - b.correct / b.answered)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Link
        to={`/admin/exams/${data.exam.id}`}
        className="inline-flex items-center gap-1.5 text-ink/70 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Về đề
      </Link>
      <PageHeader
        title={`Kết quả: ${data.exam.title}`}
        description="Mỗi em lấy lượt nộp gần nhất. Bài quá giờ chưa nộp được máy tự nộp những câu em đã lưu. Tự làm mới mỗi 30 giây."
        actions={
          <Button
            icon={Download}
            disabled={data.rows.length === 0}
            onClick={() =>
              downloadText(
                `ket-qua-${data.exam.title.replace(/[^\p{L}\p{N}]+/gu, '-')}.csv`,
                examResultsCsv(data, formatDateTime),
              )
            }
          >
            Xuất CSV
          </Button>
        }
      />

      {data.rows.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có em nào làm đề này" />
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ['Đã nộp', `${scores.length}/${rows.length} em`],
              [
                'Điểm trung bình',
                avg === null ? '—' : formatScore(Math.round(avg * 100) / 100),
              ],
              [
                'Cao nhất',
                scores.length ? formatScore(Math.max(...scores)) : '—',
              ],
              [
                'Thấp nhất',
                scores.length ? formatScore(Math.min(...scores)) : '—',
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-admin-line bg-white px-4 py-3"
              >
                <dt className="text-xs text-ink/60">{k}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="scores" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="scores" className="font-semibold">
                Bảng điểm
              </h2>
              {classes.length > 0 && (
                <select
                  aria-label="Lọc theo lớp"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="rounded-lg border-2 border-admin-line bg-white px-2.5 py-1.5"
                >
                  <option value="">Mọi lớp</option>
                  {classes.map(([cid, name]) => (
                    <option key={cid} value={cid}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
              <table className="w-full min-w-[640px] text-left">
                <thead className="border-b border-admin-line text-xs text-ink/60">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Học sinh</th>
                    <th className="px-4 py-2.5 font-medium">Lớp</th>
                    <th className="px-4 py-2.5 text-right font-medium">Điểm</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Câu đúng
                    </th>
                    <th className="px-4 py-2.5 font-medium">Nộp lúc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-line">
                  {rows.map((r) => (
                    <tr key={r.attemptId}>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/admin/students/${r.student.id}`}
                          className="font-medium text-admin-accent hover:underline"
                        >
                          {r.student.displayName}
                        </Link>
                        {r.attemptCount > 1 && (
                          <span className="ml-1 text-xs text-ink/55">
                            ({r.attemptCount} lần)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.student.className ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {r.score === null ? '—' : formatScore(r.score)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {r.submittedAt
                          ? `${r.correctCount}/${data.questionCount}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {!r.submittedAt ? (
                          <Badge tone="blue">Đang làm</Badge>
                        ) : (
                          <>
                            {formatDateTime(r.submittedAt)}{' '}
                            {r.autoSubmitted && (
                              <Badge tone="amber">Máy tự nộp</Badge>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-admin-line bg-white p-4">
              <h2 className="font-semibold">Câu cả lớp hay sai nhất</h2>
              <ol className="mt-2 space-y-2">
                {hardest.map((i) => (
                  <li key={i.itemId}>
                    <p className="truncate" title={i.prompt}>
                      <span className="text-ink/50">Câu {i.number}.</span>{' '}
                      {i.prompt}
                    </p>
                    <RateBar correct={i.correct} answered={i.answered} />
                  </li>
                ))}
                {hardest.length === 0 && (
                  <li className="text-ink/60">Chưa có bài nộp.</li>
                )}
              </ol>
            </section>
            <section className="rounded-xl border border-admin-line bg-white p-4">
              <h2 className="font-semibold">Theo dạng bài</h2>
              <ul className="mt-2 space-y-2">
                {data.byType.map((t) => (
                  <li
                    key={t.type}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>{QUESTION_TYPE_INFO[t.type].label}</span>
                    <RateBar correct={t.correct} answered={t.answered} />
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-admin-line bg-white p-4">
              <h2 className="font-semibold">Theo chủ điểm ngữ pháp</h2>
              <ul className="mt-2 space-y-2">
                {data.byTag.map((t) => (
                  <li
                    key={t.tag}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{t.tag}</span>
                    <RateBar correct={t.correct} answered={t.answered} />
                  </li>
                ))}
                {data.byTag.length === 0 && (
                  <li className="text-ink/60">Câu hỏi chưa gắn chủ điểm.</li>
                )}
              </ul>
            </section>
          </div>

          <section aria-labelledby="per-question" className="space-y-2">
            <h2 id="per-question" className="font-semibold">
              Tỉ lệ đúng từng câu
            </h2>
            <div className="overflow-x-auto rounded-xl border border-admin-line bg-white">
              <table className="w-full min-w-[640px] text-left">
                <thead className="border-b border-admin-line text-xs text-ink/60">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Câu</th>
                    <th className="px-4 py-2.5 font-medium">Phần</th>
                    <th className="px-4 py-2.5 font-medium">Dạng</th>
                    <th className="px-4 py-2.5 font-medium">Đúng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-line">
                  {data.items.map((i) => (
                    <tr key={i.itemId}>
                      <td
                        className="max-w-md truncate px-4 py-2"
                        title={i.prompt}
                      >
                        <span className="text-ink/50">{i.number}.</span>{' '}
                        {i.prompt}
                      </td>
                      <td className="px-4 py-2 text-ink/70">
                        {i.sectionTitle}
                      </td>
                      <td className="px-4 py-2 text-ink/70">
                        {QUESTION_TYPE_INFO[i.type].label}
                      </td>
                      <td className="px-4 py-2">
                        <RateBar correct={i.correct} answered={i.answered} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
