import type { GameProps } from '@novel/shared';
import { QuestionGame } from '../shared/QuestionGame';
import { rushStep } from './logic';

/**
 * Grammar Rush — trắc nghiệm + chia động từ, tính giờ. Chọn là chấm ngay, đúng thì tự sang câu;
 * đúng liên tiếp được thưởng thêm điểm (chuỗi hiện ở góc phải).
 */
export function GrammarRush(props: GameProps) {
  return (
    <QuestionGame
      {...props}
      options={{
        checkOnPick: true,
        autoNextMs: 600,
        showStreak: true,
        task: (rq) =>
          rq.shown.type === 'verb_form'
            ? 'Gõ dạng đúng của động từ trong ngoặc'
            : 'Chọn đáp án đúng',
        points: ({ correct, streak }) => rushStep(streak, correct).points,
      }}
    />
  );
}
