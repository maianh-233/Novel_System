/**
 * Đọc kết quả của Free Dictionary API (https://dictionaryapi.dev, miễn phí, không cần key).
 * File phát âm do người thật đọc, gốc ở Wikimedia Commons. Máy chủ file của dictionaryapi.dev
 * hay chặn tải về, nên ta lấy file thẳng từ Commons (bản MP3 Commons chuyển sẵn — iPad phát được).
 */

interface Phonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
  license?: { name?: string };
}

interface Entry {
  word?: string;
  phonetic?: string;
  phonetics?: Phonetic[];
  meanings?: Array<{
    definitions?: Array<{ example?: string }>;
  }>;
}

export interface DictionaryInfo {
  ipa: string | null;
  example: string | null;
  /** File đọc trên máy chủ dictionaryapi.dev (dự phòng). */
  audioSourceUrl: string | null;
  /** Mã trang của file đọc trên Wikimedia Commons (cách tải chính). */
  commonsPageId: string | null;
  audioCredit: string | null;
}

export const COMMONS_API_HOST = 'commons.wikimedia.org';

/** Lấy mã trang Commons từ sourceUrl dạng ".../index.php?curid=9014290". */
function commonsPageId(sourceUrl: string | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    const u = new URL(sourceUrl);
    const id = u.searchParams.get('curid');
    return u.hostname === COMMONS_API_HOST && id && /^\d{1,12}$/.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

/** URL hỏi Commons thông tin file: link gốc + các bản chuyển định dạng. */
export function commonsInfoUrl(pageId: string): string {
  const params = new URLSearchParams({
    action: 'query',
    pageids: pageId,
    prop: 'videoinfo',
    viprop: 'url|derivatives',
    format: 'json',
  });
  return `https://${COMMONS_API_HOST}/w/api.php?${params}`;
}

interface CommonsVideoInfo {
  url?: string;
  derivatives?: Array<{ src?: string; type?: string }>;
}

/** Từ trả lời của Commons: ưu tiên bản MP3, không có thì file gốc. Chỉ nhận link upload.wikimedia.org. */
export function parseCommonsAudio(data: unknown): string | null {
  const pages = (data as { query?: { pages?: Record<string, unknown> } } | null)
    ?.query?.pages;
  const page = pages
    ? (Object.values(pages)[0] as
        { videoinfo?: CommonsVideoInfo[] } | undefined)
    : undefined;
  const info = page?.videoinfo?.[0];
  const candidates = [
    info?.derivatives?.find((d) => d.type === 'audio/mpeg')?.src,
    info?.url,
  ];
  return candidates.find((u): u is string => !!u && isUploadHost(u)) ?? null;
}

function isUploadHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'upload.wikimedia.org';
  } catch {
    return false;
  }
}

/** Chỉ tải âm thanh từ các máy chủ này (chống bị lừa tải file từ nơi khác). */
export const DICTIONARY_AUDIO_HOSTS = [
  'api.dictionaryapi.dev',
  'upload.wikimedia.org',
];

// Ưu tiên giọng Mỹ (hợp với giọng đọc dự phòng en-US của trình duyệt), rồi Anh, Úc, Canada.
const ACCENTS = ['-us', '-uk', '-au', '-ca'];

function accentRank(audio: string): number {
  const name = audio.toLowerCase().replace(/\.(mp3|ogg|wav)$/, '');
  const i = ACCENTS.findIndex((a) => name.endsWith(a));
  return i === -1 ? ACCENTS.length : i;
}

function isAllowedAudio(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' && DICTIONARY_AUDIO_HOSTS.includes(u.hostname)
    );
  } catch {
    return false;
  }
}

/** IPA dạng "/…/" — từ điển đôi khi dùng "[…]" (phiên âm hẹp) thì đổi về "/…/" cho đồng bộ. */
function normalizeIpa(text: string | undefined): string | null {
  const t = text?.trim();
  if (!t) return null;
  const inner = t.replace(/^[/[]|[/\]]$/g, '');
  return inner ? `/${inner}/` : null;
}

const MAX_EXAMPLE = 120;
const MIN_EXAMPLE_WORDS = 4;

/**
 * Chỉ nhận câu ví dụ là câu hoàn chỉnh, ngắn: viết hoa đầu câu, có dấu câu cuối, ít nhất 4 từ.
 * Từ điển hay đưa cụm từ chuyên ngành ("city desk", "butterfly tape") — không hợp với trẻ nhỏ.
 */
export function isKidFriendlyExample(ex: string, wordRe: RegExp): boolean {
  return (
    ex.length <= MAX_EXAMPLE &&
    /^[A-Z"']/.test(ex) &&
    /[.!?]["']?$/.test(ex) &&
    ex.split(/\s+/).length >= MIN_EXAMPLE_WORDS &&
    wordRe.test(ex)
  );
}

/**
 * Lấy phiên âm, câu ví dụ và file đọc tốt nhất cho `word` từ dữ liệu API trả về.
 * Câu ví dụ phải chứa đúng từ đó và là câu hoàn chỉnh — giáo viên vẫn luôn xem lại trước khi lưu.
 */
export function parseDictionary(word: string, data: unknown): DictionaryInfo {
  const entries = (Array.isArray(data) ? data : []) as Entry[];
  const target = word.trim().toLowerCase();
  const matching = entries.filter(
    (e) => (e.word ?? '').toLowerCase() === target,
  );
  const list = matching.length ? matching : entries;
  const phonetics = list.flatMap((e) => e.phonetics ?? []);

  const withAudio = phonetics
    .filter((p) => p.audio && isAllowedAudio(p.audio))
    .sort((a, b) => accentRank(a.audio!) - accentRank(b.audio!));
  const audio = withAudio[0];

  const ipa =
    normalizeIpa(audio?.text) ??
    normalizeIpa(phonetics.find((p) => p.text)?.text) ??
    normalizeIpa(list.find((e) => e.phonetic)?.phonetic);

  const wordRe = new RegExp(
    `\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'i',
  );
  const example =
    list
      .flatMap((e) => e.meanings ?? [])
      .flatMap((m) => m.definitions ?? [])
      .map((d) => d.example?.trim())
      .find((ex): ex is string => !!ex && isKidFriendlyExample(ex, wordRe)) ??
    null;

  const license = audio?.license?.name;
  return {
    ipa,
    example,
    audioSourceUrl: audio?.audio ?? null,
    commonsPageId: commonsPageId(audio?.sourceUrl),
    audioCredit: audio
      ? `Wiktionary${license ? ` (CC ${license})` : ''}`
      : null,
  };
}
