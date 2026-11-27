import {
  assignmentCreateSchema,
  findGame,
  isGameForLearner,
  isLessonForLearner,
  learnerOf,
  type AssignmentDetail,
  type AssignmentKind,
  type AssignmentSummary,
  type ClassGroupAdmin,
  type Learner,
} from '@novel/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  useAssignableLessons,
  useAssignmentMutations,
} from '../../hooks/useAssignmentsAdmin';
import { useClasses } from '../../hooks/useClassesAdmin';
import { useExams } from '../../hooks/useExamsAdmin';
import { errorMessage } from '../../services/api';
import { defaultDueAt } from '../../utils/assignments';
import { fromLocalInput, toLocalInput } from '../../utils/datetime';
import { Field } from './Field';
import {
  Button,
  ErrorNote,
  Modal,
  SelectField,
  TextAreaField,
  Toggle,
} from './ui';

type Errors = Partial<Record<string, string>>;

/** Tạo (không có `editing`) hoặc sửa bài tập. */
export function AssignmentDialog({
  editing,
  onClose,
}: {
  editing?: AssignmentSummary;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { create, update } = useAssignmentMutations();
  const lessons = useAssignableLessons();
  const exams = useExams();
  const classes = useClasses();

  const t = editing?.target;
  const [kind, setKind] = useState<AssignmentKind>(t?.kind ?? 'lesson_game');
  const [lessonId, setLessonId] = useState(
    t?.kind === 'lesson_game' ? t.lesson.id : '',
  );
  const [gameSlug, setGameSlug] = useState(
    t?.kind === 'lesson_game' ? t.game.slug : '',
  );
  const [examId, setExamId] = useState(t?.kind === 'exam' ? t.exam.id : '');
  const [forAll, setForAll] = useState(editing?.forAll ?? false);
  const [classIds, setClassIds] = useState<string[]>(
    editing?.classes.map((c) => c.id) ?? [],
  );
  const [errors, setErrors] = useState<Errors>({});

  const lesson = lessons.data?.find((l) => l.id === lessonId);
  const game = lesson?.games.find((g) => g.slug === gameSlug);
  const publishedExams = exams.data?.filter(
    (e) => e.isPublished || e.id === examId,
  );
  const exam = publishedExams?.find((e) => e.id === examId);

  /** Lớp có làm được nội dung đang chọn không (đúng cấp học / khối). */
  const fits = (c: ClassGroupAdmin) => {
    const learner: Learner = learnerOf(c);
    if (kind === 'exam') return !exam || isLessonForLearner(exam, learner);
    if (!lesson) return true;
    const def = gameSlug ? findGame(gameSlug) : undefined;
    return (
      isLessonForLearner(lesson, learner) &&
      (!def || isGameForLearner(def, learner))
    );
  };
  // Lớp đã lưu trữ chỉ hiện nếu bài đang giao cho lớp đó.
  const classList =
    classes.data?.filter((c) => !c.isArchived || classIds.includes(c.id)) ?? [];

  const suggestedTitle =
    kind === 'exam'
      ? (exam?.title ?? '')
      : lesson && game
        ? `${lesson.title} – ${game.name}`
        : '';

  const mutation = editing ? update : create;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = assignmentCreateSchema.safeParse({
      title: String(form.get('title') ?? '').trim() || suggestedTitle,
      note: form.get('note'),
      kind,
      lessonId: lessonId || null,
      gameSlug: gameSlug || null,
      examId: examId || null,
      minStars: form.get('minStars') ?? 1,
      forAll,
      classIds: forAll ? [] : classIds,
      dueAt: fromLocalInput(String(form.get('dueAt') ?? '')) ?? '',
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[key] ??= issue.message;
      }
      if (next.dueAt) next.dueAt = 'Chọn hạn nộp';
      setErrors(next);
      return;
    }
    setErrors({});
    const done = (a: AssignmentDetail) => {
      onClose();
      if (!editing) navigate(`/admin/assignments/${a.id}`);
    };
    if (editing)
      update.mutate({ id: editing.id, ...parsed.data }, { onSuccess: done });
    else create.mutate(parsed.data, { onSuccess: done });
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={editing ? 'Sửa bài tập' : 'Giao bài tập'}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="assignment-form"
            loading={mutation.isPending}
          >
            {editing ? 'Lưu' : 'Giao bài'}
          </Button>
        </>
      }
    >
      <form
        id="assignment-form"
        noValidate
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <fieldset>
          <legend className="text-sm font-medium">Loại bài</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {(
              [
                [
                  'lesson_game',
                  'Chơi game theo Unit',
                  'vd: Unit 3 – Word Builder, tối thiểu 2 sao',
                ],
                ['exam', 'Làm một đề', 'Đề đã công khai; nộp bài là xong'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-2 rounded-lg border-2 p-3 ${kind === value ? 'border-admin-accent bg-admin-accent/5' : 'border-admin-line'}`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-ink/60">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'lesson_game' ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
            <SelectField
              label="Unit"
              value={lessonId}
              error={errors.lessonId}
              onChange={(e) => {
                setLessonId(e.target.value);
                const next = lessons.data?.find((l) => l.id === e.target.value);
                if (!next?.games.some((g) => g.slug === gameSlug))
                  setGameSlug(next?.games[0]?.slug ?? '');
              }}
            >
              <option value="">
                {lessons.isPending ? 'Đang tải…' : '— Chọn Unit —'}
              </option>
              {lessons.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Trò chơi"
              value={gameSlug}
              error={errors.gameSlug}
              disabled={!lesson}
              onChange={(e) => setGameSlug(e.target.value)}
            >
              <option value="">— Chọn game —</option>
              {lesson?.games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Tối thiểu"
              name="minStars"
              defaultValue={t?.kind === 'lesson_game' ? t.minStars : 1}
            >
              <option value={1}>1 sao</option>
              <option value={2}>2 sao</option>
              <option value={3}>3 sao</option>
            </SelectField>
            {lessons.data?.length === 0 && (
              <p className="text-sm text-ink/60 sm:col-span-3">
                Chưa có Unit nào giao được. Unit cần được công khai và gán ít
                nhất một trò chơi (mục Trò chơi).
              </p>
            )}
          </div>
        ) : (
          <SelectField
            label="Đề"
            value={examId}
            error={errors.examId}
            onChange={(e) => setExamId(e.target.value)}
          >
            <option value="">
              {exams.isPending ? 'Đang tải…' : '— Chọn đề đã công khai —'}
            </option>
            {publishedExams?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({e.questionCount} câu, {e.durationMin} phút)
              </option>
            ))}
          </SelectField>
        )}

        <Field
          label="Tên bài tập"
          name="title"
          defaultValue={editing?.title}
          placeholder={suggestedTitle || 'Bài tập tuần 12'}
          hint={
            editing
              ? undefined
              : 'Để trống thì dùng tên Unit + game hoặc tên đề.'
          }
          error={errors.title}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Hạn nộp"
            name="dueAt"
            type="datetime-local"
            defaultValue={toLocalInput(editing?.dueAt ?? defaultDueAt())}
            error={errors.dueAt}
          />
        </div>

        <fieldset>
          <legend className="flex w-full items-center justify-between text-sm font-medium">
            Giao cho
            <span className="flex items-center gap-2 font-normal">
              Tất cả học sinh
              <Toggle
                label="Giao cho tất cả học sinh"
                checked={forAll}
                onChange={setForAll}
              />
            </span>
          </legend>
          {forAll ? (
            <p className="mt-1.5 text-sm text-ink/60">
              Mọi học sinh có tài khoản đang hoạt động, đúng cấp học của nội
              dung (trừ lớp đã lưu trữ).
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {classList.length === 0 && (
                <p className="text-sm text-ink/60">
                  {classes.isPending ? 'Đang tải…' : 'Chưa có lớp nào.'}
                </p>
              )}
              {classList.map((c) => {
                const ok = fits(c);
                const checked = classIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    title={
                      ok
                        ? undefined
                        : 'Lớp này khác cấp học / khối của nội dung'
                    }
                    className={`inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 ${checked ? 'border-admin-accent bg-admin-accent/5' : 'border-admin-line'} ${ok ? 'cursor-pointer' : 'opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!ok && !checked}
                      onChange={(e) =>
                        setClassIds((ids) =>
                          e.target.checked
                            ? [...ids, c.id]
                            : ids.filter((x) => x !== c.id),
                        )
                      }
                    />
                    {c.name}
                    <span className="text-xs text-ink/55">
                      {c.studentCount} em
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {errors.classIds && (
            <p className="mt-1 text-sm text-[#c62f25]">{errors.classIds}</p>
          )}
        </fieldset>

        <TextAreaField
          label="Lời dặn (tuỳ chọn)"
          name="note"
          rows={2}
          maxLength={500}
          defaultValue={editing?.note ?? ''}
          placeholder="Chơi tới khi được 2 sao nhé!"
        />

        {mutation.error && (
          <ErrorNote>{errorMessage(mutation.error)}</ErrorNote>
        )}
      </form>
    </Modal>
  );
}
