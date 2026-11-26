import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  assignClassSchema,
  classCreateSchema,
  classUpdateSchema,
  studentBulkCreateSchema,
  studentUpdateSchema,
  type AssignClassRequest,
  type ClassUpdate,
  type StudentBulkCreate,
  type StudentUpdate,
} from '@novel/shared';
import type { z } from 'zod';
import { ClassesService } from './classes.service.js';
import { StudentsService } from './students.service.js';

// Dưới /api/admin/* → đã được AdminAuthGuard bảo vệ.
@Controller('admin/classes')
export class AdminClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  list() {
    return this.classes.list();
  }

  @Post()
  create(
    @Body({ schema: classCreateSchema })
    body: z.output<typeof classCreateSchema>,
  ) {
    return this.classes.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: classUpdateSchema }) body: ClassUpdate,
  ) {
    return this.classes.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.classes.remove(id);
  }
}

// Dưới /api/admin/* → đã được AdminAuthGuard bảo vệ.
@Controller('admin/students')
export class AdminStudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list() {
    return this.students.list();
  }

  @Post()
  create(@Body({ schema: studentBulkCreateSchema }) body: StudentBulkCreate) {
    return this.students.bulkCreate(body.names, body.classId ?? null);
  }

  // Đặt trước ':id' để "assign-class" không bị hiểu là một id.
  @Post('assign-class')
  @HttpCode(200)
  assignClass(@Body({ schema: assignClassSchema }) body: AssignClassRequest) {
    return this.students.assignClass(body.studentIds, body.classId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.students.get(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: studentUpdateSchema }) body: StudentUpdate,
  ) {
    return this.students.update(id, body);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@Param('id') id: string) {
    return this.students.resetPassword(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.students.remove(id);
  }
}
