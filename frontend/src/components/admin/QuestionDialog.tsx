import {
  bracketSegments,
  QUESTION_LIMITS,
  QUESTION_TYPE_INFO,
  QUESTION_TYPES,
  questionInputSchema,
  questionKind,
  type Level,
  type QuestionAdmin,
  type QuestionInput,
  type QuestionType,
  type Stage,
} from '@novel/shared';
import { Plus, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import {
  usePassages,
  useQuestionMutations,
  useQuestionTags,
} from '../../hooks/useQuestionsAdmin';
import { errorMessage } from '../../services/api';
import { plainText } from '../../utils/questions';
import { AudienceFields } from './AudienceFields';
import { Field } from './Field';
import { QuestionPreview } from './QuestionPreview';
import { useToast } from './toastContext';
import {
  Button,
  ErrorNote,
  IconButton,
  LevelPicker,
  Modal,
  SelectField,
  TextAreaField,
} from './ui';

const LETTERS = 'ABCDEF';

interface Draft {
  type: QuestionType;
  prompt: string;
  hint: string;
  /** Lựa chọn (dạng chọn) — mỗi ô một lựa chọn. */
  options: string[];
  correct: number | null;
  /** Dạng gõ / sắp xếp: mỗi dòng một đáp án chấp nhận. */
  accepted: string;
  /** Sắp xếp: mỗi dòng một cụm từ. */
  fragments: string;
  explanation: string;
  grammarTag: string;
  level: Level;
  stage: Stage | null;
  passageId: string;
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function fromQuestion(q: QuestionAdmin | null): Draft {
  if (!q) {
    return {
      type: 'mcq',
      prompt: '',
      hint: '',
      options: ['', '', '', ''],
      correct: null,
      accepted: '',
      fragments: '',
      explanation: '',
      grammarTag: '',
      level: 1,
      stage: 'secondary',
      passageId: '',
    };
  }
  const kind = questionKind(q.type);
  return {
    type: q.type,
    prompt: q.prompt,
    hint: q.hint ?? '',
    options:
      kind === 'choice' && q.type !== 'error' ? q.options : ['', '', '', ''],
    correct: q.correct,
    accepted: q.accepted.join('\n'),
    fragments: kind === 'reorder' ? q.options.join('\n') : '',
    explanation: q.explanation ?? '',
    grammarTag: q.grammarTag ?? '',
    level: q.level,
    stage: q.stage,
    passageId: q.passage?.id ?? '',
  };
}

function toInput(d: Draft): QuestionInput {
  const kind = questionKind(d.type);
  return {
    type: d.type,
    prompt: d.prompt,
    hint: d.hint,
    options: kind === 'reorder' ? lines(d.fragments) : d.options,
    correct: d.correct,
    accepted: lines(d.accepted),
    explanation: d.explanation,
    grammarTag: d.grammarTag,
    level: d.level,
    stage: d.stage,
    passageId: d.passageId || null,
  };
}

/** Thêm / sửa một câu hỏi: form theo dạng câu, bên cạnh là bản xem trước như học sinh thấy. */
export function QuestionDialog({
  initial,
  onClose,
}: {
  initial: QuestionAdmin | null;
  onClose: () => void;
}) {
  const { create, replace } = useQuestionMutations();
  const { data: tags = [] } = useQuestionTags();
  const { data: passages = [] } = usePassages();
  const toast = useToast();
  const tagListId = useId();
  const [d, setD] = useState<Draft>(() => fromQuestion(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = initial ? replace : create;
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  const parsed = questionInputSchema.safeParse(toInput(d));
  const kind = questionKind(d.type);
  const passage = passages.find((p) => p.id === d.passageId);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues)
        errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    const done = () => {
      toast(initial ? 'Đã lưu câu hỏi' : 'Đã thêm câu hỏi');
      onClose();
    };
    if (initial)
      replace.mutate({ id: initial.id, ...toInput(d) }, { onSuccess: done });
    else create.mutate(toInput(d), { onSuccess: done });
  };

  return (
    <Modal
      open
      wide="xl"
      onClose={onClose}
      title={initial ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="question-form"
            loading={mutation.isPending}
          >
            {initial ? 'Lưu' : 'Thêm câu hỏi'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <form
          id="question-form"
          noValidate
          onSubmit={onSubmit}
          className="space-y-4"
        >
          <SelectField
            label="Dạng câu"
            value={d.type}
            onChange={(e) =>
              set({ type: e.target.value as QuestionType, correct: null })
            }
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_INFO[t].label}
              </option>
            ))}
          </SelectField>
          <p className="-mt-2 text-xs text-ink/60">
            {QUESTION_TYPE_INFO[d.type].hint}
          </p>

          {passages.length > 0 && (
            <SelectField
              label="Thuộc đoạn văn"
              value={d.passageId}
              onChange={(e) => set({ passageId: e.target.value })}
            >
              <option value="">Không — câu đứng riêng</option>
              {passages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </SelectField>
          )}

          {kind !== 'reorder' && (
            <TextAreaField
              label={
                d.type === 'rewrite'
                  ? 'Câu gốc'
                  : d.type === 'true_false'
                    ? 'Câu nhận định'
                    : 'Đề bài'
              }
              rows={3}
              value={d.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              error={errors.prompt}
              placeholder={
                d.type === 'error'
                  ? 'She [go] to [school] [every] [day].'
                  : d.type === 'word_form'
                    ? 'He is very ___ (friend).'
                    : 'She ___ to school every day.'
              }
            />
          )}

          {(d.type === 'mcq' ||
            d.type === 'pronunciation' ||
            d.type === 'stress') && (
            <OptionsEditor
              options={d.options}
              correct={d.correct}
              onChange={(options, correct) => set({ options, correct })}
              error={errors.options ?? errors.correct}
            />
          )}

          {d.type === 'error' && (
            <SegmentPicker
              segments={bracketSegments(d.prompt)}
              correct={d.correct}
              onPick={(correct) => set({ correct })}
              error={errors.correct}
            />
          )}

          {d.type === 'true_false' && (
            <fieldset>
              <legend className="text-sm font-medium">Đáp án</legend>
              <div className="mt-1.5 flex gap-4">
                {['Đúng', 'Sai'].map((label, i) => (
                  <label key={label} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tf"
                      checked={d.correct === i}
                      onChange={() => set({ correct: i })}
                      className="accent-admin-accent"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {errors.correct && (
                <p className="mt-1 text-sm text-[#c62f25]">{errors.correct}</p>
              )}
            </fieldset>
          )}

          {kind === 'reorder' && (
            <>
              <TextAreaField
                label="Đề bài (tuỳ chọn)"
                rows={1}
                value={d.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
                placeholder="Sắp xếp các từ / cụm từ thành câu hoàn chỉnh."
                error={errors.prompt}
              />
              <TextAreaField
                label="Các cụm từ — mỗi dòng một cụm (học sinh nhận bản đã trộn)"
                rows={5}
                value={d.fragments}
                onChange={(e) => set({ fragments: e.target.value })}
                error={errors.options}
                placeholder={'I\ngo\nto school\nevery day.'}
              />
            </>
          )}

          {d.type === 'rewrite' && (
            <Field
              label="Gợi ý (tuỳ chọn)"
              value={d.hint}
              onChange={(e) => set({ hint: e.target.value })}
              placeholder="I have ..."
            />
          )}

          {kind !== 'choice' && (
            <TextAreaField
              label="Đáp án chấp nhận — mỗi dòng một cách"
              rows={3}
              value={d.accepted}
              onChange={(e) => set({ accepted: e.target.value })}
              error={errors.accepted}
              hint="Máy so sau khi bỏ hoa thường, khoảng trắng thừa, dấu chấm cuối câu và quy nháy cong về nháy thẳng."
            />
          )}

          <TextAreaField
            label="Giải thích (hiện sau khi làm)"
            rows={2}
            value={d.explanation}
            onChange={(e) => set({ explanation: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Chủ điểm ngữ pháp"
              value={d.grammarTag}
              list={tagListId}
              onChange={(e) => set({ grammarTag: e.target.value })}
              placeholder="Present simple"
            />
            <datalist id={tagListId}>
              {tags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <LevelPicker
              value={d.level}
              onChange={(level) => set({ level })}
              name="question-level"
            />
          </div>
          <AudienceFields
            value={{ stage: d.stage, grade: null }}
            onChange={(a) => set({ stage: a.stage })}
            hideGrade
          />
          {mutation.error && (
            <ErrorNote>{errorMessage(mutation.error)}</ErrorNote>
          )}
        </form>

        <aside aria-label="Xem trước" className="space-y-2 lg:sticky lg:top-0">
          <p className="text-sm font-medium">Học sinh sẽ thấy</p>
          {parsed.success ? (
            <QuestionPreview
              question={parsed.data}
              passage={passage && { title: passage.title, text: passage.text }}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-admin-line px-4 py-8 text-center text-ink/60">
              Điền đủ đề bài và đáp án để xem trước.
            </p>
          )}
        </aside>
      </div>
    </Modal>
  );
}

function OptionsEditor({
  options,
  correct,
  onChange,
  error,
}: {
  options: string[];
  correct: number | null;
  onChange: (options: string[], correct: number | null) => void;
  error?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium">
        Các lựa chọn — chọn ô tròn ở đáp án đúng
      </legend>
      <ol className="mt-1.5 space-y-2">
        {options.map((opt, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              aria-label={`${LETTERS[i]} là đáp án đúng`}
              checked={correct === i}
              onChange={() => onChange(options, i)}
              className="size-4 accent-admin-accent"
            />
            <span className="w-5 font-medium">{LETTERS[i]}.</span>
            <input
              aria-label={`Lựa chọn ${LETTERS[i]}`}
              value={opt}
              onChange={(e) =>
                onChange(
                  options.map((o, k) => (k === i ? e.target.value : o)),
                  correct,
                )
              }
              className="w-full rounded-lg border-2 border-admin-line px-3 py-1.5 outline-none focus:border-admin-accent"
            />
            <IconButton
              icon={X}
              label={`Bỏ lựa chọn ${LETTERS[i]}`}
              disabled={options.length <= QUESTION_LIMITS.minOptions}
              onClick={() =>
                onChange(
                  options.filter((_, k) => k !== i),
                  correct === i
                    ? null
                    : correct !== null && correct > i
                      ? correct - 1
                      : correct,
                )
              }
            />
          </li>
        ))}
      </ol>
      {options.length < QUESTION_LIMITS.maxOptions && (
        <Button
          icon={Plus}
          variant="ghost"
          className="mt-1"
          onClick={() => onChange([...options, ''], correct)}
        >
          Thêm lựa chọn
        </Button>
      )}
      {error && <p className="mt-1 text-sm text-[#c62f25]">{error}</p>}
    </fieldset>
  );
}

/** Tìm lỗi sai: chọn phần sai trong các phần đặt trong ngoặc của đề. */
function SegmentPicker({
  segments,
  correct,
  onPick,
  error,
}: {
  segments: string[];
  correct: number | null;
  onPick: (i: number) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Phần sai</legend>
      {segments.length === 0 ? (
        <p className="mt-1 text-sm text-ink/60">
          Đặt các phần A, B, C, D của câu trong ngoặc vuông để chọn phần sai.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-3">
          {segments.map((s, i) => (
            <label key={i} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="error-segment"
                checked={correct === i}
                onChange={() => onPick(i)}
                className="accent-admin-accent"
              />
              {LETTERS[i]}. {plainText(s)}
            </label>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-[#c62f25]">{error}</p>}
    </fieldset>
  );
}
