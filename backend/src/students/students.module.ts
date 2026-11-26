import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service.js';
import {
  AdminClassesController,
  AdminStudentsController,
} from './students.controller.js';
import { StudentsService } from './students.service.js';

@Module({
  controllers: [AdminClassesController, AdminStudentsController],
  providers: [StudentsService, ClassesService],
})
export class StudentsModule {}
