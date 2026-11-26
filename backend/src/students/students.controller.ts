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
  studentBulkCreateSchema,
  studentUpdateSchema,
  type StudentBulkCreate,
  type StudentUpdate,
} from '@novel/shared';
import { StudentsService } from './students.service.js';

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
    return this.students.bulkCreate(body.names);
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
