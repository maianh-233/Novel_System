import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import {
  AdminCategoriesController,
  AdminGamesController,
  AdminLessonsController,
  AdminVocabularyController,
  PublicContentController,
} from './content.controllers.js';
import { GamesService } from './games.service.js';
import { LessonsService } from './lessons.service.js';
import { VocabularyService } from './vocabulary.service.js';

@Module({
  controllers: [
    AdminCategoriesController,
    AdminVocabularyController,
    AdminLessonsController,
    AdminGamesController,
    PublicContentController,
  ],
  providers: [
    CategoriesService,
    VocabularyService,
    LessonsService,
    GamesService,
  ],
  exports: [LessonsService, GamesService],
})
export class ContentModule {}
