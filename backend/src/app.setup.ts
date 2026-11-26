import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Env } from './config/env.js';
import {
  resolveUploadDir,
  UPLOADS_URL_PREFIX,
} from './media/storage.service.js';

/** Cấu hình dùng chung cho main.ts và test e2e. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Kiểm tra body/query theo schema Zod khai báo ở @Body({ schema }).
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // Khi chạy sau reverse proxy cùng máy, lấy IP thật của người dùng cho rate limit.
  app.set('trust proxy', 'loopback');

  // Ảnh/âm thanh đã tải lên. Tên file là UUID ngẫu nhiên → cache lâu được.
  app.useStaticAssets(
    resolveUploadDir(config.get('UPLOAD_DIR', { infer: true })),
    {
      prefix: `${UPLOADS_URL_PREFIX}/`,
      maxAge: '30d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    },
  );
}
