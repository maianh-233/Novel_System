import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Đặt trước khi AppModule được import (ConfigModule đọc env lúc import):
    // file tải lên trong test không bao giờ lẫn vào thư mục uploads thật.
    env: { UPLOAD_DIR: join(tmpdir(), 'novel-e2e-uploads') },
  },
});
