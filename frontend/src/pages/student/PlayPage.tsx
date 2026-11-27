import {
  findGame,
  type FinishSessionResponse,
  type GameResult,
  type StartSessionResponse,
} from '@novel/shared';
import { ArrowLeft, Keyboard, Loader2 } from 'lucide-react';
import { Suspense, useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  BigButton,
  Countdown,
  GameErrorBoundary,
  LessonPicker,
  ResultScreen,
} from '../../components/play/PlayParts';
import { GAME_COMPONENTS } from '../../games/registry';
import {
  useFinishSession,
  usePlayGame,
  useStartSession,
} from '../../hooks/useStudentSession';
import { ApiError, errorMessage } from '../../services/api';

type Phase =
  | { kind: 'pick' }
  | { kind: 'countdown'; round: StartSessionResponse }
  | { kind: 'playing'; round: StartSessionResponse }
  | { kind: 'saving'; round: StartSessionResponse; result: GameResult }
  | {
      kind: 'result';
      round: StartSessionResponse;
      outcome: FinishSessionResponse;
    };

function Loading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="grid min-h-[40dvh] place-items-center text-center"
    >
      <div>
        <Loader2 aria-hidden className="mx-auto size-10 animate-spin" />
        <p className="mt-3 font-display text-xl font-bold">{label}</p>
      </div>
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticker mx-auto max-w-lg bg-white p-8 text-center">
      <p className="font-display text-3xl font-extrabold">{title}</p>
      {children && <div className="mt-2 text-lg text-ink/70">{children}</div>}
      <Link
        to="/"
        className="sticker pressable mt-6 inline-flex items-center gap-2 bg-sky px-5 py-2.5 font-display text-xl font-bold"
      >
        <ArrowLeft aria-hidden className="size-5" strokeWidth={2.5} />
        Về trang chủ
      </Link>
    </div>
  );
}

/** Khung chơi chung cho mọi game: chọn bài học → đếm ngược → game → chấm sao → màn kết quả. */
export function PlayPage() {
  const { slug = '' } = useParams();
  const def = findGame(slug);
  const Game = GAME_COMPONENTS[slug];

  if (!def || !Game) {
    return (
      <Notice title="Trò chơi này sắp có">
        Em chọn trò chơi khác trước nhé!
      </Notice>
    );
  }
  return (
    <PlayFlow
      key={slug}
      slug={slug}
      name={def.name}
      typing={def.group === 'typing'}
      Game={Game}
    />
  );
}

/** Máy có chuột/bàn di chuột thì gần như chắc có bàn phím; máy chỉ có màn cảm ứng thì không. */
const hasKeyboard = () =>
  typeof window === 'undefined' ||
  !window.matchMedia ||
  window.matchMedia('(any-pointer: fine)').matches;

