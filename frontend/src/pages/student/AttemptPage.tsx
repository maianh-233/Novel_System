import type {
  AttemptResult,
  AttemptView,
  QuestionResponse,
} from '@novel/shared';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudOff,
  Flag,
  Grid3x3,
  Loader2,
  Rows3,
  Send,
  Check,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { QuestionView } from '../../components/question/QuestionView';
import { useAutosave } from '../../hooks/useAutosave';
import {
  useAttempt,
  useReloadAttempt,
  useSubmitAttempt,
} from '../../hooks/useStudentExams';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/dates';
import { formatCountdown, formatScore } from '../../utils/datetime';

/** Một bài làm: đang làm → màn làm bài; đã nộp → màn kết quả. */
export function AttemptPage() {
  const { id = '' } = useParams();
  const { data, isPending, error } = useAttempt(id);

  if (isPending) {
    return (
      <div role="status" className="grid min-h-[40dvh] place-items-center">
        <Loader2 aria-label="Đang tải bài" className="size-10 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="sticker mx-auto max-w-lg bg-white p-8 text-center">
        <p className="font-display text-2xl font-bold">Chưa mở được bài</p>
        <p className="mt-2 text-ink/70">{errorMessage(error)}</p>
        <BackToExams />
      </div>
    );
  }
  return data.status === 'in_progress' ? (
    <TakeExam key={data.attempt.id} view={data.attempt} />
  ) : (
    <ResultView result={data.result} />
  );
}

function BackToExams() {
  return (
    <Link
      to="/exams"
      className="sticker pressable mt-5 inline-flex items-center gap-2 bg-white px-4 py-2 font-bold"
    >
      <ArrowLeft aria-hidden className="size-5" /> Danh sách đề
    </Link>
  );
}

// ───────────── Làm bài ─────────────

type Answers = Record<string, { response: QuestionResponse; flagged: boolean }>;

const isAnswered = (r: QuestionResponse | undefined) =>
  r !== null &&
  r !== undefined &&
  r !== '' &&
  !(Array.isArray(r) && r.length === 0);

