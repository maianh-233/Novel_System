import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DictionaryLookupResult,
  ImageSearchResponse,
  ImageSearchResult,
  ImageSource,
  MediaErrorCode,
  PixabayKind,
} from '@novel/shared';
import type { Env } from '../config/env.js';
import {
  COMMONS_API_HOST,
  commonsInfoUrl,
  DICTIONARY_AUDIO_HOSTS,
  parseCommonsAudio,
  parseDictionary,
  type DictionaryInfo,
} from './dictionary.js';
import { emojiImageUrl, findEmoji, searchEmoji } from './emoji-search.js';
import {
  AUDIO_MAX_BYTES,
  IMAGE_MAX_BYTES,
  MediaService,
} from './media.service.js';
import {
  parsePixabayHits,
  PIXABAY_IMAGE_HOSTS,
  pixabayByIdUrl,
  pixabaySearchUrl,
  type PixabayHit,
} from './pixabay.js';
import { fetchRemote, remoteUnavailable } from './remote-fetch.js';

const DICTIONARY_HOST = 'api.dictionaryapi.dev';
const GITHUB_RAW_HOST = 'raw.githubusercontent.com';
const JSON_MAX_BYTES = 2 * 1024 * 1024;
/** Pixabay yêu cầu lưu tạm kết quả tìm kiếm 24 giờ. */
const PIXABAY_CACHE_MS = 24 * 3600_000;
const PIXABAY_CACHE_MAX = 500;

const mediaError = (status: number, code: MediaErrorCode, message: string) =>
  new HttpException({ statusCode: status, code, message }, status);

@Injectable()
export class RemoteMediaService {
  private readonly pixabayKey: string | undefined;
  private readonly pixabayCache = new Map<
    string,
    { at: number; hits: PixabayHit[] }
  >();

  constructor(
    private readonly media: MediaService,
    config: ConfigService<Env, true>,
  ) {
    this.pixabayKey = config.get('PIXABAY_API_KEY', { infer: true });
  }

  get pixabayEnabled(): boolean {
    return !!this.pixabayKey;
  }

  async searchImages(
    q: string,
    source: ImageSource,
    kind: PixabayKind,
  ): Promise<ImageSearchResponse> {
    let results: ImageSearchResult[];
    if (source === 'pixabay') {
      const hits = await this.pixabaySearch(q, kind);
      results = hits.map((h) => ({
        source: 'pixabay',
        id: String(h.id),
        title: h.tags ?? '',
        previewUrl: h.previewURL!,
      }));
    } else {
      results = searchEmoji(q).map((e) => ({
        source: 'emoji',
        id: e.name,
        title: e.name,
        previewUrl: emojiImageUrl(e),
      }));
    }
    return { results, pixabayEnabled: this.pixabayEnabled };
  }

  /**
   * Tải ảnh đã chọn về máy chủ (thu nhỏ, đổi sang WebP như ảnh giáo viên tự tải lên).
   * Nhận mã ảnh chứ không nhận URL — máy chủ tự dựng địa chỉ, không tải được file ở nơi khác.
   */
  async importImage(source: ImageSource, id: string): Promise<{ url: string }> {
    let url: string;
    let hosts: string[];
    if (source === 'emoji') {
      const e = findEmoji(id);
      if (!e)
        throw mediaError(404, 'image_not_found', 'Không tìm thấy hình này');
      url = emojiImageUrl(e);
      hosts = [GITHUB_RAW_HOST];
    } else {
      const key = this.requirePixabayKey();
      if (!/^\d{1,12}$/.test(id))
        throw mediaError(404, 'image_not_found', 'Không tìm thấy ảnh này');
      const res = await fetchRemote(pixabayByIdUrl(key, id), ['pixabay.com'], {
        maxBytes: JSON_MAX_BYTES,
        serviceName: 'Pixabay',
      });
      const hit =
        res.status === 200
          ? parsePixabayHits(readJson(res.body))[0]
          : undefined;
      if (!hit)
        throw mediaError(
          404,
          'image_not_found',
          'Không tìm thấy ảnh này trên Pixabay',
        );
      url = hit.webformatURL!;
      hosts = PIXABAY_IMAGE_HOSTS;
    }

    const file = await fetchRemote(url, hosts, {
      maxBytes: IMAGE_MAX_BYTES,
      serviceName: source === 'emoji' ? 'kho hình Fluent Emoji' : 'Pixabay',
    });
    if (file.status !== 200) {
      throw remoteUnavailable('Không tải được ảnh. Thử lại sau nhé.');
    }
    return this.media.saveImage(file.body);
  }

