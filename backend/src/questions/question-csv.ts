import {
  draftToQuestion,
  questionTypeFromName,
  type ImportDefaults,
  type ImportError,
  type ParsedQuestionText,
} from '@novel/shared';
import Papa from 'papaparse';

const MAX_ROWS = 500;

/**
 * Đọc CSV câu hỏi (dòng đầu là tiêu đề). Cột bắt buộc: type, prompt, answer.
 * `options`: các lựa chọn / cụm từ cách nhau bằng "|". `answer`: chữ cái (dạng chọn) hoặc
 * các đáp án chấp nhận cách nhau bằng "|". Chỉ đọc & kiểm tra — không ghi database.
 */
export function parseQuestionCsv(
  csv: string,
  defaults: ImportDefaults,
): ParsedQuestionText {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const errors: ImportError[] = [];
  const result: ParsedQuestionText = { passages: [], questions: [], errors };

  const headers = parsed.meta.fields ?? [];
  for (const required of ['type', 'prompt', 'answer']) {
    if (!headers.includes(required))
      errors.push({
        line: 1,
        message: `Thiếu cột "${required}" ở dòng tiêu đề`,
      });
  }
  if (errors.length) return result;
  if (parsed.data.length > MAX_ROWS) {
    errors.push({
      line: 1,
      message: `Tối đa ${MAX_ROWS} câu mỗi lần nhập (file có ${parsed.data.length} dòng)`,
    });
    return result;
  }

  parsed.data.forEach((raw, index) => {
    const line = index + 2;
    const type = questionTypeFromName(raw.type ?? '');
    if (!type) {
      errors.push({ line, message: `Không hiểu dạng câu "${raw.type ?? ''}"` });
      return;
    }
    const r = draftToQuestion(
      {
        line,
        type,
        prompt: raw.prompt ?? '',
        options: (raw.options ?? '').split('|'),
        answer: raw.answer ?? null,
        hint: raw.hint,
        explanation: raw.explanation,
        grammarTag: raw.grammar,
        level: raw.level,
        stage: raw.stage,
      },
      defaults,
    );
    if (r.ok)
      result.questions.push({
        line,
        number: index + 1,
        passageKey: null,
        data: r.data,
      });
    else errors.push({ line, message: r.message });
  });
  if (result.questions.length === 0 && errors.length === 0)
    errors.push({ line: 1, message: 'File chưa có câu hỏi nào' });
  return result;
}
