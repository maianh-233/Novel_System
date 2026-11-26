import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { ContentModule } from './content/content.module.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Giới hạn chung 120 request/phút/IP; route đăng nhập có giới hạn chặt hơn.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ContentModule,
    MediaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