  /** Tra từ điển: phiên âm + câu ví dụ + tải file đọc về máy chủ. */
  async lookupDictionary(word: string): Promise<DictionaryLookupResult> {
    const res = await fetchRemote(
      `https://${DICTIONARY_HOST}/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`,
      [DICTIONARY_HOST],
      { maxBytes: JSON_MAX_BYTES, serviceName: 'từ điển' },
    );
    if (res.status === 404) {
      throw mediaError(
        404,
        'not_in_dictionary',
        `Từ điển không có "${word}". Cụm từ nhiều chữ thường không có — hãy tự ghi âm hoặc để trình duyệt tự đọc.`,
      );
    }
    if (res.status !== 200) {
      throw remoteUnavailable('Từ điển đang bận. Thử lại sau ít phút nhé.');
    }

    const info = parseDictionary(word, readJson(res.body));
    const audioUrl = await this.downloadPronunciation(info);
    const hasSource = !!(info.commonsPageId || info.audioSourceUrl);
    return {
      ipa: info.ipa,
      example: info.example,
      audioUrl,
      audioStatus: audioUrl ? 'saved' : hasSource ? 'busy' : 'missing',
      audioCredit: audioUrl ? info.audioCredit : null,
    };
  }

  /**
   * Tải file đọc: trước tiên lấy bản MP3 trên Wikimedia Commons, không được thì thử máy chủ
   * của dictionaryapi.dev. Không tải được cũng không sao — trình duyệt sẽ tự đọc từ đó.
   */
  private async downloadPronunciation(
    info: DictionaryInfo,
  ): Promise<string | null> {
    const sources: Array<() => Promise<string | null>> = [];
    const pageId = info.commonsPageId;
    if (pageId) {
      sources.push(async () => {
        const meta = await fetchRemote(
          commonsInfoUrl(pageId),
          [COMMONS_API_HOST],
          { maxBytes: JSON_MAX_BYTES, serviceName: 'Wikimedia Commons' },
        );
        return meta.status === 200
          ? parseCommonsAudio(readJson(meta.body))
          : null;
      });
    }
    const direct = info.audioSourceUrl;
    if (direct) sources.push(() => Promise.resolve(direct));

    for (const source of sources) {
      try {
        const url = await source();
        if (!url) continue;
        const file = await fetchRemote(url, DICTIONARY_AUDIO_HOSTS, {
          maxBytes: AUDIO_MAX_BYTES,
          serviceName: 'kho phát âm',
          retries: 4,
        });
        if (file.status === 200) {
          return (await this.media.saveAudio(file.body)).url;
        }
      } catch {
        // thử nguồn tiếp theo
      }
    }
    return null;
  }

  private requirePixabayKey(): string {
    if (!this.pixabayKey) {
      throw mediaError(
        400,
        'pixabay_disabled',
        'Chưa bật tìm ảnh Pixabay (thiếu PIXABAY_API_KEY trên máy chủ).',
      );
    }
    return this.pixabayKey;
  }

  private async pixabaySearch(
    q: string,
    kind: PixabayKind,
  ): Promise<PixabayHit[]> {
    const key = this.requirePixabayKey();
    const cacheKey = `${kind}|${q.toLowerCase()}`;
    const cached = this.pixabayCache.get(cacheKey);
    if (cached && Date.now() - cached.at < PIXABAY_CACHE_MS) return cached.hits;

    const res = await fetchRemote(
      pixabaySearchUrl(key, q, kind),
      ['pixabay.com'],
      {
        maxBytes: JSON_MAX_BYTES,
        serviceName: 'Pixabay',
      },
    );
    if (res.status === 429) {
      throw remoteUnavailable(
        'Pixabay đang giới hạn lượt tìm. Đợi 1 phút rồi thử lại.',
      );
    }
    if (res.status !== 200) {
      // 400 thường là key sai — không đưa nội dung phản hồi (có thể chứa key) ra ngoài.
      throw remoteUnavailable(
        'Pixabay từ chối yêu cầu. Kiểm tra lại PIXABAY_API_KEY.',
      );
    }
    const hits = parsePixabayHits(readJson(res.body));
    if (this.pixabayCache.size >= PIXABAY_CACHE_MAX) {
      this.pixabayCache.delete(this.pixabayCache.keys().next().value!);
    }
    this.pixabayCache.set(cacheKey, { at: Date.now(), hits });
    return hits;
  }
}

function readJson(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw remoteUnavailable(
      'Dịch vụ bên ngoài trả dữ liệu lạ. Thử lại sau nhé.',
    );
  }
}