function PlayFlow({
  slug,
  name,
  typing,
  Game,
}: {
  slug: string;
  name: string;
  /** Game luyện gõ phím: nhắc em cần bàn phím nếu máy chỉ có màn cảm ứng. */
  typing: boolean;
  Game: (typeof GAME_COMPONENTS)[string];
}) {
  const info = usePlayGame(slug);
  const start = useStartSession();
  const finish = useFinishSession();
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  // Mở từ "Bài được giao": chỉ hiện Unit được giao (em vẫn xem được mọi bài).
  const [params, setParams] = useSearchParams();
  const assignedId = params.get('lesson');

  const begin = (lessonId: string) => {
    finish.reset();
    start.mutate(
      { gameSlug: slug, lessonId },
      { onSuccess: (round) => setPhase({ kind: 'countdown', round }) },
    );
  };

  const save = useCallback(
    (round: StartSessionResponse, result: GameResult) => {
      setPhase({ kind: 'saving', round, result });
      finish.mutate(
        {
          sessionId: round.content.sessionId,
          score: result.score,
          durationMs: result.durationMs,
          answers: result.answers,
        },
        {
          onSuccess: (outcome) => setPhase({ kind: 'result', round, outcome }),
        },
      );
    },
    [finish],
  );

  const toPicker = () => {
    start.reset();
    setPhase({ kind: 'pick' });
  };

  const header = (
    <div className="mb-6 flex items-center gap-3">
      {phase.kind === 'pick' || phase.kind === 'result' ? (
        <Link
          to="/"
          aria-label="Về trang chủ"
          className="sticker pressable grid size-11 shrink-0 place-items-center bg-white"
        >
          <ArrowLeft aria-hidden className="size-6" strokeWidth={2.5} />
        </Link>
      ) : null}
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        {name}
      </h1>
    </div>
  );

  if (phase.kind === 'countdown') {
    return (
      <>
        {header}
        <Countdown
          onDone={() => setPhase({ kind: 'playing', round: phase.round })}
        />
      </>
    );
  }

  if (phase.kind === 'playing') {
    const { round } = phase;
    return (
      <>
        {header}
        <GameErrorBoundary onReset={toPicker}>
          <Suspense fallback={<Loading label="Đang mở trò chơi…" />}>
            <Game
              key={round.content.sessionId}
              content={round.content}
              timeLimitSec={round.timeLimitSec}
              onFinish={(result) => save(round, result)}
            />
          </Suspense>
        </GameErrorBoundary>
      </>
    );
  }

  if (phase.kind === 'saving') {
    return (
      <>
        {header}
        {finish.isError ? (
          <div className="sticker mx-auto max-w-md bg-white p-8 text-center">
            <p className="font-display text-2xl font-bold">
              Chưa lưu được kết quả
            </p>
            <p className="mt-1 text-ink/70">{errorMessage(finish.error)}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {/* Lượt đã quá hạn hoặc đã lưu rồi thì gửi lại cũng không được. */}
              {!(
                finish.error instanceof ApiError && finish.error.status === 409
              ) && (
                <BigButton
                  tint="bg-mint"
                  onClick={() => save(phase.round, phase.result)}
                >
                  Thử lại
                </BigButton>
              )}
              <BigButton onClick={toPicker}>Chọn bài học</BigButton>
            </div>
          </div>
        ) : (
          <Loading label="Đang chấm điểm…" />
        )}
      </>
    );
  }

  if (phase.kind === 'result') {
    return (
      <>
        {header}
        <ResultScreen
          result={phase.outcome}
          replaying={start.isPending}
          onReplay={() => begin(phase.round.content.lessonId)}
          onPickAnother={toPicker}
        />
        {start.isError && (
          <p role="alert" className="mt-4 text-center text-lg text-tomato">
            {errorMessage(start.error)}
          </p>
        )}
      </>
    );
  }

  // Chọn bài học
  const assigned = assignedId
    ? info.data?.lessons.find((l) => l.id === assignedId)
    : undefined;
  return (
    <>
      {header}
      {info.isPending ? (
        <Loading label="Đang tải bài học…" />
      ) : info.isError ? (
        <Notice title="Chưa tải được bài học">
          {errorMessage(info.error)}
        </Notice>
      ) : !info.data.isEnabled ? (
        <Notice title="Trò chơi đang tạm nghỉ">
          Em chọn trò chơi khác nhé!
        </Notice>
      ) : info.data.lessons.length === 0 ? (
        <Notice title="Chưa có bài học">
          Thầy cô chưa chọn bài học cho trò chơi này. Em chơi trò khác nhé!
        </Notice>
      ) : (
        <>
          {typing && !hasKeyboard() && (
            <p className="sticker mb-5 flex items-start gap-2 bg-sun/40 px-4 py-3 text-lg">
              <Keyboard aria-hidden className="mt-1 size-5 shrink-0" />
              Trò này cần bàn phím. Em nối bàn phím vào máy rồi chơi, hoặc chọn
              trò khác nhé!
            </p>
          )}
          {assigned ? (
            <p className="mb-5 flex flex-wrap items-baseline gap-x-3 text-lg text-ink/75">
              Bài thầy cô giao cho em:
              <button
                type="button"
                onClick={() => setParams({}, { replace: true })}
                className="cursor-pointer text-base underline underline-offset-4"
              >
                Xem mọi bài
              </button>
            </p>
          ) : (
            <p className="mb-5 text-lg text-ink/75">Em muốn học bài nào?</p>
          )}
          <LessonPicker
            lessons={assigned ? [assigned] : info.data.lessons}
            onPick={begin}
            busyLessonId={
              start.isPending ? start.variables?.lessonId : undefined
            }
          />
          {start.isError && (
            <p role="alert" className="mt-5 text-lg text-tomato">
              {errorMessage(start.error)}
            </p>
          )}
        </>
      )}
    </>
  );
}
