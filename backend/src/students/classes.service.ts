import { Injectable } from '@nestjs/common';
import {
  stageOfGrade,
  type ClassGroupAdmin,
  type ClassGroupRef,
  type ClassUpdate,
} from '@novel/shared';
import { badRequest, conflict, notFound } from '../common/errors.js';
import type { ClassGroup } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const toClassRef = (c: ClassGroup): ClassGroupRef => ({
  id: c.id,
  name: c.name,
  grade: c.grade,
  stage: c.stage,
  isArchived: c.isArchived,
});

/** So tên lớp không phân biệt hoa thường và khoảng trắng: "7a" trùng "7A". */
const nameKey = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ClassGroupAdmin[]> {
    const rows = await this.prisma.classGroup.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: [{ isArchived: 'asc' }, { grade: 'asc' }, { name: 'asc' }],
    });
    return rows.map((c) => ({
      ...toClassRef(c),
      studentCount: c._count.students,
    }));
  }

  async create(data: {
    name: string;
    grade: number;
  }): Promise<ClassGroupAdmin> {
    await this.ensureNameFree(data.name);
    const c = await this.prisma.classGroup.create({
      data: { ...data, stage: stageOfGrade(data.grade) },
    });
    return { ...toClassRef(c), studentCount: 0 };
  }

  async update(id: string, data: ClassUpdate): Promise<ClassGroupAdmin> {
    const c = await this.prisma.classGroup.findUnique({ where: { id } });
    if (!c) throw notFound('Không tìm thấy lớp');
    const unarchiving = data.isArchived === false && c.isArchived;
    if (data.name !== undefined || unarchiving) {
      await this.ensureNameFree(data.name ?? c.name, id);
    }
    const grade = data.grade === undefined ? undefined : Number(data.grade);
    await this.prisma.classGroup.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(grade !== undefined && { grade, stage: stageOfGrade(grade) }),
        ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
      },
    });
    return (await this.list()).find((x) => x.id === id)!;
  }

  /** Chỉ xoá được lớp trống — lớp đã có em thì lưu trữ, để không mất thông tin lớp của các em. */
  async remove(id: string): Promise<void> {
    const c = await this.prisma.classGroup.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!c) throw notFound('Không tìm thấy lớp');
    if (c._count.students > 0) {
      throw conflict(
        'class_not_empty',
        'Lớp còn học sinh nên không xoá được. Hãy lưu trữ lớp, hoặc chuyển các em sang lớp khác trước.',
      );
    }
    await this.prisma.classGroup.delete({ where: { id } });
  }

  /** Lớp đích khi tạo tài khoản / xếp lớp: phải có thật và chưa lưu trữ. */
  async ensureAssignable(classId: string): Promise<void> {
    const c = await this.prisma.classGroup.findUnique({
      where: { id: classId },
    });
    if (!c) throw badRequest('unknown_class', 'Lớp không tồn tại');
    if (c.isArchived) {
      throw conflict(
        'class_archived',
        `Lớp ${c.name} đã lưu trữ, không xếp thêm học sinh được`,
      );
    }
  }

  /** Không cho hai lớp đang dùng trùng tên (lớp đã lưu trữ thì được — năm sau lại có 7A). */
  private async ensureNameFree(name: string, exceptId?: string) {
    const active = await this.prisma.classGroup.findMany({
      where: { isArchived: false, ...(exceptId && { id: { not: exceptId } }) },
      select: { name: true },
    });
    if (active.some((c) => nameKey(c.name) === nameKey(name))) {
      throw conflict('class_name_taken', `Đã có lớp ${name.trim()} rồi`);
    }
  }
}
