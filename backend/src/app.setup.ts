import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/** Cấu hình dùng chung cho main.ts và test e2e. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Kiểm tra body/query theo schema Zod khai báo ở @Body({ schema }).
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // Khi chạy sau reverse proxy cùng máy, lấy IP thật của người dùng cho rate limit.
  app.set('trust proxy', 'loopback');
}
