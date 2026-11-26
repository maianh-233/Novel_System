import type { StudentCredentials } from '@novel/shared';

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

/** HTML trang in phiếu đăng nhập: mỗi em một phiếu, cắt rời được. */
export function credentialsSheetHtml(
  list: StudentCredentials[],
  siteUrl: string,
): string {
  const cards = list
    .map(
      (c) => `<div class="card">
  <p class="name">${escapeHtml(c.displayName)}</p>
  <p><span>Tên đăng nhập</span><b>${escapeHtml(c.username)}</b></p>
  <p><span>Mật khẩu</span><b>${escapeHtml(c.password)}</b></p>
  <p class="site">Vào chơi tại: ${escapeHtml(siteUrl)}/login</p>
</div>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Phiếu đăng nhập Novel Game</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 12mm; color: #1e2a5a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .card { border: 2px dashed #1e2a5a; border-radius: 4mm; padding: 5mm 6mm; break-inside: avoid; }
  .name { font-size: 15pt; font-weight: 700; margin: 0 0 3mm; }
  p { margin: 1.5mm 0; display: flex; justify-content: space-between; gap: 4mm; }
  p span { color: #555; }
  p b { font-family: ui-monospace, Consolas, monospace; font-size: 14pt; letter-spacing: .5px; }
  .site { font-size: 9pt; color: #777; margin-top: 3mm; }
</style></head>
<body><div class="grid">${cards}</div>
<script>window.addEventListener('load', () => window.print());</script>
</body></html>`;
}

/** Mở cửa sổ mới chứa phiếu và hộp thoại in. Trả về false nếu trình duyệt chặn cửa sổ bật lên. */
export function printCredentials(list: StudentCredentials[]): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(credentialsSheetHtml(list, window.location.origin));
  w.document.close();
  return true;
}
