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
  categoryCreateSchema,
  categoryUpdateSchema,
  gameUpdateSchema,
  lessonInputSchema,
  lessonUpdateSchema,
  lessonWordsSchema,
  reorderSchema,
  vocabularyImportSchema,
  vocabularyInputSchema,
  vocabularyQuerySchema,
  vocabularyUpdateSchema,
  type CategoryCreate,
  type CategoryUpdate,
  type LessonWordsRequest,
  type ReorderRequest,
} from '@novel/shared';
import type { z } from 'zod';
import { CategoriesService } from './categories.service.js';
import { GamesService } from './games.service.js';
import { LessonsService } from './lessons.service.js';
import { VocabularyService } from './vocabulary.service.js';

// Mọi route dưới /api/admin/* đều đã được AdminAuthGuard bảo vệ.

@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body({ schema: categoryCreateSchema }) body: CategoryCreate) {
    return this.categories.create(body);
  }

  // Đặt trước ':id' để "order" không bị hiểu là một id.
  @Put('order')
  @HttpCode(204)
  reorder(@Body({ schema: reorderSchema }) body: ReorderRequest) {
    return this.categories.reorder(body.ids);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: categoryUpdateSchema }) body: CategoryUpdate,
  ) {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}

@Controller('admin/vocabulary')
export class AdminVocabularyController {
  constructor(private readonly vocabulary: VocabularyService) {}

  @Get()
  list(
    @Query({ schema: vocabularyQuerySchema })
    query: z.output<typeof vocabularyQuerySchema>,
  ) {
    return this.vocabulary.list(query);
  }

  @Post('import')
  @HttpCode(200)
  import(
    @Body({ schema: vocabularyImportSchema })
    body: z.output<typeof vocabularyImportSchema>,
  ) {
    return this.vocabulary.import(
      body.csv,
      body.dryRun,
      body.defaultCategoryId,
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.vocabulary.get(id);
  }

  @Post()
  create(
    @Body({ schema: vocabularyInputSchema })
    body: z.output<typeof vocabularyInputSchema>,
  ) {
    return this.vocabulary.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: vocabularyUpdateSchema })
    body: z.output<typeof vocabularyUpdateSchema>,
  ) {
    return this.vocabulary.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.vocabulary.remove(id);
  }
}

@Controller('admin/lessons')
export class AdminLessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  list() {
    return this.lessons.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.lessons.get(id);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string) {
    return this.lessons.preview(id);
  }

  @Post()
  create(
    @Body({ schema: lessonInputSchema })
    body: z.output<typeof lessonInputSchema>,
  ) {
    return this.lessons.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: lessonUpdateSchema })
    body: z.output<typeof lessonUpdateSchema>,
  ) {
    return this.lessons.update(id, body);
  }

  @Put(':id/words')
  setWords(
    @Param('id') id: string,
    @Body({ schema: lessonWordsSchema }) body: LessonWordsRequest,
  ) {
    return this.lessons.setWords(id, body.vocabularyIds);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.lessons.remove(id);
  }
}

@Controller('admin/games')
export class AdminGamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  list() {
    return this.games.list();
  }

  @Patch(':slug')
  update(
    @Param('slug') slug: string,
    @Body({ schema: gameUpdateSchema })
    body: z.output<typeof gameUpdateSchema>,
  ) {
    return this.games.update(slug, body);
  }
}

/** Nội dung công khai cho khu học sinh. */
@Controller('content')
export class PublicContentController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('categories')
  categoriesList() {
    return this.categories.listPublic();
  }
}
