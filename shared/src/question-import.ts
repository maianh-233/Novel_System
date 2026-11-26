/**
 * Nhập câu hỏi hàng loạt (C1): dán văn bản theo định dạng đề Word, hoặc CSV.
 * Đọc thành bản nháp → đổi đáp án theo dạng câu → kiểm tra bằng `questionInputSchema`.
 * Có lỗi thì báo theo số dòng; máy chủ không ghi câu nào nếu còn lỗi.
 *
 * Định dạng dán (mỗi câu một khối):
 *
 *   # Trắc nghiệm                  ← đổi dạng cho các câu phía sau (không ghi = trắc nghiệm)
 *   1. She ___ to school every day.
 *   A. go   B. goes   C. going   D. gone
 *   Đáp án: B
 *   Giải thích: Hiện tại đơn, chủ ngữ số ít → thêm -s/-es.
 *
 *   # Đoạn văn: My school          ← các dòng tiếp theo là đoạn văn, tới câu hỏi đầu tiên
 *   ...
 *   # Hết đoạn văn
 */
import { z } from 'zod';
import { STAGES, type Stage } from './classes.js';
import {
  bracketSegments,
  questionInputSchema,
  questionKind,
  QUESTION_TYPES,
  type QuestionData,
  type QuestionType,
} from './questions.js';
import type { Level } from './vocabulary.js';

export const MAX_IMPORT_QUESTIONS = 500;

/** Bỏ dấu tiếng Việt, chữ thường — để nhận "Đáp án", "dap an", "ĐÁP ÁN" như nhau. */
export const foldVietnamese = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const TYPE_ALIASES: Record<QuestionType, string[]> = {
  mcq: ['trac nghiem', 'mcq', 'multiple choice', 'chon dap an'],
  pronunciation: ['phat am', 'pronunciation'],
  stress: ['trong am', 'stress'],
  error: ['tim loi sai', 'loi sai', 'error', 'error identification'],
  true_false: [
    'dung sai',
    'dung/sai',
    'dung / sai',
    'true false',
    'true/false',
  ],
  verb_form: ['chia dong tu', 'verb form', 'dong tu'],
  word_form: ['word form', 'dang tu', 'tu loai', 'cau tao tu'],
  fill: ['dien tu', 'fill', 'dien vao cho trong', 'gap fill'],
  rewrite: ['viet lai cau', 'viet lai', 'rewrite', 'sentence transformation'],
  reorder: ['sap xep cau', 'sap xep', 'reorder', 'sentence building'],
};

/** Dạng câu theo tên giáo viên ghi (tiếng Việt có/không dấu, tiếng Anh hoặc mã). */
export function questionTypeFromName(name: string): QuestionType | null {
  const key = foldVietnamese(name).replace(/[_-]/g, ' ');
  for (const t of QUESTION_TYPES) {
    if (t.replace('_', ' ') === key || TYPE_ALIASES[t].includes(key)) return t;
  }
  return null;
}

export const REORDER_DEFAULT_PROMPT =
  'Sắp xếp các từ / cụm từ thành câu hoàn chỉnh.';

/** Một câu hỏi vừa đọc ra, chưa kiểm tra. */
export interface QuestionDraft {
  line: number;
  type: QuestionType;
  prompt: string;
  hint?: string | null;
  /** Lựa chọn (dạng chọn) hoặc cụm từ (sắp xếp). */
  options: string[];
  /** Đáp án như giáo viên ghi: "B", "Đúng", "goes | went"… */
  answer: string | null;
  explanation?: string | null;
  grammarTag?: string | null;
  level?: string | number | null;
  stage?: string | null;
}

export interface ImportDefaults {
  stage: Stage | null;
  level: Level;
  grammarTag: string | null;
}

export const importDefaultsSchema = z.object({
  stage: z.enum(STAGES).nullable().default('secondary'),
  level: (
    z.coerce.number().int().min(1).max(3) as unknown as z.ZodType<Level>
  ).default(1),
  grammarTag: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null)
    .nullish()
    .transform((v) => v ?? null),
});

const LETTERS = 'ABCDEF';

