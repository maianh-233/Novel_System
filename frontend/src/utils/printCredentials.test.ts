import { describe, expect, it } from 'vitest';
import { credentialsSheetHtml } from './printCredentials';

describe('credentialsSheetHtml', () => {
  it('mỗi em một phiếu, có tên đăng nhập + mật khẩu, tên được escape', () => {
    const html = credentialsSheetHtml(
      [
        {
          id: '1',
          displayName: 'An <b>',
          username: 'an12',
          password: 'cat123',
        },
        {
          id: '2',
          displayName: 'Bình',
          username: 'binh34',
          password: 'owl456',
        },
      ],
      'https://novel.example',
    );
    expect(html.match(/class="card"/g)).toHaveLength(2);
    expect(html).toContain('an12');
    expect(html).toContain('owl456');
    expect(html).toContain('An &lt;b&gt;');
    expect(html).not.toContain('An <b>');
    expect(html).toContain('https://novel.example/login');
  });
});
