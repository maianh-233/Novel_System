import type { GameAnswer, GameProps, GameQuestionAnswer } from '@novel/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const POINTS_PER_WORD = 10;

/**
 * Phần chung của một lượt chơi: ghi kết quả từng từ, đếm ngược (nếu game có giới hạn giờ)
 * và gửi kết quả đúng một lần — khi chơi hết từ hoặc khi hết giờ.
 */
export function useGameRound({ content, timeLimitSec, onFinish }: GameProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const answers = useRef<GameAnswer[]>([]);
  const questionAnswers = useRef<GameQuestionAnswer[]>([]);
  /** Điểm của game ngữ pháp (có thể có thưởng chuỗi đúng). */
  const questionPoints = useRef(0);
  const startedAt = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const record = useCallback((answer: GameAnswer) => {
    if (finished.current) return;
    answers.current.push(answer);
  }, []);

  /**
   * Game ngữ pháp: ghi câu trả lời (thứ tự lựa chọn gốc) và điểm game tự tính cho câu đó.
   * Đúng/sai thật do máy chủ chấm lại khi nhận kết quả.
   */
  const recordQuestion = useCallback(
    (answer: GameQuestionAnswer, points: number) => {
      if (finished.current) return;
      questionAnswers.current.push(answer);
      questionPoints.current += points;
    },
    [],
  );

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const list = answers.current;
    onFinish({
      sessionId: content.sessionId,
      score:
        list.filter((a) => a.correct).length * POINTS_PER_WORD +
        questionPoints.current,
      durationMs: Date.now() - startedAt.current,
      answers: list,
      questionAnswers: questionAnswers.current,
    });
  }, [content.sessionId, onFinish]);

  // Hết giờ thì nộp những từ đã làm.
  useEffect(() => {
    if (timeLimitSec <= 0) return;
    const t = setInterval(() => {
      const left =
        timeLimitSec - Math.floor((Date.now() - startedAt.current) / 1000);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) finish();
    }, 250);
    return () => clearInterval(t);
  }, [timeLimitSec, finish]);

  return { record, recordQuestion, finish, timeLeft };
}
