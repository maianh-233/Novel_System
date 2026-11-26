import {
  EXAM_MODE_LABEL,
  examUpdateSchema,
  QUESTION_TYPE_INFO,
  type ExamDetail,
  type ExamMode,
  type QuestionAdmin,
  type ResultVisibility,
  type Stage,
} from '@novel/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Copy,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AudienceFields } from '../../components/admin/AudienceFields';
import { Field } from '../../components/admin/Field';
import { QuestionPickerModal } from '../../components/admin/QuestionPickerModal';
import { useToast } from '../../components/admin/toastContext';
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorNote,
  IconButton,
  LoadingBlock,
  SelectField,
  TextAreaField,
  Toggle,
} from '../../components/admin/ui';
import { useExam, useExamMutations } from '../../hooks/useExamsAdmin';
import { errorMessage } from '../../services/api';
import { fromLocalInput, toLocalInput } from '../../utils/datetime';
import { plainText } from '../../utils/questions';

export function ExamEditPage() {
  const { id = '' } = useParams();
  const { data: exam, isPending, error } = useExam(id);
  if (isPending) return <LoadingBlock />;
  if (error)
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorNote>{errorMessage(error)}</ErrorNote>
      </div>
    );
  return <ExamEditor key={exam.id} exam={exam} />;
}

function BackLink() {
  return (
    <Link
      to="/admin/exams"
      className="inline-flex items-center gap-1.5 text-ink/70 hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" /> Tất cả đề
    </Link>
  );
}

function ExamEditor({ exam }: { exam: ExamDetail }) {
  const m = useExamMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const locked = exam.attemptCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2">
            <Toggle
              checked={exam.isPublished}
              label="Công khai cho học sinh"
              disabled={
                m.update.isPending ||
                (!exam.isPublished && exam.questionCount === 0)
              }
              onChange={(isPublished) =>
                m.update.mutate(
                  { id: exam.id, isPublished },
                  {
                    onSuccess: () =>
                      toast(
                        isPublished
                          ? 'Đã công khai đề'
                          : 'Đã chuyển về bản nháp',
                      ),
                    onError: (e) => toast(errorMessage(e), 'error'),
                  },
                )
              }
            />
            {exam.isPublished ? 'Công khai' : 'Bản nháp'}
          </span>
          <Button
            icon={BarChart3}
            onClick={() => navigate(`/admin/exams/${exam.id}/results`)}
          >
            Kết quả ({exam.attemptCount})
          </Button>
          <Button
            icon={Copy}
            loading={m.duplicate.isPending}
            onClick={() =>
              m.duplicate.mutate(exam.id, {
                onSuccess: (copy) => {
                  toast('Đã tạo bản sao');
                  navigate(`/admin/exams/${copy.id}`);
                },
              })
            }
          >
            Nhân bản
          </Button>
          <Button
            variant="ghost"
            icon={Trash2}
            onClick={() => {
              m.remove.reset();
              setDeleting(true);
            }}
          >
            Xoá
          </Button>
        </div>
      </div>

      <SettingsForm exam={exam} />
      <StructureEditor exam={exam} locked={locked} />

      <ConfirmDialog
        open={deleting}
        title="Xoá đề?"
        confirmLabel="Xoá đề"
        loading={m.remove.isPending}
        error={m.remove.error ? errorMessage(m.remove.error) : null}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          m.remove.mutate(exam.id, {
            onSuccess: () => {
              toast(`Đã xoá "${exam.title}"`);
              navigate('/admin/exams', { replace: true });
            },
          })
        }
      >
        Đề <strong>{exam.title}</strong> sẽ bị xoá. Câu hỏi trong ngân hàng vẫn
        giữ nguyên. Đề đã có học sinh làm thì không xoá được.
      </ConfirmDialog>
    </div>
  );
}

// ───────────── Cài đặt ─────────────

