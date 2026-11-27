import { Module } from '@nestjs/common';
import { ExamsModule } from '../exams/exams.module.js';
import {
  AdminAssignmentsController,
  PlayAssignmentsController,
} from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';

@Module({
  imports: [ExamsModule],
  controllers: [AdminAssignmentsController, PlayAssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
