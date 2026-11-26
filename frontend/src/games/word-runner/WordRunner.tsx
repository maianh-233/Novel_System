import type { GameProps } from '@novel/shared';
import { Keyboard, MousePointerClick } from 'lucide-react';
import * as Phaser from 'phaser';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePronounce } from '../../hooks/usePronounce';
import { GameHeader } from '../shared/GameHeader';
import { playSfx } from '../shared/sfx';
import { useGameRound } from '../shared/useGameRound';
import {
  advance,
  attemptsFor,
  checkKey,
  isDone,
  runnerProfile,
  skipAuto,
  travelMs,
  typingTarget,
} from './logic';
import {
  HEIGHT,
  RunnerScene,
  WIDTH,
  type RunnerCallbacks,
} from './RunnerScene';

type Phase = 'waiting' | 'typing' | 'cleared' | 'hit';

interface View {
  index: number;
  /** Số ký tự (của chữ hiển thị) đã xong. */
  pos: number;
  wrongKeys: number;
  phase: Phase;
  /** Tăng mỗi lần gõ sai — đổi `key` để chữ rung lại. */
  shake: number;
  passed: number;
  stumbled: number;
}

/** Chữ hiển thị: giữ hoa thường của giáo viên, gộp dấu cách — cùng độ dài với `typingTarget`. */
const displayOf = (word: string) => word.trim().replace(/\s+/g, ' ');

/**
 * Word Runner — bạn nhỏ chạy, chướng ngại vật mang một từ tiếng Anh chạy tới.
 * Em gõ đúng cả từ trước khi nó tới nơi thì bạn nhỏ nhảy qua; không kịp thì vấp.
 * Phần chạy vẽ bằng Phaser (`RunnerScene`), phần gõ phím và chấm điểm ở đây.
 * Gõ kịp mà không sai phím nào mới tính "đúng". Game tính giờ: chơi tới khi hết giờ hoặc hết từ.
 */
