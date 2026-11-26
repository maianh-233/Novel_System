import { Injectable } from '@nestjs/common';
import type {
  CategoryAdmin,
  CategoryCreate,
  CategoryUpdate,
  PublicCategory,
} from '@novel/shared';
import {
  badRequest,
  conflict,
  isUniqueViolation,
  notFound,
} from '../common/errors.js';
import { slugify } from '../common/slug.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CategoryAdmin[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { words: true } } },
    });
    return rows.map(({ _count, createdAt: _c, updatedAt: _u, ...c }) => ({
      ...c,
      wordCount: _count.words,
    }));
  }

  /** Chủ đề hiển thị cho học sinh: không bị ẩn, đếm số từ đang dùng. */
  async listPublic(): Promise<PublicCategory[]> {
    const rows = await this.prisma.category.findMany({
      where: { isHidden: false },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { words: { where: { status: 'ACTIVE' } } } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      wordCount: c._count.words,
    }));
  }

  async create(input: CategoryCreate): Promise<CategoryAdmin> {
    const slug = slugify(input.name);
    if (!slug)
      throw badRequest('invalid_name', 'Tên chủ đề cần có chữ hoặc số');
    const last = await this.prisma.category.aggregate({
      _max: { order: true },
    });
    try {
      const c = await this.prisma.category.create({
        data: {
          name: input.name,
          icon: input.icon ?? null,
          slug,
          order: (last._max.order ?? -1) + 1,
        },
      });
      return { ...pick(c), wordCount: 0 };
    } catch (e) {
      if (isUniqueViolation(e))
        throw conflict('duplicate_category', `Đã có chủ đề "${input.name}"`);
      throw e;
    }
  }

  async update(id: string, input: CategoryUpdate): Promise<CategoryAdmin> {
    await this.ensureExists(id);
    try {
      const c = await this.prisma.category.update({
        where: { id },
        data: {
          ...(input.name !== undefined && {
            name: input.name,
            slug: slugify(input.name),
          }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.isHidden !== undefined && { isHidden: input.isHidden }),
        },
        include: { _count: { select: { words: true } } },
      });
      return { ...pick(c), wordCount: c._count.words };
    } catch (e) {
      if (isUniqueViolation(e))
        throw conflict('duplicate_category', `Đã có chủ đề "${input.name}"`);
      throw e;
    }
  }

  /** Sắp xếp lại theo thứ tự `ids` (chủ đề đầu tiên hiện trước). */
  async reorder(ids: string[]): Promise<void> {
    const found = await this.prisma.category.count({
      where: { id: { in: ids } },
    });
    if (found !== new Set(ids).size) {
      throw badRequest('unknown_category', 'Có chủ đề không tồn tại');
    }
    await this.prisma.$transaction(
      ids.map((id, order) =>
        this.prisma.category.update({ where: { id }, data: { order } }),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    const words = await this.prisma.vocabulary.count({
      where: { categoryId: id },
    });
    if (words > 0) {
      throw conflict(
        'category_not_empty',
        `Chủ đề còn ${words} từ vựng. Chuyển các từ sang chủ đề khác, hoặc ẩn chủ đề thay vì xoá.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.category.count({ where: { id } });
    if (!exists) throw notFound('Không tìm thấy chủ đề');
  }
}

function pick(c: {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  isHidden: boolean;
  order: number;
}) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    isHidden: c.isHidden,
    order: c.order,
  };
}
