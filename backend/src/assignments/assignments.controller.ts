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
import { assignmentCreateSchema, assignmentUpdateSchema } from '@novel/shared';
import type { z } from 'zod';
import { CurrentStudent } from '../student-auth/decorators.js';
import type { AuthenticatedStudent } from '../student-auth/student-auth.service.js';
import { AssignmentsService } from './assignments.service.js';

// Dưới /api/admin/* → đã được AdminAuthGuard bảo vệ.
@Controller('admin/assignments')
export class AdminAssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  list() {
    return this.assignments.list();
  }

  /** Unit + game giao được (đặt trước `:id` để không bị hiểu là một id). */
  @Get('options/lessons')
  lessons() {
    return this.assignments.assignableLessons();
  }

  @Post()
  create(
    @Body({ schema: assignmentCreateSchema })
    body: z.output<typeof assignmentCreateSchema>,
  ) {
    return this.assignments.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.assignments.get(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body({ schema: assignmentUpdateSchema })
    body: z.output<typeof assignmentUpdateSchema>,
  ) {
    return this.assignments.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.assignments.remove(id);
  }
}

// Dưới /api/play/* → đã được StudentAuthGuard bảo vệ.
@Controller('play/assignments')
export class PlayAssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  list(@CurrentStudent() s: AuthenticatedStudent) {
    return this.assignments.listForStudent(s.id);
  }
}
