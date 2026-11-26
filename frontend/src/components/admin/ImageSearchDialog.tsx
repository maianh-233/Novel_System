import type {
  ImageSearchResult,
  ImageSource,
  PixabayKind,
} from '@novel/shared';
import { Loader2, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { importImage, useImageSearch } from '../../hooks/useContentAdmin';
import { errorMessage } from '../../services/api';
import { Button, ErrorNote, Modal } from './ui';

const TAB =
  'rounded-md px-3 py-1.5 text-sm font-medium aria-pressed:bg-white aria-pressed:shadow-sm';

/**
 * Tìm hình minh hoạ cho một từ. Luôn có Fluent Emoji (miễn phí, không cần key);
 * có thêm Pixabay khi máy chủ được cấu hình PIXABAY_API_KEY. Pixabay luôn bật lọc an toàn.
 * Ảnh chọn xong được tải về máy chủ — trang học sinh không lấy ảnh từ trang ngoài.
 */
export function ImageSearchDialog({
  initialQuery,
  onPick,
  onClose,
}: {
  initialQuery: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialQuery);
  const [q, setQ] = useState(initialQuery.trim());
  const [source, setSource] = useState<ImageSource>('emoji');
  const [kind, setKind] = useState<PixabayKind>('illustration');
  const [importing, setImporting] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const search = useImageSearch({ q, source, kind });
  const pixabayEnabled = search.data?.pixabayEnabled ?? false;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQ(draft.trim());
  };

  const choose = async (r: ImageSearchResult) => {
    setImportError(null);
    setImporting(r.id);
    try {
      const { url } = await importImage({ source: r.source, id: r.id });
      onPick(url);
      onClose();
    } catch (e) {
      setImportError(errorMessage(e));
    } finally {
      setImporting(null);
    }
  };

  const results = search.data?.results ?? [];

  return (
    <Modal open wide onClose={onClose} title="Tìm hình minh hoạ">
      <div className="space-y-4">
        <form onSubmit={onSubmit} className="flex gap-2">
          <label className="sr-only" htmlFor="image-search-q">
            Từ cần tìm (tiếng Anh)
          </label>
          <input
            id="image-search-q"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="butterfly"
            autoFocus
            spellCheck={false}
            className="flex-1 rounded-lg border-2 border-admin-line px-3 py-2 outline-none focus:border-admin-accent"
          />
          <Button type="submit" variant="primary" icon={Search}>
            Tìm
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-admin-bg p-1">
            <button
              type="button"
              aria-pressed={source === 'emoji'}
              onClick={() => setSource('emoji')}
              className={TAB}
            >
              Hình emoji
            </button>
            <button
              type="button"
              aria-pressed={source === 'pixabay'}
              onClick={() => setSource('pixabay')}
              disabled={!pixabayEnabled}
              title={
                pixabayEnabled
                  ? undefined
                  : 'Chưa bật: thêm PIXABAY_API_KEY vào backend/.env'
              }
              className={`${TAB} disabled:cursor-not-allowed disabled:opacity-45`}
            >
              Pixabay
            </button>
          </div>
          {source === 'pixabay' && (
            <div className="inline-flex rounded-lg bg-admin-bg p-1">
              <button
                type="button"
                aria-pressed={kind === 'illustration'}
                onClick={() => setKind('illustration')}
                className={TAB}
              >
                Hình vẽ
              </button>
              <button
                type="button"
                aria-pressed={kind === 'photo'}
                onClick={() => setKind('photo')}
                className={TAB}
              >
                Ảnh chụp
              </button>
            </div>
          )}
        </div>

        {search.data && !pixabayEnabled && (
          <p className="text-xs text-ink/60">
            Muốn có thêm ảnh từ Pixabay: đăng ký miễn phí tại pixabay.com, rồi
            đặt <code>PIXABAY_API_KEY</code> trong <code>backend/.env</code> và
            khởi động lại máy chủ.
          </p>
        )}

        {search.error && <ErrorNote>{errorMessage(search.error)}</ErrorNote>}
        {importError && <ErrorNote>{importError}</ErrorNote>}

        <div className="min-h-48">
          {!q ? (
            <p className="py-10 text-center text-ink/60">
              Nhập từ tiếng Anh rồi bấm Tìm.
            </p>
          ) : search.isPending ? (
            <p className="flex items-center justify-center gap-2 py-10 text-ink/60">
              <Loader2 aria-hidden className="size-5 animate-spin" />
              Đang tìm…
            </p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-ink/60">
              Không tìm thấy hình cho “{q}”.
              {source === 'emoji' && pixabayEnabled
                ? ' Thử tab Pixabay nhé.'
                : ' Thử từ khác, hoặc tự tải ảnh lên.'}
            </p>
          ) : (
            <ul
              className={`grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 ${search.isFetching ? 'opacity-60' : ''}`}
            >
              {results.map((r) => (
                <li key={`${r.source}-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => void choose(r)}
                    disabled={importing !== null}
                    title={r.title}
                    aria-label={`Chọn hình: ${r.title}`}
                    className="relative grid aspect-square w-full cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-admin-line bg-white p-1.5 hover:border-admin-accent disabled:cursor-wait"
                  >
                    <img
                      src={r.previewUrl}
                      alt=""
                      loading="lazy"
                      className={`size-full ${r.source === 'emoji' ? 'object-contain' : 'object-cover'}`}
                    />
                    {importing === r.id && (
                      <span className="absolute inset-0 grid place-items-center bg-white/70">
                        <Loader2
                          aria-label="Đang tải về"
                          className="size-6 animate-spin text-admin-accent"
                        />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-ink/50">
          {source === 'emoji'
            ? 'Hình: Microsoft Fluent Emoji (giấy phép MIT).'
            : 'Ảnh từ Pixabay — đã bật lọc an toàn cho trẻ em. Dùng miễn phí, không cần ghi nguồn.'}
        </p>
      </div>
    </Modal>
  );
}
