import {
  QUESTION_CSV_COLUMNS,
  QUESTION_TYPE_INFO,
  type Level,
  type QuestionImportResult,
  type Stage,
} from '@novel/shared';
import { CheckCircle2, Download, FileUp } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import {
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
  Badge,
  Button,
  ErrorNote,
  LevelPicker,
  Modal,
  TextAreaField,
} from './ui';

const TEXT_EXAMPLE = `1. She ___ to school every day.
A. go   B. goes   C. going   D. gone
Đáp án: B
Giải thích: Hiện tại đơn, chủ ngữ số ít → động từ thêm -s/-es.

# Word form
2. He is very ___ (friend).
Đáp án: friendly`;

const CSV_TEMPLATE = [
  QUESTION_CSV_COLUMNS.join(','),
  'Trắc nghiệm,She ___ to school every day.,go|goes|going|gone,B,,Hiện tại đơn,Present simple,1,Cấp 2',
  'Word form,He is very ___ (friend).,,friendly,,,Word form,2,Cấp 2',
  'Sắp xếp câu,,to school|I|go|every day,I go to school every day.,,,,1,',
].join('\n');

function downloadTemplate() {
  // BOM để Excel mở đúng tiếng Việt.
  const blob = new Blob(['﻿' + CSV_TEMPLATE], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mau-cau-hoi.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Nhập nhiều câu một lần: dán văn bản theo định dạng đề Word (mặc định) hoặc CSV.
 * Bấm "Kiểm tra" để máy đọc và báo lỗi theo dòng; hết lỗi mới lưu được — lưu là lưu tất cả.
 */
export function QuestionImportDialog({ onClose }: { onClose: () => void }) {
  const { importQuestions } = useQuestionMutations();
  const { data: tags = [] } = useQuestionTags();
  const toast = useToast();
  const tagListId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<'text' | 'csv'>('text');
  const [content, setContent] = useState('');
  const [stage, setStage] = useState<Stage | null>('secondary');
  const [level, setLevel] = useState<Level>(1);
  const [grammarTag, setGrammarTag] = useState('');
  const [checked, setChecked] = useState<QuestionImportResult | null>(null);

  const reset = () => {
    setChecked(null);
    importQuestions.reset();
  };

  const run = (dryRun: boolean) =>
    importQuestions.mutate(
      {
        format,
        content,
        defaults: { stage, level, grammarTag: grammarTag || null },
        dryRun,
      },
      {
        onSuccess: (res) => {
          if (res.dryRun) {
            setChecked(res);
            return;
          }
          toast(
            `Đã lưu ${res.created} câu hỏi${res.passagesCreated ? ` và ${res.passagesCreated} đoạn văn` : ''}`,
          );
          onClose();
        },
      },
    );

  const canSave =
    checked && checked.errors.length === 0 && checked.questions.length > 0;
  const passageOf = (title: string | null) =>
    title ? checked?.passages.find((p) => p.title === title) : undefined;

  return (
    <Modal
      open
      wide="xl"
      onClose={onClose}
      title="Nhập câu hỏi"
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          {canSave ? (
            <Button
              variant="primary"
              icon={CheckCircle2}
              loading={importQuestions.isPending}
              onClick={() => run(false)}
            >
              Lưu {checked.questions.length} câu hỏi
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!content.trim()}
              loading={importQuestions.isPending}
              onClick={() => run(true)}
            >
              Kiểm tra
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div
            role="tablist"
            aria-label="Cách nhập"
            className="inline-flex rounded-lg border-2 border-admin-line bg-white p-0.5"
          >
            {(
              [
                ['text', 'Dán từ Word'],
                ['csv', 'File CSV'],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={format === f}
                onClick={() => {
                  setFormat(f);
                  setContent('');
                  reset();
                }}
                className={`cursor-pointer rounded-md px-3 py-1.5 ${format === f ? 'bg-admin-accent text-white' : 'hover:bg-admin-bg'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {format === 'text' ? (
            <>
              <TextAreaField
                label="Dán câu hỏi"
                rows={14}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  reset();
                }}
                placeholder={TEXT_EXAMPLE}
                className="font-mono"
              />
              <details className="rounded-lg bg-admin-bg px-3 py-2 text-ink/80">
                <summary className="cursor-pointer font-medium">
                  Định dạng dán
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Mỗi câu bắt đầu bằng số: <code>1.</code> hoặc{' '}
                    <code>Câu 1:</code>. Lựa chọn <code>A. … B. …</code> trên
                    một hoặc nhiều dòng.
                  </li>
                  <li>
                    Sau đó: <code>Đáp án: B</code>, tuỳ chọn{' '}
                    <code>Giải thích:</code>, <code>Chủ điểm:</code>,{' '}
                    <code>Gợi ý:</code>, <code>Cấp độ: 2</code>.
                  </li>
                  <li>
                    Đổi dạng cho các câu phía sau bằng một dòng{' '}
                    <code># Tên dạng</code>:{' '}
                    {Object.values(QUESTION_TYPE_INFO)
                      .map((t) => t.label)
                      .join(', ')}
                    . Không ghi = Trắc nghiệm.
                  </li>
                  <li>
                    Câu gõ có nhiều đáp án: <code>Đáp án: went | did go</code>.
                    Sắp xếp câu: <code>1. to school / I / go</code>.
                  </li>
                  <li>
                    Đoạn văn: <code># Đoạn văn: Tên đoạn</code>, các dòng tiếp
                    theo là nội dung, các câu sau đó thuộc đoạn này cho tới{' '}
                    <code># Hết đoạn văn</code>.
                  </li>
                </ul>
              </details>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button icon={FileUp} onClick={() => fileRef.current?.click()}>
                  Chọn file CSV
                </Button>
                <Button
                  variant="ghost"
                  icon={Download}
                  onClick={downloadTemplate}
                >
                  Tải file mẫu
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setContent(await f.text());
                    reset();
                    e.target.value = '';
                  }}
                />
              </div>
              <p className="text-ink/70">
                Cột: <code>{QUESTION_CSV_COLUMNS.join(', ')}</code>. Lựa chọn và
                nhiều đáp án cách nhau bằng <code>|</code>.
              </p>
              {content && (
                <p className="text-ink/70">
                  Đã đọc {content.split('\n').length - 1} dòng.
                </p>
              )}
            </div>
          )}

          <fieldset className="space-y-3 rounded-lg border border-admin-line p-3">
            <legend className="px-1 text-sm font-medium">
              Áp cho câu không ghi riêng
            </legend>
            <AudienceFields
              value={{ stage, grade: null }}
              onChange={(a) => {
                setStage(a.stage);
                reset();
              }}
              hideGrade
            />
            <LevelPicker
              value={level}
              onChange={(l) => {
                setLevel(l);
                reset();
              }}
              name="import-level"
            />
            <Field
              label="Chủ điểm ngữ pháp"
              value={grammarTag}
              list={tagListId}
              onChange={(e) => {
                setGrammarTag(e.target.value);
                reset();
              }}
            />
            <datalist id={tagListId}>
              {tags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </fieldset>
        </div>

        <div className="space-y-3">
          {importQuestions.error && (
            <ErrorNote>{errorMessage(importQuestions.error)}</ErrorNote>
          )}
          {!checked ? (
            <p className="rounded-xl border border-dashed border-admin-line px-4 py-10 text-center text-ink/60">
              Dán câu hỏi rồi bấm “Kiểm tra” để xem trước.
            </p>
          ) : checked.errors.length > 0 ? (
            <div className="space-y-2">
              <ErrorNote>
                Có {checked.errors.length} lỗi — sửa xong mới lưu được (chưa câu
                nào được lưu).
              </ErrorNote>
              <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
                {checked.errors.map((e, i) => (
                  <li key={i} className="rounded-lg bg-tomato/10 px-3 py-1.5">
                    <strong>Dòng {e.line}:</strong> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-medium text-[#13734c]">
                Đọc được {checked.questions.length} câu
                {checked.passages.length
                  ? ` và ${checked.passages.length} đoạn văn`
                  : ''}
                , không có lỗi. Mở từng câu để xem như học sinh thấy.
              </p>
              <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto">
                {checked.questions.map((q) => (
                  <li key={q.line}>
                    <details className="rounded-lg border border-admin-line bg-white">
                      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2">
                        <span className="text-ink/50">{q.number}.</span>
                        <span className="min-w-0 flex-1 truncate">
                          {plainText(q.data.prompt)}
                        </span>
                        <Badge>{QUESTION_TYPE_INFO[q.data.type].label}</Badge>
                      </summary>
                      <div className="px-3 pb-3">
                        <QuestionPreview
                          question={q.data}
                          number={q.number}
                          passage={passageOf(q.passageTitle)}
                        />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
