import { Module } from '@nestjs/common';
import { AdminStudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

@Module({
  controllers: [AdminStudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
