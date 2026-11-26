import {
  CSV_COLUMNS,
  type CategoryAdmin,
  type VocabularyImportResult,
} from '@novel/shared';
import { CheckCircle2, Download, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useVocabularyMutations } from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';
import { useToast } from './toastContext';
import { Button, ErrorNote, Modal, SelectField, TextAreaField } from './ui';

const TEMPLATE = [
  CSV_COLUMNS.join(','),
  'butterfly,con bướm,/ˈbʌtəflaɪ/,The butterfly is beautiful.,Animals,3,,',
  'apple,quả táo,/ˈæpl/,,Fruits,1,,',
].join('\n');

function downloadTemplate() {
  // BOM để Excel mở đúng tiếng Việt.
  const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mau-tu-vung.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportDialog({
  categories,
  onClose,
}: {
  categories: CategoryAdmin[];
  onClose: () => void;
}) {
  const { importCsv } = useVocabularyMutations();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [checked, setChecked] = useState<VocabularyImportResult | null>(null);

  const changeCsv = (text: string) => {
    setCsv(text);
    setChecked(null);
    importCsv.reset();
  };

  const run = (dryRun: boolean) =>
    importCsv.mutate(
      { csv, dryRun, defaultCategoryId: defaultCategoryId || undefined },
      {
        onSuccess: (res) => {
          if (res.dryRun) {
            setChecked(res);
            return;
          }
          toast(`Đã nhập: ${res.created} từ mới, ${res.updated} từ cập nhật`);
          onClose();
        },
      },
    );

  const canCommit =
    checked &&
    checked.errors.length === 0 &&
    checked.created + checked.updated > 0;

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Nhập từ vựng từ file CSV"
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          {canCommit ? (
            <Button
              variant="primary"
              loading={importCsv.isPending}
              onClick={() => run(false)}
            >
              Nhập {checked.created + checked.updated} từ
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!csv.trim()}
              loading={importCsv.isPending}
              onClick={() => run(true)}
            >
              Kiểm tra file
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-ink/75">
          Dòng đầu là tên cột:{' '}
          <code className="rounded bg-admin-bg px-1">
            {CSV_COLUMNS.join(', ')}
          </code>
          . Bắt buộc có <strong>word</strong> và <strong>meaning</strong>. Cột{' '}
          <strong>category</strong> ghi tên chủ đề; <strong>level</strong> là 1
          (dễ), 2 (vừa) hoặc 3 (khó). Từ đã có trong cùng chủ đề sẽ được cập
          nhật.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              changeCsv(await f.text());
              e.target.value = '';
            }}
          />
          <Button icon={FileUp} onClick={() => fileRef.current?.click()}>
            Chọn file CSV
          </Button>
          <Button icon={Download} variant="ghost" onClick={downloadTemplate}>
            Tải file mẫu
          </Button>
          {fileName && (
            <span className="self-center text-ink/60">{fileName}</span>
          )}
        </div>

        <TextAreaField
          label="Hoặc dán nội dung CSV"
          rows={6}
          value={csv}
          onChange={(e) => {
            setFileName(null);
            changeCsv(e.target.value);
          }}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder={TEMPLATE}
        />

        <SelectField
          label="Chủ đề cho dòng không ghi category"
          value={defaultCategoryId}
          onChange={(e) => {
            setDefaultCategoryId(e.target.value);
            setChecked(null);
          }}
        >
          <option value="">— Không có (dòng thiếu chủ đề sẽ báo lỗi) —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>

        {importCsv.error && (
          <ErrorNote>{errorMessage(importCsv.error)}</ErrorNote>
        )}

        {checked && (
          <div className="rounded-lg border border-admin-line bg-admin-bg p-3">
            {checked.errors.length === 0 ? (
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 aria-hidden className="size-4 text-[#13734c]" />
                File hợp lệ: {checked.created} từ mới, {checked.updated} từ sẽ
                được cập nhật.
              </p>
            ) : (
              <>
                <p className="font-medium">
                  Có {checked.errors.length} dòng cần sửa. Chưa có từ nào được
                  nhập — sửa file rồi kiểm tra lại.
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                  {checked.errors.map((e) => (
                    <li key={`${e.line}-${e.message}`}>
                      <span className="font-medium">Dòng {e.line}:</span>{' '}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
