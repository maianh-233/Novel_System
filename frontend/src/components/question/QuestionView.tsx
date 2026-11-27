import {
  questionKind,
  splitMarked,
  type QuestionPublic,
  type QuestionResponse,
} from '@novel/shared';
import { Check, Lightbulb, RotateCcw, X } from 'lucide-react';

const LETTERS = 'ABCDEF';

/** Nhãn hiển thị cho lựa chọn Đúng / Sai (dữ liệu lưu True / False). */
const TF_LABEL: Record<string, string> = { True: 'Đúng', False: 'Sai' };

export interface QuestionFeedback {
  correct: boolean;
  /** Đáp án đúng để hiện cho em, vd: "B. goes". */
  answer: string;
  explanation: string | null;
  /** Vị trí lựa chọn đúng (dạng chọn) — để tô xanh. */
  correctIndex: number | null;
}

/**
 * Một câu hỏi như học sinh thấy — dùng ở màn xem trước của giáo viên và (C2) màn làm bài.
 * Chỉ nhận `QuestionPublic` (không có đáp án); đúng/sai do nơi gọi chấm rồi truyền `feedback`.
 * Thiết kế cho điện thoại trước: nút to, một cột, kéo-thả thay bằng chạm.
 */
export function QuestionView({
  question: q,
  number,
  passage,
  response,
  onChange,
  feedback,
}: {
  question: QuestionPublic;
  number?: number;
  passage?: { title: string; text: string } | null;
  response: QuestionResponse;
  onChange: (next: QuestionResponse) => void;
  feedback?: QuestionFeedback | null;
}) {
  const kind = questionKind(q.type);
  const locked = !!feedback;

  return (
    <div className="flex flex-col gap-4">
      {passage && (
        <section className="sticker max-h-72 overflow-y-auto bg-white px-4 py-3">
          <h3 className="font-display text-lg font-bold">{passage.title}</h3>
          <p className="mt-1 leading-relaxed whitespace-pre-line">
            {passage.text}
          </p>
        </section>
      )}

      <div className="font-display text-xl leading-snug font-bold">
        {number !== undefined && (
          <span className="mr-2 text-ink/50">Câu {number}.</span>
        )}
        {q.type === 'error' ? (
          <ErrorPrompt
            prompt={q.prompt}
            selected={typeof response === 'number' ? response : null}
            correctIndex={feedback?.correctIndex ?? null}
            disabled={locked}
            onPick={onChange}
          />
        ) : (
          <span className="whitespace-pre-line">{q.prompt}</span>
        )}
      </div>

      {q.hint && kind !== 'choice' && (
        <p className="inline-flex items-start gap-2 text-ink/75">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Gợi ý: <em>{q.hint}</em>
          </span>
        </p>
      )}

      {kind === 'choice' && q.type !== 'error' && (
        <ChoiceList
          q={q}
          selected={typeof response === 'number' ? response : null}
          correctIndex={feedback?.correctIndex ?? null}
          disabled={locked}
          onPick={onChange}
        />
      )}

      {kind === 'typed' && (
        <input
          aria-label="Câu trả lời"
          value={typeof response === 'string' ? response : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          lang="en"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={q.type === 'rewrite' ? 'Viết lại câu…' : 'Gõ đáp án…'}
          className={`sticker w-full bg-white px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-sky ${
            feedback
              ? feedback.correct
                ? 'ring-2 ring-mint'
                : 'ring-2 ring-tomato'
              : ''
          }`}
        />
      )}

      {kind === 'reorder' && (
        <ReorderBoard
          fragments={q.options}
          order={Array.isArray(response) ? response : []}
          disabled={locked}
          onChange={onChange}
        />
      )}

      {feedback && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 ${feedback.correct ? 'bg-mint/20' : 'bg-tomato/15'}`}
        >
          <p className="inline-flex items-center gap-2 font-bold">
            {feedback.correct ? (
              <Check aria-hidden className="size-5 text-[#13734c]" />
            ) : (
              <X aria-hidden className="size-5 text-[#b42318]" />
            )}
            {feedback.correct ? 'Đúng rồi!' : 'Chưa đúng'}
          </p>
          {!feedback.correct && (
            <p className="mt-1">
              Đáp án: <strong>{feedback.answer}</strong>
            </p>
          )}
          {feedback.explanation && (
            <p className="mt-1 text-ink/80">{feedback.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Phần chữ có đánh dấu: phần trong ngoặc gạch chân (phát âm). */
function Marked({ text }: { text: string }) {
  return (
    <>
      {splitMarked(text).map((p, i) =>
        p.marked ? (
          <u key={i} className="decoration-2 underline-offset-4">
            {p.text}
          </u>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function ChoiceList({
  q,
  selected,
  correctIndex,
  disabled,
  onPick,
}: {
  q: QuestionPublic;
  selected: number | null;
  correctIndex: number | null;
  disabled: boolean;
  onPick: (i: number) => void;
}) {
  const tf = q.type === 'true_false';
  return (
    <ul
      className={`grid gap-3 ${tf ? 'grid-cols-2' : 'sm:grid-cols-2'}`}
      aria-label="Các lựa chọn"
    >
      {q.options.map((opt, i) => {
        const isSelected = selected === i;
        const isRight = correctIndex === i;
        const isWrong = correctIndex !== null && isSelected && !isRight;
        return (
          <li key={i}>
            <button
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onPick(i)}
              className={`sticker pressable flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-lg disabled:cursor-default ${
                isRight
                  ? 'bg-mint/40'
                  : isWrong
                    ? 'bg-tomato/25'
                    : isSelected
                      ? 'bg-sky/25'
                      : 'bg-white hover:bg-paper'
              }`}
            >
              {!tf && (
                <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink/30 font-bold">
                  {LETTERS[i]}
                </span>
              )}
              <span className={tf ? 'w-full text-center font-bold' : ''}>
                {tf ? (TF_LABEL[opt] ?? opt) : <Marked text={opt} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Tìm lỗi sai: các phần trong ngoặc là nút A, B, C, D ngay trong câu. */
function ErrorPrompt({
  prompt,
  selected,
  correctIndex,
  disabled,
  onPick,
}: {
  prompt: string;
  selected: number | null;
  correctIndex: number | null;
  disabled: boolean;
  onPick: (i: number) => void;
}) {
  // Đánh số A, B, C… cho các phần trong ngoặc, theo thứ tự xuất hiện.
  const parts = splitMarked(prompt);
  const segIndex = parts.map(
    (_, i) => parts.slice(0, i).filter((x) => x.marked).length,
  );
  return (
    <span className="leading-[2.6]">
      {parts.map((p, i) => {
        if (!p.marked) return <span key={i}>{p.text}</span>;
        const index = segIndex[i];
        const isSelected = selected === index;
        const isRight = correctIndex === index;
        const isWrong = correctIndex !== null && isSelected && !isRight;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${LETTERS[index]}: ${p.text}`}
            disabled={disabled}
            onClick={() => onPick(index)}
            className={`mx-0.5 inline-flex cursor-pointer flex-col items-center rounded-lg px-1.5 align-middle leading-tight disabled:cursor-default ${
              isRight
                ? 'bg-mint/40'
                : isWrong
                  ? 'bg-tomato/25'
                  : isSelected
                    ? 'bg-sky/25'
                    : 'hover:bg-paper'
            }`}
          >
            <span className="underline decoration-2 underline-offset-4">
              {p.text}
            </span>
            <span className="text-xs text-ink/55">{LETTERS[index]}</span>
          </button>
        );
      })}
    </span>
  );
}

