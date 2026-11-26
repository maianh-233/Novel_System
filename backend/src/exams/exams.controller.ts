import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  examCreateSchema,
  examStructureSchema,
  examUpdateSchema,
  saveAnswerSchema,
  type ExamStructure,
} from '@novel/shared';
import type { z } from 'zod';
import { CurrentStudent } from '../student-auth/decorators.js';
import type { AuthenticatedStudent } from '../student-auth/student-auth.service.js';
import { AttemptsService } from './attempts.service.js';
import { ExamsService } from './exams.service.js';

// Dưới /api/admin/* → đã được AdminAuthGuard bảo vệ.
@Controller('admin/exams')
export class AdminExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list() {
    return this.exams.list();
  }

  @Post()
  create(
    @Body({ schema: examCreateSchema })
    body: z.output<typeof examCreateSchema>,
  ) {
    return this.exams.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.exams.get(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: examUpdateSchema })
    body: z.output<typeof examUpdateSchema>,
  ) {
    return this.exams.update(id, body);
  }

  @Put(':id/structure')
  setStructure(
    @Param('id') id: string,
    @Body({ schema: examStructureSchema }) body: ExamStructure,
  ) {
    return this.exams.setStructure(id, body);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.exams.duplicate(id);
  }

  @Get(':id/results')
  results(@Param('id') id: string) {
    return this.exams.results(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.exams.remove(id);
  }
}

// Dưới /api/play/* → đã được StudentAuthGuard bảo vệ: tài khoản bị khoá thì mọi request
// (kể cả tự lưu và nộp bài) đều bị từ chối.
@Controller('play')
export class PlayExamsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('exams')
  list(@CurrentStudent() s: AuthenticatedStudent) {
    return this.attempts.listForStudent(s.id);
  }

  @Post('exams/:id/attempts')
  @HttpCode(200)
  start(@CurrentStudent() s: AuthenticatedStudent, @Param('id') id: string) {
    return this.attempts.start(s.id, id);
  }

  @Get('attempts/:id')
  get(@CurrentStudent() s: AuthenticatedStudent, @Param('id') id: string) {
    return this.attempts.get(s.id, id);
  }

  @Put('attempts/:id/answers/:itemId')
  save(
    @CurrentStudent() s: AuthenticatedStudent,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body({ schema: saveAnswerSchema })
    body: z.output<typeof saveAnswerSchema>,
  ) {
    return this.attempts.saveAnswer(
      s.id,
      id,
      itemId,
      body.response,
      body.flagged,
    );
  }

  @Post('attempts/:id/submit')
  @HttpCode(200)
  submit(@CurrentStudent() s: AuthenticatedStudent, @Param('id') id: string) {
    return this.attempts.submit(s.id, id);
  }
}