function SettingsForm({ exam }: { exam: ExamDetail }) {
  const { update } = useExamMutations();
  const toast = useToast();
  const [mode, setMode] = useState<ExamMode>(exam.mode);
  const [showResult, setShowResult] = useState<ResultVisibility>(
    exam.showResult,
  );
  const [shuffle, setShuffle] = useState(exam.shuffle);
  const [audience, setAudience] = useState<{
    stage: Stage | null;
    grade: number | null;
  }>({
    stage: exam.stage,
    grade: exam.grade,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = examUpdateSchema.safeParse({
      title: f.get('title'),
      description: f.get('description'),
      mode,
      durationMin: f.get('durationMin'),
      maxAttempts: f.get('maxAttempts'),
      opensAt: fromLocalInput(String(f.get('opensAt') ?? '')),
      closesAt: fromLocalInput(String(f.get('closesAt') ?? '')),
      shuffle,
      showResult,
      ...audience,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues)
        errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    update.mutate(
      { id: exam.id, ...parsed.data },
      { onSuccess: () => toast('Đã lưu cài đặt đề') },
    );
  };

  return (
    <section
      aria-labelledby="exam-settings"
      className="rounded-xl border border-admin-line bg-white p-5"
    >
      <h1 id="exam-settings" className="text-xl font-semibold">
        {exam.title}
      </h1>
      <form
        noValidate
        onSubmit={onSubmit}
        className="mt-4 grid gap-4 md:grid-cols-2"
      >
        <div className="space-y-4">
          <Field
            label="Tên đề"
            name="title"
            defaultValue={exam.title}
            error={errors.title}
          />
          <TextAreaField
            label="Lời dặn cho học sinh"
            name="description"
            rows={2}
            defaultValue={exam.description ?? ''}
          />
          <AudienceFields
            value={audience}
            onChange={setAudience}
            error={errors.grade}
          />
        </div>
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <SelectField
            label="Chế độ"
            value={mode}
            onChange={(e) => {
              const next = e.target.value as ExamMode;
              setMode(next);
              // Đổi chế độ thì gợi ý cách xem kết quả đã chốt cho chế độ đó.
              setShowResult(next === 'exam' ? 'after_close' : 'after_submit');
            }}
          >
            <option value="exam">{EXAM_MODE_LABEL.exam}</option>
            <option value="practice">{EXAM_MODE_LABEL.practice}</option>
          </SelectField>
          <SelectField
            label="Xem đáp án + giải thích"
            value={showResult}
            onChange={(e) => setShowResult(e.target.value as ResultVisibility)}
          >
            <option value="after_submit">Ngay khi nộp</option>
            <option value="after_close">Sau giờ đóng đề</option>
          </SelectField>
          <Field
            label="Thời gian làm (phút)"
            name="durationMin"
            type="number"
            min={1}
            max={300}
            defaultValue={exam.durationMin}
            error={errors.durationMin}
          />
          <Field
            label="Số lần làm (0 = không giới hạn)"
            name="maxAttempts"
            type="number"
            min={0}
            max={20}
            defaultValue={exam.maxAttempts}
            error={errors.maxAttempts}
          />
          <Field
            label="Mở lúc (trống = ngay)"
            name="opensAt"
            type="datetime-local"
            defaultValue={toLocalInput(exam.opensAt)}
            error={errors.opensAt}
          />
          <Field
            label="Đóng lúc (trống = không đóng)"
            name="closesAt"
            type="datetime-local"
            defaultValue={toLocalInput(exam.closesAt)}
            error={errors.closesAt}
            hint={
              showResult === 'after_close'
                ? 'Không đặt giờ đóng thì học sinh chỉ xem được điểm, không xem đáp án.'
                : undefined
            }
          />
          <label className="flex items-center gap-2 sm:col-span-2">
            <Toggle
              checked={shuffle}
              onChange={setShuffle}
              label="Trộn câu và đáp án"
            />
            Trộn thứ tự câu trong mỗi phần và thứ tự đáp án (mỗi em một kiểu)
          </label>
          <div className="sm:col-span-2">
            <Button variant="primary" type="submit" loading={update.isPending}>
              Lưu cài đặt
            </Button>
          </div>
          {update.error && (
            <div className="sm:col-span-2">
              <ErrorNote>{errorMessage(update.error)}</ErrorNote>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

// ───────────── Các phần và câu hỏi ─────────────

interface DraftSection {
  key: string;
  title: string;
  items: Array<{ question: QuestionAdmin; points: number }>;
}

let keySeq = 0;
const newKey = () => `s${++keySeq}`;

const fromExam = (e: ExamDetail): DraftSection[] =>
  e.sections.map((s) => ({
    key: newKey(),
    title: s.title,
    items: s.items.map((i) => ({ question: i.question, points: i.points })),
  }));

const signature = (sections: DraftSection[]) =>
  JSON.stringify(
    sections.map((s) => [
      s.title,
      s.items.map((i) => [i.question.id, i.points]),
    ]),
  );

function StructureEditor({
  exam,
  locked,
}: {
  exam: ExamDetail;
  locked: boolean;
}) {
  const { setStructure } = useExamMutations();
  const toast = useToast();
  const [draft, setDraft] = useState<DraftSection[]>(() => fromExam(exam));
  const [picking, setPicking] = useState<string | null>(null);
  const dirty = signature(draft) !== signature(fromExam(exam));
  const inExam = new Set(
    draft.flatMap((s) => s.items.map((i) => i.question.id)),
  );
  const total = draft.reduce(
    (sum, s) => sum + s.items.reduce((x, i) => x + (Number(i.points) || 0), 0),
    0,
  );
  const count = draft.reduce((n, s) => n + s.items.length, 0);

  const patch = (key: string, fn: (s: DraftSection) => DraftSection) =>
    setDraft((list) => list.map((s) => (s.key === key ? fn(s) : s)));
  const moveItem = (key: string, i: number, d: -1 | 1) =>
    patch(key, (s) => {
      const items = [...s.items];
      [items[i], items[i + d]] = [items[i + d], items[i]];
      return { ...s, items };
    });

  const save = () =>
    setStructure.mutate(
      {
        id: exam.id,
        sections: draft.map((s) => ({
          title: s.title,
          items: s.items.map((i) => ({
            questionId: i.question.id,
            points: Number(i.points),
          })),
        })),
      },
      {
        onSuccess: (e) => {
          setDraft(fromExam(e));
          toast('Đã lưu câu hỏi của đề');
        },
      },
    );

  return (
    <section aria-labelledby="exam-structure" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="exam-structure" className="text-lg font-semibold">
          Câu hỏi{' '}
          <span className="font-normal text-ink/60">
            ({count} câu · {total} điểm, quy về thang 10)
          </span>
        </h2>
        {!locked && (
          <div className="flex items-center gap-2">
            {dirty && <Badge tone="amber">Chưa lưu</Badge>}
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(fromExam(exam))}>
                Bỏ thay đổi
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!dirty}
              loading={setStructure.isPending}
              onClick={save}
            >
              Lưu câu hỏi
            </Button>
          </div>
        )}
      </div>
      {locked && (
        <p className="flex items-start gap-2 rounded-lg bg-sun/25 px-3 py-2 text-[#5c4100]">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          Đã có học sinh làm đề này nên không đổi câu hỏi được (bài đã làm sẽ bị
          sai). Vẫn đổi được giờ mở–đóng, thời gian, cách xem kết quả. Muốn sửa
          câu hỏi thì bấm “Nhân bản”.
        </p>
      )}
      {setStructure.error && (
        <ErrorNote>{errorMessage(setStructure.error)}</ErrorNote>
      )}

      {draft.map((s, si) => (
        <div
          key={s.key}
          className="rounded-xl border border-admin-line bg-white"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-admin-line px-4 py-2.5">
            <input
              aria-label={`Tên phần ${si + 1}`}
              value={s.title}
              disabled={locked}
              onChange={(e) =>
                patch(s.key, (x) => ({ ...x, title: e.target.value }))
              }
              className="min-w-40 flex-1 rounded-lg border-2 border-transparent px-2 py-1 font-semibold hover:border-admin-line focus:border-admin-accent disabled:hover:border-transparent"
            />
            <span className="text-sm text-ink/60">{s.items.length} câu</span>
            {!locked && (
              <>
                <Button icon={Plus} onClick={() => setPicking(s.key)}>
                  Thêm câu
                </Button>
                <IconButton
                  icon={ArrowUp}
                  label="Đưa phần lên"
                  disabled={si === 0}
                  onClick={() =>
                    setDraft((l) => {
                      const n = [...l];
                      [n[si - 1], n[si]] = [n[si], n[si - 1]];
                      return n;
                    })
                  }
                />
                <IconButton
                  icon={Trash2}
                  label={`Xoá phần "${s.title}"`}
                  onClick={() =>
                    setDraft((l) => l.filter((x) => x.key !== s.key))
                  }
                />
              </>
            )}
          </div>
          {s.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-ink/60">
              Chưa có câu. Bấm “Thêm câu” để chọn từ ngân hàng.
            </p>
          ) : (
            <ol className="divide-y divide-admin-line">
              {s.items.map((it, i) => (
                <li
                  key={it.question.id}
                  className="flex items-center gap-2 px-3 py-1.5"
                >
                  <span className="w-6 text-right text-xs text-ink/45">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{plainText(it.question.prompt)}</p>
                    <p className="truncate text-xs text-ink/60">
                      {QUESTION_TYPE_INFO[it.question.type].label}
                      {it.question.grammarTag
                        ? ` · ${it.question.grammarTag}`
                        : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-sm text-ink/70">
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={it.points}
                      disabled={locked}
                      aria-label="Điểm"
                      onChange={(e) =>
                        patch(s.key, (x) => ({
                          ...x,
                          items: x.items.map((y, k) =>
                            k === i
                              ? { ...y, points: Number(e.target.value) }
                              : y,
                          ),
                        }))
                      }
                      className="w-16 rounded-lg border-2 border-admin-line px-2 py-1 text-right"
                    />
                    điểm
                  </label>
                  {!locked && (
                    <>
                      <IconButton
                        icon={ArrowUp}
                        label="Đưa câu lên"
                        disabled={i === 0}
                        onClick={() => moveItem(s.key, i, -1)}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label="Đưa câu xuống"
                        disabled={i === s.items.length - 1}
                        onClick={() => moveItem(s.key, i, 1)}
                      />
                      <IconButton
                        icon={X}
                        label="Bỏ câu khỏi đề"
                        onClick={() =>
                          patch(s.key, (x) => ({
                            ...x,
                            items: x.items.filter((_, k) => k !== i),
                          }))
                        }
                      />
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}

      {!locked && (
        <Button
          icon={Plus}
          onClick={() =>
            setDraft((l) => [
              ...l,
              { key: newKey(), title: `Phần ${l.length + 1}`, items: [] },
            ])
          }
        >
          Thêm phần
        </Button>
      )}

      {picking && (
        <QuestionPickerModal
          title="Thêm câu vào phần"
          exclude={inExam}
          onClose={() => setPicking(null)}
          onPick={(qs) => {
            patch(picking, (s) => ({
              ...s,
              items: [
                ...s.items,
                ...qs.map((question) => ({ question, points: 1 })),
              ],
            }));
            setPicking(null);
          }}
        />
      )}
    </section>
  );
}