function TakeExam({ view }: { view: AttemptView }) {
  const reload = useReloadAttempt(view.id);
  const submit = useSubmitAttempt(view.id);
  const [answers, setAnswers] = useState<Answers>(view.answers);
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<'one' | 'section'>('one');
  const [showNav, setShowNav] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [locked, setLocked] = useState(false);

  const items = useMemo(
    () =>
      view.sections.flatMap((s, si) =>
        s.items.map((it) => ({ ...it, sectionTitle: s.title, section: si })),
      ),
    [view.sections],
  );
  const current = items[index];

  const { queue, flushNow, status } = useAutosave(view.id, {
    onClosed: () => void reload(),
    onLocked: () => setLocked(true),
  });

  const change = (
    itemId: string,
    patch: Partial<Answers[string]>,
    typed = false,
  ) => {
    const next = {
      response: answers[itemId]?.response ?? null,
      flagged: answers[itemId]?.flagged ?? false,
      ...patch,
    };
    setAnswers((a) => ({ ...a, [itemId]: next }));
    queue(itemId, next, typed ? 800 : 0);
  };

  // Đồng hồ theo giờ máy chủ: máy em chạy nhanh / chậm cũng không lệch.
  const [offset] = useState(
    () => new Date(view.serverNow).getTime() - Date.now(),
  );
  const deadline = new Date(view.deadlineAt).getTime();
  const [left, setLeft] = useState(() => deadline - (Date.now() + offset));
  const finish = useCallback(async () => {
    await flushNow();
    submit.mutate();
  }, [flushNow, submit]);

  useEffect(() => {
    const t = setInterval(() => {
      const ms = deadline - (Date.now() + offset);
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(t);
        void finish(); // Hết giờ: nộp những câu đã làm.
      }
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);

  const answeredCount = items.filter((it) =>
    isAnswered(answers[it.itemId]?.response),
  ).length;
  const flaggedCount = items.filter((it) => answers[it.itemId]?.flagged).length;

  const shown =
    layout === 'one'
      ? [current]
      : items.filter((it) => it.section === current.section);

  if (locked) {
    return (
      <div className="sticker mx-auto max-w-lg bg-white p-8 text-center">
        <p className="font-display text-2xl font-bold">Không lưu được bài</p>
        <p className="mt-2 text-ink/70">
          Phiên đăng nhập đã hết hoặc tài khoản đang bị khoá. Em hỏi thầy cô
          nhé. Những câu đã lưu trước đó vẫn còn.
        </p>
        <Link
          to="/login"
          className="sticker pressable mt-5 inline-block bg-sky px-4 py-2 font-bold"
        >
          Đăng nhập lại
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-24">
      {/* Thanh trên: tên đề, giờ, trạng thái lưu, nộp bài — luôn hiện khi cuộn */}
      <div className="sticker sticky top-2 z-20 flex flex-wrap items-center gap-2 bg-white px-3 py-2">
        <p className="min-w-0 flex-1 truncate font-display font-bold">
          {view.exam.title}
        </p>
        <span
          role="timer"
          aria-label={`Còn ${formatCountdown(left)}`}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-lg font-bold ${
            left < 5 * 60_000 ? 'bg-tomato/20 text-[#b42318]' : 'bg-paper'
          }`}
        >
          <Clock aria-hidden className="size-4" />
          {formatCountdown(left)}
        </span>
        <SaveBadge status={status} />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={submit.isPending}
          className="sticker pressable inline-flex cursor-pointer items-center gap-1.5 bg-mint px-3 py-1.5 font-bold"
        >
          <Send aria-hidden className="size-4" /> Nộp bài
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowNav((v) => !v)}
          aria-expanded={showNav}
          className="sticker pressable inline-flex cursor-pointer items-center gap-1.5 bg-white px-3 py-1.5"
        >
          <Grid3x3 aria-hidden className="size-4" />
          Câu {index + 1}/{items.length} · đã làm {answeredCount}
        </button>
        <button
          type="button"
          onClick={() => setLayout((l) => (l === 'one' ? 'section' : 'one'))}
          className="sticker pressable inline-flex cursor-pointer items-center gap-1.5 bg-white px-3 py-1.5"
        >
          <Rows3 aria-hidden className="size-4" />
          {layout === 'one' ? 'Xem cả phần' : 'Từng câu'}
        </button>
      </div>

      {showNav && (
        <nav aria-label="Chọn câu" className="sticker bg-white p-3">
          {view.sections.map((s, si) => (
            <div key={si} className="mb-2 last:mb-0">
              <p className="mb-1 text-sm font-bold text-ink/70">{s.title}</p>
              <ol className="flex flex-wrap gap-1.5">
                {items
                  .map((it, i) => ({ it, i }))
                  .filter(({ it }) => it.section === si)
                  .map(({ it, i }) => {
                    const a = answers[it.itemId];
                    return (
                      <li key={it.itemId}>
                        <button
                          type="button"
                          onClick={() => {
                            setIndex(i);
                            setShowNav(false);
                          }}
                          aria-current={i === index ? 'step' : undefined}
                          aria-label={`Câu ${it.number}${isAnswered(a?.response) ? ', đã làm' : ''}${a?.flagged ? ', đánh dấu xem lại' : ''}`}
                          className={`relative grid size-10 cursor-pointer place-items-center rounded-lg border-2 font-bold ${
                            i === index ? 'border-ink' : 'border-transparent'
                          } ${isAnswered(a?.response) ? 'bg-sky/30' : 'bg-paper'}`}
                        >
                          {it.number}
                          {a?.flagged && (
                            <Flag
                              aria-hidden
                              className="absolute -top-1 -right-1 size-3.5 fill-sun text-[#b07d00]"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </div>
          ))}
          <p className="mt-2 text-xs text-ink/60">
            Xanh = đã làm · cờ vàng = đánh dấu xem lại
          </p>
        </nav>
      )}

      <p className="font-display text-lg font-bold text-ink/70">
        {current.sectionTitle}
      </p>

      {shown.map((it) => {
        const a = answers[it.itemId];
        const passage = it.question.passageId
          ? view.passages[it.question.passageId]
          : null;
        return (
          <section
            key={it.itemId}
            aria-label={`Câu ${it.number}`}
            className="sticker flex flex-col gap-3 bg-white p-4"
          >
            <QuestionView
              question={it.question}
              number={it.number}
              passage={
                // Cả phần: chỉ hiện đoạn văn ở câu đầu tiên dùng đoạn đó.
                layout === 'section' &&
                shown.find(
                  (x) => x.question.passageId === it.question.passageId,
                )?.itemId !== it.itemId
                  ? null
                  : passage
              }
              response={a?.response ?? null}
              onChange={(r) =>
                change(it.itemId, { response: r }, typeof r === 'string')
              }
            />
            <div className="flex items-center justify-between text-sm text-ink/60">
              <span>{formatScore(it.points)} điểm</span>
              <button
                type="button"
                aria-pressed={!!a?.flagged}
                onClick={() => change(it.itemId, { flagged: !a?.flagged })}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 ${
                  a?.flagged ? 'bg-sun/50 text-ink' : 'hover:bg-paper'
                }`}
              >
                <Flag aria-hidden className="size-4" />
                {a?.flagged ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}
              </button>
            </div>
          </section>
        );
      })}

      {/* Thanh dưới: câu trước / sau, dễ bấm bằng ngón cái */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl justify-between gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => {
              const prev =
                layout === 'one'
                  ? index - 1
                  : items.findIndex((it) => it.section === current.section - 1);
              setIndex(Math.max(0, prev));
              window.scrollTo({ top: 0 });
            }}
            className="sticker pressable inline-flex cursor-pointer items-center gap-1 bg-white px-4 py-2.5 font-bold disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="size-5" />
            {layout === 'one' ? 'Câu trước' : 'Phần trước'}
          </button>
          {(
            layout === 'one'
              ? index < items.length - 1
              : current.section < view.sections.length - 1
          ) ? (
            <button
              type="button"
              onClick={() => {
                const next =
                  layout === 'one'
                    ? index + 1
                    : items.findIndex(
                        (it) => it.section === current.section + 1,
                      );
                setIndex(next);
                window.scrollTo({ top: 0 });
              }}
              className="sticker pressable inline-flex cursor-pointer items-center gap-1 bg-sky px-4 py-2.5 font-bold"
            >
              {layout === 'one' ? 'Câu sau' : 'Phần sau'}
              <ChevronRight aria-hidden className="size-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="sticker pressable inline-flex cursor-pointer items-center gap-1.5 bg-mint px-4 py-2.5 font-bold"
            >
              <Send aria-hidden className="size-4" /> Nộp bài
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
          className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4"
        >
          <div className="sticker w-full max-w-sm bg-white p-5">
            <h2 id="submit-title" className="font-display text-2xl font-bold">
              Nộp bài?
            </h2>
            <p className="mt-2">
              Em đã làm <strong>{answeredCount}</strong>/{items.length} câu.
              {answeredCount < items.length &&
                ` Còn ${items.length - answeredCount} câu bỏ trống.`}
              {flaggedCount > 0 && ` Có ${flaggedCount} câu đánh dấu xem lại.`}
            </p>
            <p className="mt-1 text-ink/70">Nộp rồi thì không sửa được nữa.</p>
            {submit.isError && (
              <p role="alert" className="mt-2 text-[#b42318]">
                {errorMessage(submit.error)}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="sticker pressable cursor-pointer bg-white px-4 py-2 font-bold"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                disabled={submit.isPending}
                onClick={() => void finish()}
                className="sticker pressable inline-flex cursor-pointer items-center gap-1.5 bg-mint px-4 py-2 font-bold disabled:opacity-60"
              >
                {submit.isPending && (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                )}
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveBadge({ status }: { status: 'saved' | 'saving' | 'offline' }) {
  return (
    <span aria-live="polite" className="inline-flex items-center gap-1 text-sm">
      {status === 'saved' && (
        <>
          <Check aria-hidden className="size-4 text-[#13734c]" /> Đã lưu
        </>
      )}
      {status === 'saving' && (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" /> Đang lưu
        </>
      )}
      {status === 'offline' && (
        <span className="inline-flex items-center gap-1 text-[#b42318]">
          <CloudOff aria-hidden className="size-4" /> Mất mạng — sẽ lưu lại
        </span>
      )}
    </span>
  );
}

// ───────────── Kết quả ─────────────

function ResultView({ result: r }: { result: AttemptResult }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="sticker bg-white p-6 text-center">
        <p className="text-ink/70">{r.exam.title}</p>
        <p className="mt-2 font-display text-6xl font-extrabold">
          {formatScore(r.score)}
          <span className="text-2xl text-ink/50">/10</span>
        </p>
        <p className="mt-2">
          Đúng {r.correctCount}/{r.questionCount} câu · {formatScore(r.earned)}/
          {formatScore(r.maxPoints)} điểm
        </p>
        <p className="mt-1 text-sm text-ink/60">
          {r.autoSubmitted
            ? `Hết giờ — máy đã tự nộp những câu em lưu (${formatDateTime(r.submittedAt)}).`
            : `Nộp lúc ${formatDateTime(r.submittedAt)}.`}
        </p>
        <BackToExams />
      </div>

      {r.items ? (
        r.items.map((it) => (
          <section
            key={it.itemId}
            aria-label={`Câu ${it.number}`}
            className="sticker bg-white p-4"
          >
            <p className="mb-2 text-sm text-ink/60">
              {it.sectionTitle} · {formatScore(it.earned)}/
              {formatScore(it.points)} điểm
            </p>
            <QuestionView
              question={it.question}
              number={it.number}
              passage={
                it.question.passageId ? r.passages[it.question.passageId] : null
              }
              response={it.response}
              onChange={() => {}}
              feedback={{
                correct: it.correct,
                answer: it.answer,
                explanation: it.explanation,
                correctIndex: it.correctIndex,
              }}
            />
          </section>
        ))
      ) : (
        <p className="sticker bg-white p-4 text-center">
          {r.detailsAt
            ? `Đáp án và giải thích sẽ hiện sau khi đề đóng (${formatDateTime(r.detailsAt)}).`
            : 'Thầy cô chưa mở đáp án cho đề này.'}
        </p>
      )}
    </div>
  );
}
