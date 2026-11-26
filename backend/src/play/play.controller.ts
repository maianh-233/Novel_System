import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  finishSessionSchema,
  startSessionSchema,
  type FinishSessionRequest,
  type StartSessionRequest,
} from '@novel/shared';
import { CurrentStudent } from '../student-auth/decorators.js';
import type { AuthenticatedStudent } from '../student-auth/student-auth.service.js';
import { PlayService } from './play.service.js';

// Dưới /api/play/* → đã được StudentAuthGuard bảo vệ.
@Controller('play')
export class PlayController {
  constructor(private readonly play: PlayService) {}

  @Get('games/:slug')
  game(@Param('slug') slug: string) {
    return this.play.gameInfo(slug);
  }

  @Post('sessions')
  start(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body({ schema: startSessionSchema }) body: StartSessionRequest,
  ) {
    return this.play.start(student.id, body.gameSlug, body.lessonId);
  }

  @Post('sessions/:id/finish')
  @HttpCode(200)
  finish(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id') id: string,
    @Body({ schema: finishSessionSchema }) body: FinishSessionRequest,
  ) {
    return this.play.finish(student.id, id, body);
  }

  @Get('sessions')
  history(@CurrentStudent() student: AuthenticatedStudent) {
    return this.play.history(student.id);
  }
}
