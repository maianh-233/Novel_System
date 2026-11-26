import { ImagePlus, Music, Play, Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { uploadAudio, uploadImage } from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';
import { Button, IconButton } from './ui';

/**
 * Chọn & tải lên ảnh hoặc âm thanh cho một từ. Giá trị là URL đã tải lên (hoặc null).
 * File được tải lên ngay khi chọn để giáo viên xem/nghe thử trước khi lưu từ.
 */
export function MediaInput({
  kind,
  label,
  value,
  onChange,
  extraAction,
  note,
}: {
  kind: 'image' | 'audio';
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** Nút bổ sung cạnh "Chọn file" (vd: Tìm ảnh, Lấy từ từ điển). */
  extraAction?: ReactNode;
  /** Dòng ghi chú dưới ô (vd: nguồn của file). */
  note?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await (kind === 'image'
        ? uploadImage(file)
        : uploadAudio(file));
      onChange(url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const Icon = kind === 'image' ? ImagePlus : Music;

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <div className="mt-1.5 flex items-center gap-3 rounded-lg border-2 border-dashed border-admin-line bg-white p-2.5">
        {kind === 'image' ? (
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md bg-admin-bg">
            {value ? (
              <img src={value} alt="" className="size-full object-cover" />
            ) : (
              <Icon aria-hidden className="size-6 text-ink/40" />
            )}
          </span>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-admin-bg">
            <Icon aria-hidden className="size-5 text-ink/50" />
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={
              kind === 'image'
                ? 'image/jpeg,image/png,image/webp,image/gif'
                : 'audio/*'
            }
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button
            icon={Upload}
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {value ? 'Đổi file' : 'Chọn file'}
          </Button>
          {extraAction}
          {value && kind === 'audio' && (
            <IconButton
              icon={Play}
              label="Nghe thử"
              onClick={() => void new Audio(value).play()}
            />
          )}
          {value && (
            <IconButton
              icon={Trash2}
              label={`Bỏ ${label.toLowerCase()}`}
              onClick={() => onChange(null)}
            />
          )}
          {!value && !uploading && !extraAction && (
            <span className="text-xs text-ink/55">
              {kind === 'image'
                ? 'JPG, PNG, WebP · tối đa 5 MB'
                : 'MP3, M4A, WAV · tối đa 3 MB'}
            </span>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-[#c62f25]">{error}</p>}
      {note && <p className="mt-1 text-xs text-ink/55">{note}</p>}
    </div>
  );
}