/** Sắp xếp câu: chạm cụm từ để thêm vào câu, chạm cụm trong câu để bỏ ra. */
function ReorderBoard({
  fragments,
  order,
  disabled,
  onChange,
}: {
  fragments: string[];
  order: number[];
  disabled: boolean;
  onChange: (next: number[]) => void;
}) {
  const used = new Set(order);
  return (
    <div className="flex flex-col gap-3">
      <div
        aria-label="Câu em đang xếp"
        className="flex min-h-16 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-ink/25 bg-white p-2"
      >
        {order.length === 0 && (
          <span className="px-2 text-ink/50">Chạm các cụm từ bên dưới…</span>
        )}
        {order.map((fi, pos) => (
          <button
            key={`${fi}-${pos}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(order.filter((_, k) => k !== pos))}
            className="sticker cursor-pointer bg-sky/20 px-3 py-2 text-lg disabled:cursor-default"
          >
            {fragments[fi]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Các cụm từ">
        {fragments.map((f, i) =>
          used.has(i) ? null : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange([...order, i])}
              className="sticker pressable cursor-pointer bg-white px-3 py-2 text-lg hover:bg-paper disabled:cursor-default"
            >
              {f}
            </button>
          ),
        )}
        {order.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex cursor-pointer items-center gap-1 px-2 text-ink/60 hover:text-ink"
          >
            <RotateCcw aria-hidden className="size-4" /> Xếp lại
          </button>
        )}
      </div>
    </div>
  );
}
