import {
  vocabularyInputSchema,
  type CategoryAdmin,
  type Level,
  type VocabularyAdmin,
} from '@novel/shared';
import { BookOpenText, Search, Volume2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import {
  lookupDictionary,
  useVocabularyMutations,
} from '../../hooks/useContentAdmin';
import { usePronounce } from '../../hooks/usePronounce';
import { errorMessage } from '../../services/api';
import { Field } from './Field';
import { ImageSearchDialog } from './ImageSearchDialog';
import { MediaInput } from './MediaInput';
import { useToast } from './toastContext';
import {
  Button,
  ErrorNote,
  LevelPicker,
  Modal,
  SelectField,
  TextAreaField,
  Toggle,
} from './ui';

type Errors = Partial<Record<string, string>>;

export function VocabularyDialog({
  word,
  categories,
  defaultCategoryId,
  onClose,
}: {
  word: VocabularyAdmin | null;
  categories: CategoryAdmin[];
  defaultCategoryId?: string;
  onClose: () => void;
}) {
  const m = useVocabularyMutations();
  const toast = useToast();
  const pronounce = usePronounce();
  const mutation = word ? m.update : m.create;

  const [level, setLevel] = useState<Level>(word?.level ?? 1);
  const [active, setActive] = useState(word ? word.status === 'ACTIVE' : true);
  const [imageUrl, setImageUrl] = useState<string | null>(
    word?.imageUrl ?? null,
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(
    word?.audioUrl ?? null,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [spoken, setSpoken] = useState(word?.word ?? '');
  const [searchingImage, setSearchingImage] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /** Điền vào ô đang trống — không đè những gì giáo viên đã gõ. */
  const fillIfEmpty = (name: 'ipa' | 'example', value: string | null) => {
    const el = formRef.current?.elements.namedItem(name) as
      HTMLInputElement | HTMLTextAreaElement | null;
    if (!el || !value || el.value.trim()) return false;
    el.value = value;
    return true;
  };

  const lookup = async () => {
    const w = spoken.trim();
    if (!w) return;
    setLookingUp(true);
    setLookupNote(null);
    try {
      const r = await lookupDictionary(w);
      const filled: string[] = [];
      if (r.audioUrl) {
        setAudioUrl(r.audioUrl);
        filled.push('file đọc');
      }
      if (fillIfEmpty('ipa', r.ipa)) filled.push('phiên âm');
      if (fillIfEmpty('example', r.example)) filled.push('câu ví dụ');
      const audioMissing =
        r.audioStatus === 'busy'
          ? ' Từ điển có file đọc nhưng đang giới hạn lượt tải — thử lại sau ít phút.'
          : r.audioStatus === 'missing'
            ? ' Từ điển không có file đọc — trình duyệt sẽ tự đọc từ này.'
            : '';
      setLookupNote(
        (filled.length
          ? `Đã điền: ${filled.join(', ')}. Kiểm tra lại trước khi lưu.`
          : 'Không có gì mới để điền.') +
          audioMissing +
          (r.audioCredit ? ` Nguồn âm thanh: ${r.audioCredit}.` : ''),
      );
    } catch (e) {
      setLookupNote(errorMessage(e));
    } finally {
      setLookingUp(false);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = vocabularyInputSchema.safeParse({
      word: form.get('word'),
      meaning: form.get('meaning'),
      ipa: form.get('ipa'),
      example: form.get('example'),
      categoryId: form.get('categoryId'),
      level,
      status: active ? 'ACTIVE' : 'INACTIVE',
      imageUrl: imageUrl ?? '',
      audioUrl: audioUrl ?? '',
    });
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues)
        errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    const done = () => {
      toast(
        word ? `Đã lưu "${parsed.data.word}"` : `Đã thêm "${parsed.data.word}"`,
      );
      onClose();
    };
    if (word)
      m.update.mutate({ id: word.id, ...parsed.data }, { onSuccess: done });
    else m.create.mutate(parsed.data, { onSuccess: done });
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={word ? `Sửa từ "${word.word}"` : 'Thêm từ vựng'}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button
            variant="primary"
            type="submit"
            form="vocab-form"
            loading={mutation.isPending}
          >
            {word ? 'Lưu' : 'Thêm từ'}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id="vocab-form"
        noValidate
        onSubmit={onSubmit}
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label="Từ tiếng Anh"
                name="word"
                defaultValue={word?.word}
                placeholder="butterfly"
                autoFocus
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setSpoken(e.target.value)}
                error={errors.word}
              />
            </div>
            <Button
              icon={Volume2}
              disabled={!spoken.trim()}
              onClick={() => pronounce(spoken.trim(), audioUrl ?? undefined)}
              className={errors.word ? 'mb-7' : ''}
            >
              Nghe
            </Button>
          </div>
          <Field
            label="Nghĩa tiếng Việt"
            name="meaning"
            defaultValue={word?.meaning}
            placeholder="con bướm"
            error={errors.meaning}
          />
          <Field
            label="Phiên âm IPA"
            name="ipa"
            defaultValue={word?.ipa ?? ''}
            placeholder="/ˈbʌtəflaɪ/"
            error={errors.ipa}
          />
          <TextAreaField
            label="Câu ví dụ"
            name="example"
            rows={2}
            defaultValue={word?.example ?? ''}
            placeholder="The butterfly is beautiful."
            error={errors.example}
          />
        </div>

        <div className="space-y-4">
          <SelectField
            label="Chủ đề"
            name="categoryId"
            defaultValue={
              word?.category.id ?? defaultCategoryId ?? categories[0]?.id
            }
            error={errors.categoryId}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </SelectField>
          <LevelPicker value={level} onChange={setLevel} />
          <MediaInput
            kind="image"
            label="Hình minh hoạ"
            value={imageUrl}
            onChange={setImageUrl}
            extraAction={
              <Button icon={Search} onClick={() => setSearchingImage(true)}>
                Tìm ảnh
              </Button>
            }
          />
          {errors.imageUrl && (
            <p className="text-sm text-[#c62f25]">{errors.imageUrl}</p>
          )}
          <MediaInput
            kind="audio"
            label="Âm thanh phát âm"
            value={audioUrl}
            onChange={setAudioUrl}
            extraAction={
              <Button
                icon={BookOpenText}
                loading={lookingUp}
                disabled={!spoken.trim()}
                title="Lấy file đọc, phiên âm và câu ví dụ từ từ điển miễn phí"
                onClick={() => void lookup()}
              >
                Lấy từ từ điển
              </Button>
            }
            note={lookupNote}
          />
          <div className="flex items-center justify-between gap-3 rounded-lg bg-admin-bg px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Đang sử dụng</p>
              <p className="text-xs text-ink/60">
                Tắt để ẩn từ khỏi mọi trò chơi mà không xoá.
              </p>
            </div>
            <Toggle
              checked={active}
              onChange={setActive}
              label="Đang sử dụng"
            />
          </div>
        </div>

        {mutation.error && (
          <div className="md:col-span-2">
            <ErrorNote>{errorMessage(mutation.error)}</ErrorNote>
          </div>
        )}
      </form>

      {searchingImage && (
        <ImageSearchDialog
          initialQuery={spoken}
          onPick={setImageUrl}
          onClose={() => setSearchingImage(false)}
        />
      )}
    </Modal>
  );
}
