/**
 * Tạo chỉ mục tìm kiếm cho bộ hình Microsoft Fluent Emoji (giấy phép MIT):
 * tên + từ khoá + đường dẫn ảnh 3D của từng emoji, gắn với một commit cố định.
 *
 *   npx tsx scripts/build-emoji-index.ts
 *
 * Kết quả ghi vào src/media/fluent-emoji-index.ts (được commit vào repo) — máy chủ tìm kiếm
 * trên file này, chỉ gọi GitHub khi giáo viên thật sự chọn một hình.
 * Chạy lại khi muốn cập nhật lên phiên bản Fluent Emoji mới hơn.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REPO = 'microsoft/fluentui-emoji';
const OUT = resolve(import.meta.dirname, '../src/media/fluent-emoji-index.ts');

interface Meta {
  cldr?: string;
  glyph?: string;
  keywords?: string[];
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  const { sha } = await json<{ sha: string }>(
    `https://api.github.com/repos/${REPO}/commits/main`,
  );
  const tree = await json<{
    truncated: boolean;
    tree: Array<{ path: string; type: string }>;
  }>(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);
  if (tree.truncated)
    throw new Error('Cây thư mục bị cắt bớt — không đủ dữ liệu');

  // Ảnh 3D của mỗi emoji: assets/<Tên>/3D/x.png, hoặc assets/<Tên>/Default/3D/x.png với emoji có màu da.
  const image = new Map<string, string>();
  for (const { path } of tree.tree) {
    const m = /^assets\/([^/]+)\/(?:Default\/)?3D\/[^/]+\.png$/.exec(path);
    if (m && !image.has(m[1])) image.set(m[1], path.slice('assets/'.length));
  }

  const names = [...image.keys()].sort((a, b) => a.localeCompare(b));
  const rows: string[] = [];
  let next = 0;
  async function worker() {
    while (next < names.length) {
      const name = names[next++];
      const meta = await json<Meta>(
        `https://raw.githubusercontent.com/${REPO}/${sha}/assets/${encodeURIComponent(name)}/metadata.json`,
      ).catch(() => ({}) as Meta);
      const keywords = [...new Set([meta.cldr, ...(meta.keywords ?? [])])]
        .filter((k): k is string => !!k)
        .map((k) => k.toLowerCase())
        .join('|');
      rows.push(
        JSON.stringify([name, meta.glyph ?? '', keywords, image.get(name)]),
      );
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker));
  rows.sort();

  await writeFile(
    OUT,
    `// Tạo tự động bởi scripts/build-emoji-index.ts — đừng sửa tay.
// Microsoft Fluent Emoji — https://github.com/${REPO} — giấy phép MIT.

export const FLUENT_EMOJI_COMMIT = '${sha}';

/** [tên, ký tự emoji, từ khoá nối bằng "|", đường dẫn ảnh 3D trong thư mục assets/] */
export type FluentEmojiRow = [string, string, string, string];

export const FLUENT_EMOJI: FluentEmojiRow[] = [
${rows.join(',\n')},
];
`,
  );
  console.log(
    `Đã ghi ${rows.length} emoji (commit ${sha.slice(0, 7)}) → ${OUT}`,
  );
}

await main();
