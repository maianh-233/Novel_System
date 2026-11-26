import { Module } from '@nestjs/common';
import { PlayModule } from '../play/play.module.js';
import { AttemptsService } from './attempts.service.js';
import {
  AdminExamsController,
  PlayExamsController,
} from './exams.controller.js';
import { ExamsService } from './exams.service.js';

@Module({
  imports: [PlayModule],
  controllers: [AdminExamsController, PlayExamsController],
  providers: [ExamsService, AttemptsService],
})
export class ExamsModule {}
