import {
  questionKind,
  type GameProps,
  type QuestionResponse,
} from '@novel/shared';
import { ArrowRight, Flame } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  QuestionView,
  type QuestionFeedback,
} from '../../components/question/QuestionView';
import { GameHeader } from './GameHeader';
import {
  checkRoundQuestion,
  isReady,
  prepareRound,
  type RoundQuestion,
} from './questionRound';
import { playSfx } from './sfx';
import { useGameRound } from './useGameRound';

export interface QuestionGameOptions {
  /** Chọn đáp án (trắc nghiệm, tìm lỗi) là chấm luôn, không cần bấm "Kiểm tra". */
  checkOnPick?: boolean;
  /** Trả lời đúng thì tự sang câu sau sau bấy nhiêu ms; sai thì chờ em bấm "Tiếp". */
  autoNextMs?: number;
  /** Điểm của một câu. `streak` = số câu đúng liên tiếp trước câu này. */
  points: (ctx: {
    rq: RoundQuestion;
    correct: boolean;
    streak: number;
    elapsedMs: number;
  }) => number;
  /** Hiện chuỗi đúng liên tiếp (Grammar Rush). */
  showStreak?: boolean;
  /** Dòng hướng dẫn phía trên câu hỏi. */
  task?: (rq: RoundQuestion) => ReactNode;
  /** Phần thêm dưới câu hỏi (vd: nút nghe từng từ). */
  extra?: (rq: RoundQuestion, locked: boolean) => ReactNode;
  /** Thay cách hiện đề (vd: Word Family bỏ gốc từ ra khỏi câu). */
  showPrompt?: (rq: RoundQuestion) => string;
}

/**
 * Khung chung của game ngữ pháp (C4): từng câu hỏi của Unit, báo đúng/sai + giải thích ngay,
 * mỗi câu một lần trả lời. Câu trả lời gửi về máy chủ theo thứ tự gốc để chấm lại và tính sao.
 */
export function QuestionGame({
  options,
  ...props
}: GameProps & { options: QuestionGameOptions }) {
  const { content, timeLimitSec } = props;
  const { recordQuestion, finish, timeLeft } = useGameRound(props);
  const round = useMemo(
    () => prepareRound(content.questions),
    [content.questions],
  );
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<QuestionResponse>(null);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [streak, setStreak] = useState(0);
  const shownAt = useRef(0);
  const nextButton = useRef<HTMLButtonElement>(null);

  const rq = round[index];
  const last = index + 1 >= round.length;

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const next = () => {
    if (last) {
      finish();
      return;
    }
    setIndex(index + 1);
    setResponse(null);
    setFeedback(null);
  };

  // Giữ hàm `next` mới nhất trong ref: hẹn giờ tự sang câu không bị đặt lại khi trang vẽ lại.
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  // Đúng thì tự sang câu (game nhanh); sai thì để em đọc giải thích rồi bấm "Câu tiếp".
  const autoNextMs = options.autoNextMs;
  useEffect(() => {
    if (!feedback) return;
    if (feedback.correct && autoNextMs !== undefined) {
      const t = setTimeout(() => nextRef.current(), autoNextMs);
      return () => clearTimeout(t);
    }
    nextButton.current?.focus();
  }, [feedback, autoNextMs]);

  if (!rq) return null;

  const check = (value: QuestionResponse) => {
    if (feedback) return;
    const r = checkRoundQuestion(rq, value);
    const points = options.points({
      rq,
      correct: r.correct,
      streak,
      elapsedMs: Date.now() - shownAt.current,
    });
    recordQuestion(
      { questionId: rq.source.id, response: r.original, attempts: 1 },
      points,
    );
    setStreak(r.correct ? streak + 1 : 0);
    playSfx(r.correct ? 'correct' : 'wrong');
    setFeedback(r.feedback);
  };

  const onChange = (value: QuestionResponse) => {
    if (feedback) return;
    setResponse(value);
    const kind = questionKind(rq.shown.type);
    if (options.checkOnPick && kind === 'choice') check(value);
  };

  const ready = isReady(rq.shown, response);
  const shown = options.showPrompt
    ? { ...rq.shown, prompt: options.showPrompt(rq) }
    : rq.shown;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <GameHeader
        label={`Câu ${index + 1}/${round.length}`}
        progress={(index + (feedback ? 1 : 0)) / round.length}
        timeLimitSec={timeLimitSec}
        timeLeft={timeLeft}
      />
      {(options.task || options.showStreak) && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg text-ink/75">{options.task?.(rq)}</p>
          {options.showStreak && streak >= 2 && (
            <span
              aria-label={`${streak} câu đúng liên tiếp`}
              className="sticker inline-flex shrink-0 items-center gap-1 bg-sun px-3 py-1 font-display font-bold"
            >
              <Flame aria-hidden className="size-5" />×{streak}
            </span>
          )}
        </div>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!feedback && ready) check(response);
        }}
      >
        <QuestionView
          key={rq.source.id}
          question={shown}
          response={response}
          onChange={onChange}
          feedback={feedback}
        />
        {options.extra?.(rq, !!feedback)}
        {!feedback &&
          !(
            options.checkOnPick && questionKind(rq.shown.type) === 'choice'
          ) && (
            <button
              type="submit"
              disabled={!ready}
              className="sticker pressable self-end bg-sky px-6 py-3 font-display text-xl font-bold disabled:opacity-50"
            >
              Kiểm tra
            </button>
          )}
      </form>

      {feedback && !(feedback.correct && options.autoNextMs !== undefined) && (
        <button
          ref={nextButton}
          type="button"
          onClick={next}
          className="sticker pressable inline-flex items-center gap-2 self-end bg-mint px-6 py-3 font-display text-xl font-bold"
        >
          {last ? 'Xem kết quả' : 'Câu tiếp'}
          <ArrowRight aria-hidden className="size-5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
