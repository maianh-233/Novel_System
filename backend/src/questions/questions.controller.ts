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
  Query,
} from '@nestjs/common';
import {
  passageInputSchema,
  questionImportSchema,
  questionInputSchema,
  questionQuerySchema,
  questionStatusSchema,
  type PassageInput,
  type QuestionData,
} from '@novel/shared';
import type { z } from 'zod';
import { PassagesService } from './passages.service.js';
import { QuestionsService } from './questions.service.js';

// Dưới /api/admin/* → đã được AdminAuthGuard bảo vệ.
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(
    @Query({ schema: questionQuerySchema })
    query: z.output<typeof questionQuerySchema>,
  ) {
    return this.questions.list(query);
  }

  // Đặt trước ':id' để "tags" / "import" không bị hiểu là một id.
  @Get('tags')
  tags() {
    return this.questions.tags();
  }

  @Post('import')
  @HttpCode(200)
  import(
    @Body({ schema: questionImportSchema })
    body: z.output<typeof questionImportSchema>,
  ) {
    return this.questions.import(
      body.format,
      body.content,
      body.defaults,
      body.dryRun,
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.questions.get(id);
  }

  @Post()
  create(@Body({ schema: questionInputSchema }) body: QuestionData) {
    return this.questions.create(body);
  }

  @Put(':id')
  replace(
    @Param('id') id: string,
    @Body({ schema: questionInputSchema }) body: QuestionData,
  ) {
    return this.questions.replace(id, body);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body({ schema: questionStatusSchema })
    body: z.output<typeof questionStatusSchema>,
  ) {
    return this.questions.setStatus(id, body.status);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.questions.remove(id);
  }
}

@Controller('admin/passages')
export class AdminPassagesController {
  constructor(private readonly passages: PassagesService) {}

  @Get()
  list() {
    return this.passages.list();
  }

  @Post()
  create(@Body({ schema: passageInputSchema }) body: PassageInput) {
    return this.passages.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: passageInputSchema }) body: PassageInput,
  ) {
    return this.passages.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.passages.remove(id);
  }
}
