import { passageInputSchema, type PassageAdmin } from '@novel/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  usePassageMutations,
  usePassages,
} from '../../hooks/useQuestionsAdmin';
import { errorMessage } from '../../services/api';
import { Field } from './Field';
import { useToast } from './toastContext';
import {
  Button,
  ErrorNote,
  IconButton,
  LoadingBlock,
  Modal,
  TextAreaField,
} from './ui';

/** Đoạn văn cho đọc hiểu / điền từ: danh sách + thêm / sửa / xoá. */
export function PassagesDialog({ onClose }: { onClose: () => void }) {
  const { data: passages, isPending, error } = usePassages();
  const m = usePassageMutations();
  const toast = useToast();
  const [editing, setEditing] = useState<PassageAdmin | 'new' | null>(null);

  return (
    <Modal open wide onClose={onClose} title="Đoạn văn">
      {editing ? (
        <PassageForm
          initial={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ink/70">
              Nhiều câu hỏi dùng chung một đoạn văn. Chọn đoạn văn trong form
              câu hỏi, hoặc dán kèm khi nhập (<code># Đoạn văn: Tên</code>).
            </p>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setEditing('new')}
            >
              Thêm đoạn văn
            </Button>
          </div>
          {m.remove.error && (
            <ErrorNote>{errorMessage(m.remove.error)}</ErrorNote>
          )}
          {isPending ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorNote>{errorMessage(error)}</ErrorNote>
          ) : passages.length === 0 ? (
            <p className="py-8 text-center text-ink/60">
              Chưa có đoạn văn nào.
            </p>
          ) : (
            <ul className="divide-y divide-admin-line rounded-xl border border-admin-line">
              {passages.map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.title}</p>
                    <p className="line-clamp-2 text-ink/65">{p.text}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {p.questionCount} câu hỏi
                    </p>
                  </div>
                  <IconButton
                    icon={Pencil}
                    label={`Sửa "${p.title}"`}
                    onClick={() => setEditing(p)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={`Xoá "${p.title}"`}
                    onClick={() =>
                      m.remove.mutate(p.id, {
                        onSuccess: () => toast(`Đã xoá "${p.title}"`),
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function PassageForm({
  initial,
  onDone,
}: {
  initial: PassageAdmin | null;
  onDone: () => void;
}) {
  const { create, update } = usePassageMutations();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = initial ? update : create;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = passageInputSchema.safeParse({
      title: form.get('title'),
      text: form.get('text'),
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues)
        errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    const done = () => {
      toast(initial ? 'Đã lưu đoạn văn' : 'Đã thêm đoạn văn');
      onDone();
    };
    if (initial)
      update.mutate({ id: initial.id, ...parsed.data }, { onSuccess: done });
    else create.mutate(parsed.data, { onSuccess: done });
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <Field
        label="Tên đoạn văn"
        name="title"
        defaultValue={initial?.title}
        autoFocus
        error={errors.title}
      />
      <TextAreaField
        label="Nội dung"
        name="text"
        rows={10}
        defaultValue={initial?.text}
        hint="Đánh số chỗ trống như (1) ___, (2) ___ để khớp với câu hỏi."
        error={errors.text}
      />
      {mutation.error && <ErrorNote>{errorMessage(mutation.error)}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Quay lại</Button>
        <Button variant="primary" type="submit" loading={mutation.isPending}>
          {initial ? 'Lưu' : 'Thêm đoạn văn'}
        </Button>
      </div>
    </form>
  );
}
