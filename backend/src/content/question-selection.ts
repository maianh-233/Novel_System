import {
  plainText,
  toPublicQuestion,
  type GameDefinition,
  type GameQuestion,
  type GradableQuestion,
  type LessonGamePreview,
  type QuestionType,
} from '@novel/shared';
import { toGradable } from '../questions/mappers.js';

export interface CandidateQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  hint: string | null;
  explanation: string | null;
  passageId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  gradable: GradableQuestion;
}

/** Câu hỏi như game nhận được: phần học sinh thấy + đáp án để báo đúng/sai ngay. */
export function toGameQuestion(c: CandidateQuestion): GameQuestion {
  return {
    ...toPublicQuestion({
      id: c.id,
      type: c.type,
      prompt: c.prompt,
      hint: c.hint,
      options: c.gradable.options,
      passageId: null,
    }),
    correct: c.gradable.correct,
    accepted: [...c.gradable.accepted],
    explanation: c.explanation,
  };
}

/**
 * Lọc câu hỏi của một Unit cho một game ngữ pháp: chỉ lấy đúng dạng game chơi; bỏ câu đã
 * ngừng dùng và câu thuộc một đoạn văn (game hiện từng câu riêng, không có chỗ cho bài đọc).
 * Câu khác dạng không tính là "bị loại" — chúng dành cho game khác.
 */
export function selectQuestionsForGame(
  game: GameDefinition,
  candidates: CandidateQuestion[],
): LessonGamePreview & { questions: GameQuestion[] } {
  const types = new Set(game.questionTypes ?? []);
  const questions: GameQuestion[] = [];
  const excluded: LessonGamePreview['excluded'] = [];
  for (const c of candidates) {
    if (!types.has(c.type)) continue;
    let reason: string | null = null;
    if (c.status !== 'ACTIVE') reason = 'Đã ngừng sử dụng';
    else if (c.passageId) reason = 'Thuộc một đoạn văn (chỉ dùng trong đề)';
    if (reason) {
      excluded.push({
        id: c.id,
        word: plainText(c.prompt).slice(0, 60),
        reason,
      });
      continue;
    }
    questions.push(toGameQuestion(c));
  }
  return {
    gameSlug: game.slug,
    playable: questions.length >= game.minWords,
    words: [],
    questionCount: questions.length,
    excluded,
    questions,
  };
}

/** Câu hỏi của Unit ở dạng `selectQuestionsForGame` cần. */
export function lessonQuestionCandidates(
  rows: Array<{
    question: Parameters<typeof toGradable>[0] &
      Omit<CandidateQuestion, 'gradable'>;
  }>,
): CandidateQuestion[] {
  return rows.map(({ question: q }) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    hint: q.hint,
    explanation: q.explanation,
    passageId: q.passageId,
    status: q.status,
    gradable: toGradable(q),
  }));
}
