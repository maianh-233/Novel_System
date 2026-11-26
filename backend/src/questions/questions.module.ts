import { Module } from '@nestjs/common';
import {
  AdminPassagesController,
  AdminQuestionsController,
} from './questions.controller.js';
import { PassagesService } from './passages.service.js';
import { QuestionsService } from './questions.service.js';

@Module({
  controllers: [AdminQuestionsController, AdminPassagesController],
  providers: [QuestionsService, PassagesService],
})
export class QuestionsModule {}
