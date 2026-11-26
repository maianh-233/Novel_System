import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { StudentAuthController } from './student-auth.controller.js';
import { StudentAuthGuard } from './student-auth.guard.js';
import { StudentAuthService } from './student-auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [StudentAuthController],
  providers: [
    StudentAuthService,
    { provide: APP_GUARD, useClass: StudentAuthGuard },
  ],
})
export class StudentAuthModule {}