export function WordRunner(props: GameProps) {
  const { content, timeLimitSec } = props;
  const { record, finish, timeLeft } = useGameRound(props);
  const words = content.words;
  const pronounce = usePronounce();

  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<RunnerScene | null>(null);
  const [focused, setFocused] = useState(true);
  const [view, setView] = useState<View>({
    index: 0,
    pos: 0,
    wrongKeys: 0,
    phase: 'waiting',
    shake: 0,
    passed: 0,
    stumbled: 0,
  });
  // Phaser và sự kiện bàn phím cần trạng thái mới nhất ngay, không chờ React render lại.
  const viewRef = useRef(view);
  const update = (next: View) => {
    viewRef.current = next;
    setView(next);
  };

  const spawnAt = (index: number) => {
    const word = words[index];
    const target = typingTarget(word.word);
    const pos = skipAuto(target, 0);
    sceneRef.current?.spawn(
      displayOf(word.word),
      pos,
      travelMs(word.word, content.level, content.stage),
      index,
    );
    // Tiểu học cấp 1: đọc to từ khi nó xuất hiện.
    if (runnerProfile(content.stage, content.level).readAloud)
      pronounce(word.word, word.audioUrl);
    update({
      ...viewRef.current,
      index,
      pos,
      wrongKeys: 0,
      phase: 'typing',
    });
  };

  // Phaser gọi lại qua ref, để các hàm luôn đọc đúng props/state mới nhất.
  const callbacks = useRef<RunnerCallbacks | null>(null);
  useLayoutEffect(() => {
    callbacks.current = {
      onReady: () => spawnAt(0),
      onHit: () => {
        const v = viewRef.current;
        if (v.phase !== 'typing') return;
        record({
          vocabularyId: words[v.index].id,
          correct: false,
          attempts: attemptsFor(v.wrongKeys),
        });
        playSfx('wrong');
        update({ ...v, phase: 'hit', stumbled: v.stumbled + 1 });
      },
      onPassed: () => {
        const next = viewRef.current.index + 1;
        if (next >= words.length) {
          playSfx('win');
          finish();
          return;
        }
        spawnAt(next);
      },
    };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Chỉ nghe cảnh đang dùng: ở chế độ StrictMode game được tạo hai lần, cảnh của
    // game đã huỷ vẫn có thể khởi động xong và gọi lại.
    const live = () => sceneRef.current === scene;
    const scene: RunnerScene = new RunnerScene({
      onReady: () => live() && callbacks.current?.onReady(),
      onHit: () => live() && callbacks.current?.onHit(),
      onPassed: () => live() && callbacks.current?.onPassed(),
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: '#eef7ff',
      banner: false,
      audio: { noAudio: true },
      // Phím do ô gõ của React nhận, Phaser không cần bắt bàn phím.
      input: { keyboard: false },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      },
      scene,
    });
    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, []);

  const typeChar = (key: string) => {
    const v = viewRef.current;
    if (v.phase !== 'typing') return;
    const word = words[v.index];
    const target = typingTarget(word.word);
    const result = checkKey(target, v.pos, key);
    if (result === 'ignore') return;
    if (result === 'wrong') {
      sceneRef.current?.wrongKey();
      update({ ...v, wrongKeys: v.wrongKeys + 1, shake: v.shake + 1 });
      return;
    }
    const pos = advance(target, v.pos);
    sceneRef.current?.setTyped(pos);
    if (!isDone(target, pos)) {
      update({ ...v, pos });
      return;
    }
    record({
      vocabularyId: word.id,
      correct: v.wrongKeys === 0,
      attempts: attemptsFor(v.wrongKeys),
    });
    playSfx('correct');
    pronounce(word.word, word.audioUrl);
    sceneRef.current?.clearObstacle();
    update({ ...v, pos, phase: 'cleared', passed: v.passed + 1 });
  };

  // Mất tiêu điểm (em bấm ra ngoài) thì dừng chạy, để không vấp oan.
  const onFocusChange = (isFocused: boolean) => {
    setFocused(isFocused);
    const s = sceneRef.current;
    if (!s?.sys.isActive() && !s?.sys.isPaused()) return;
    if (isFocused) s.scene.resume();
    else s.scene.pause();
  };

  const word = words[view.index];
  const display = word ? displayOf(word.word) : '';

  return (
    // Bấm vào đâu trong khung game cũng đưa tiêu điểm về ô gõ.
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      onClick={() => inputRef.current?.focus()}
    >
      <GameHeader
        label={`Từ ${Math.min(view.index + 1, words.length)}/${words.length}`}
        progress={(view.passed + view.stumbled) / words.length}
        timeLimitSec={timeLimitSec}
        timeLeft={timeLeft}
      />

      <div className="sticker relative overflow-hidden bg-paper p-0">
        <div ref={hostRef} className="aspect-[5/2] w-full" />
        {!focused && (
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="absolute inset-0 grid cursor-pointer place-items-center bg-ink/45 font-display text-2xl font-extrabold text-white"
          >
            <span className="inline-flex items-center gap-2">
              <MousePointerClick aria-hidden className="size-7" />
              Bấm vào đây để chạy tiếp
            </span>
          </button>
        )}
      </div>

      {word && (
        <div className="sticker flex flex-col items-center gap-2 bg-white px-4 py-5 text-center">
          <p className="text-lg text-ink/70">
            Gõ từ có nghĩa là{' '}
            <strong className="font-display text-2xl text-ink">
              {word.meaning}
            </strong>
          </p>
          <p
            key={view.shake}
            aria-hidden
            className={`font-display text-5xl leading-tight font-extrabold tracking-wide break-all ${
              view.shake > 0 ? 'animate-wiggle' : ''
            }`}
          >
            <span className="text-[#13734c]">{display.slice(0, view.pos)}</span>
            {view.phase === 'typing' && (
              <span className="rounded-md bg-sun/60 underline decoration-4 underline-offset-8">
                {display.charAt(view.pos) === ' '
                  ? '␣'
                  : display.charAt(view.pos)}
              </span>
            )}
            <span className="text-ink/35">
              {display.slice(view.pos + (view.phase === 'typing' ? 1 : 0))}
            </span>
          </p>
          <div aria-live="polite" className="min-h-8">
            {view.phase === 'cleared' && (
              <p className="font-display text-xl font-extrabold text-[#13734c]">
                {view.wrongKeys === 0 ? 'Hoàn hảo! Nhảy nào!' : 'Nhảy qua rồi!'}
              </p>
            )}
            {view.phase === 'hit' && (
              <p className="font-display text-xl font-bold">
                Ối, vấp mất rồi! Từ đó là “{word.word}”.
              </p>
            )}
          </div>
        </div>
      )}

      <label className="relative flex items-center justify-center gap-2 text-ink/70">
        <Keyboard aria-hidden className="size-5 shrink-0" />
        <span>Gõ bằng bàn phím. Nhớ tắt bộ gõ tiếng Việt (Unikey, EVKey).</span>
        {/* Ô gõ thật: nhận phím từ bàn phím máy tính lẫn bàn phím ảo. Mỗi lần gõ đọc ký tự rồi xoá. */}
        <input
          ref={inputRef}
          autoFocus
          aria-label="Ô gõ từ"
          value=""
          onChange={(e) => {
            for (const ch of e.target.value) typeChar(ch);
          }}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          lang="en"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          className="absolute size-px opacity-0"
        />
      </label>
    </div>
  );
}