/** Tách nhiều đáp án chấp nhận: "goes | went", "goes / went". */
const splitAlternatives = (raw: string, allowSlash: boolean) =>
  raw
    .split(allowSlash ? /\s*\|\s*|\s+\/\s+/ : /\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

const STAGE_NAMES: Record<string, Stage | null> = {
  'tieu hoc': 'primary',
  primary: 'primary',
  'cap 2': 'secondary',
  thcs: 'secondary',
  secondary: 'secondary',
  'ca hai': null,
  'ca hai cap': null,
  both: null,
};

/**
 * Đổi bản nháp thành câu hỏi hợp lệ, hoặc trả về lý do không hợp lệ.
 * Dùng chung cho dán văn bản và CSV.
 */
export function draftToQuestion(
  d: QuestionDraft,
  defaults: ImportDefaults,
): { ok: true; data: QuestionData } | { ok: false; message: string } {
  const kind = questionKind(d.type);
  let prompt = d.prompt.trim();
  let options = d.options.map((o) => o.trim()).filter(Boolean);
  let correct: number | null = null;
  let accepted: string[] = [];
  const answer = d.answer?.trim() ?? '';
  if (!answer) return { ok: false, message: 'Thiếu dòng "Đáp án:"' };

  if (d.type === 'true_false') {
    const a = foldVietnamese(answer).replace(/[.]$/, '');
    if (['t', 'true', 'dung', 'd', 'yes'].includes(a)) correct = 0;
    else if (['f', 'false', 'sai', 's', 'no', 'not given'].includes(a))
      correct = 1;
    else
      return {
        ok: false,
        message: `Đáp án câu Đúng/Sai phải là Đúng hoặc Sai (đang ghi "${answer}")`,
      };
  } else if (kind === 'choice') {
    const letter = answer.replace(/[.)\s]+$/, '').toUpperCase();
    const index = LETTERS.indexOf(letter);
    if (letter.length !== 1 || index < 0)
      return {
        ok: false,
        message: `Đáp án phải là một chữ A–F (đang ghi "${answer}")`,
      };
    const count =
      d.type === 'error' ? bracketSegments(prompt).length : options.length;
    if (d.type !== 'error' && count === 0)
      return {
        ok: false,
        message: 'Câu chọn đáp án cần các lựa chọn A. … B. …',
      };
    if (index >= count)
      return {
        ok: false,
        message: `Đáp án ${letter} nhưng câu chỉ có ${count} lựa chọn`,
      };
    correct = index;
  } else if (kind === 'reorder') {
    if (options.length === 0) {
      // Cụm từ nằm ngay trên dòng đề: "to school / I / go".
      options = prompt
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean);
      prompt = REORDER_DEFAULT_PROMPT;
    }
    if (options.length < 2)
      return {
        ok: false,
        message: 'Câu sắp xếp cần các cụm từ cách nhau bằng dấu /',
      };
    accepted = splitAlternatives(answer, false);
  } else {
    accepted = splitAlternatives(answer, d.type !== 'rewrite');
  }

  const stageText = d.stage?.trim();
  let stage = defaults.stage;
  if (stageText) {
    const key = foldVietnamese(stageText);
    if (!(key in STAGE_NAMES))
      return {
        ok: false,
        message: `Cấp học "${stageText}" không hợp lệ (Tiểu học / Cấp 2 / Cả hai)`,
      };
    stage = STAGE_NAMES[key];
  }

  const parsed = questionInputSchema.safeParse({
    type: d.type,
    prompt,
    hint: d.hint ?? null,
    options,
    correct,
    accepted,
    explanation: d.explanation ?? null,
    grammarTag: d.grammarTag?.trim() || defaults.grammarTag,
    level:
      d.level === undefined || d.level === null || d.level === ''
        ? defaults.level
        : d.level,
    stage,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: [...new Set(parsed.error.issues.map((i) => i.message))].join(
        '; ',
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

// ───────────── Đọc văn bản dán ─────────────

export interface ParsedPassage {
  /** Số thứ tự đoạn văn trong văn bản, để câu hỏi trỏ tới. */
  key: number;
  line: number;
  title: string;
  text: string;
}

export interface ParsedQuestion {
  line: number;
  /** Số câu như giáo viên ghi (1., 2., …). */
  number: number;
  passageKey: number | null;
  data: QuestionData;
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ParsedQuestionText {
  passages: ParsedPassage[];
  questions: ParsedQuestion[];
  errors: ImportError[];
}

const QUESTION_START = /^(?:c[aâ]u|question|q)?\s*(\d{1,3})\s*[.):]\s*(.*)$/i;
const OPTION_START = /^[A-F]\s*[.)]\s*/;
const FIELD =
  /^(dap an|answer|key|giai thich|explanation|chu diem|ngu phap|grammar|tag|goi y|hint|cap do|level)\s*[:：]\s*/;

/**
 * Tách một dòng có một hay nhiều lựa chọn: "A. go   B. goes   C. going".
 * Chỉ tách ở chữ cái đúng thứ tự tiếp theo, để "a.m." hay "U.S." trong lựa chọn không bị cắt.
 */
export function splitOptionLine(line: string, startIndex: number): string[] {
  const cuts: Array<{ at: number; textAt: number }> = [];
  let expected = startIndex;
  const re = /(^|\s)([A-F])\s*[.)]\s*/g;
  for (const m of line.matchAll(re)) {
    if (m[2] !== LETTERS[expected]) continue;
    const at = m.index + m[1].length;
    cuts.push({ at, textAt: m.index + m[0].length });
    expected++;
  }
  return cuts.map((c, i) =>
    line.slice(c.textAt, cuts[i + 1]?.at ?? line.length).trim(),
  );
}

interface Block {
  line: number;
  number: number;
  type: QuestionType;
  promptLines: string[];
  options: string[];
  answer: string | null;
  explanation: string | null;
  grammarTag: string | null;
  hint: string | null;
  level: string | null;
  passageKey: number | null;
}

export function parseQuestionText(
  text: string,
  defaults: ImportDefaults,
): ParsedQuestionText {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const passages: ParsedPassage[] = [];
  const questions: ParsedQuestion[] = [];
  const errors: ImportError[] = [];

  let type: QuestionType = 'mcq';
  let passage: ParsedPassage | null = null;
  /** Đang đọc nội dung đoạn văn (chưa tới câu hỏi đầu tiên của đoạn). */
  let readingPassage = false;
  let block: Block | null = null;

  const finish = () => {
    if (!block) return;
    const b = block;
    block = null;
    const result = draftToQuestion(
      {
        line: b.line,
        type: b.type,
        // Chỗ trống trong đoạn văn chỉ ghi số câu: đề là "(2)", khớp với "(2) ___" trong đoạn.
        prompt:
          b.promptLines.join('\n') ||
          (b.passageKey !== null ? `(${b.number})` : ''),
        options: b.options,
        answer: b.answer,
        explanation: b.explanation,
        grammarTag: b.grammarTag,
        hint: b.hint,
        level: b.level,
      },
      defaults,
    );
    if (result.ok) {
      questions.push({
        line: b.line,
        number: b.number,
        passageKey: b.passageKey,
        data: result.data,
      });
    } else {
      errors.push({
        line: b.line,
        message: `Câu ${b.number}: ${result.message}`,
      });
    }
  };

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();

    if (line.startsWith('#')) {
      finish();
      const name = line.replace(/^#+\s*/, '');
      const folded = foldVietnamese(name);
      const passageHead = /^doan van\s*[:：]?\s*(.*)$/.exec(folded);
      if (passageHead) {
        const title = name.replace(/^[^:：]*[:：]?\s*/, '').trim();
        passage = {
          key: passages.length,
          line: lineNo,
          title:
            (name.includes(':') || name.includes('：') ? title : '') ||
            `Đoạn văn ${passages.length + 1}`,
          text: '',
        };
        passages.push(passage);
        readingPassage = true;
        return;
      }
      if (/^het doan van$/.test(folded)) {
        passage = null;
        readingPassage = false;
        return;
      }
      const t = questionTypeFromName(name);
      if (!t) {
        errors.push({
          line: lineNo,
          message: `Không hiểu dạng câu "${name}". Dùng một trong: Trắc nghiệm, Phát âm, Trọng âm, Tìm lỗi sai, Đúng sai, Chia động từ, Word form, Điền từ, Viết lại câu, Sắp xếp câu`,
        });
        return;
      }
      type = t;
      return;
    }

    const start = QUESTION_START.exec(line);
    if (start) {
      finish();
      readingPassage = false;
      if (questions.length + errors.length >= MAX_IMPORT_QUESTIONS) return;
      let rest = start[2].trim();
      let options: string[] = [];
      // Câu điền đoạn văn hay ghi lựa chọn ngay sau số câu: "1. A. on  B. in  C. at".
      if (OPTION_START.test(rest)) {
        options = splitOptionLine(rest, 0);
        rest = `(${start[1]})`;
      }
      block = {
        line: lineNo,
        number: Number(start[1]),
        type,
        promptLines: rest ? [rest] : [],
        options,
        answer: null,
        explanation: null,
        grammarTag: null,
        hint: null,
        level: null,
        passageKey: (passage as ParsedPassage | null)?.key ?? null,
      };
      return;
    }

    if (readingPassage && passage) {
      const p = passage as ParsedPassage;
      p.text = p.text ? `${p.text}\n${raw.trimEnd()}` : raw.trim();
      return;
    }

    if (!line) return;

    if (!block) {
      errors.push({
        line: lineNo,
        message:
          'Dòng này nằm ngoài câu hỏi nào. Mỗi câu bắt đầu bằng số thứ tự, vd: "1. She ___ ..."',
      });
      return;
    }
    const b: Block = block;

    const field = FIELD.exec(foldVietnamese(line));
    if (field) {
      const value = line.replace(/^[^:：]*[:：]\s*/, '').trim();
      const name = field[1];
      if (['dap an', 'answer', 'key'].includes(name)) b.answer = value;
      else if (['giai thich', 'explanation'].includes(name))
        b.explanation = value;
      else if (['goi y', 'hint'].includes(name)) b.hint = value;
      else if (['cap do', 'level'].includes(name)) b.level = value;
      else b.grammarTag = value;
      return;
    }

    if (OPTION_START.test(line) && questionKind(b.type) !== 'typed') {
      const opts = splitOptionLine(line, b.options.length);
      if (opts.length === 0) {
        errors.push({
          line: lineNo,
          message: `Lựa chọn tiếp theo phải là ${LETTERS[b.options.length]}.`,
        });
        return;
      }
      b.options.push(...opts);
      return;
    }

    if (b.options.length === 0 && b.answer === null) {
      b.promptLines.push(line);
      return;
    }
    errors.push({
      line: lineNo,
      message: `Không hiểu dòng này trong câu ${b.number}. Dòng sau lựa chọn phải là "Đáp án:", "Giải thích:", "Chủ điểm:" hoặc "Gợi ý:"`,
    });
  });
  finish();

  for (const p of passages) {
    if (!p.text.trim())
      errors.push({ line: p.line, message: 'Đoạn văn chưa có nội dung' });
  }
  if (questions.length + errors.length >= MAX_IMPORT_QUESTIONS)
    errors.push({
      line: 1,
      message: `Mỗi lần nhập tối đa ${MAX_IMPORT_QUESTIONS} câu`,
    });
  if (questions.length === 0 && errors.length === 0)
    errors.push({ line: 1, message: 'Chưa có câu hỏi nào' });

  errors.sort((a, b) => a.line - b.line);
  return { passages, questions, errors };
}

// ───────────── API nhập ─────────────

export const QUESTION_CSV_COLUMNS = [
  'type',
  'prompt',
  'options',
  'answer',
  'hint',
  'explanation',
  'grammar',
  'level',
  'stage',
] as const;

export const questionImportSchema = z.object({
  format: z.enum(['text', 'csv']),
  content: z.string().min(1, 'Chưa có nội dung').max(1_000_000),
  defaults: importDefaultsSchema.default({
    stage: 'secondary',
    level: 1,
    grammarTag: null,
  }),
  /** true = chỉ kiểm tra và xem trước, chưa lưu. */
  dryRun: z.boolean().default(true),
});
export type QuestionImportRequest = z.input<typeof questionImportSchema>;

export interface QuestionImportPreview {
  line: number;
  number: number;
  passageTitle: string | null;
  data: QuestionData;
}

export interface QuestionImportResult {
  dryRun: boolean;
  created: number;
  passagesCreated: number;
  questions: QuestionImportPreview[];
  passages: Array<{ title: string; text: string }>;
  errors: ImportError[];
}
