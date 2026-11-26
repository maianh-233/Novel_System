import { Injectable } from '@nestjs/common';
import type { PassageAdmin, PassageInput } from '@novel/shared';
import { conflict, notFound } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const include = {
  _count: { select: { questions: true } },
} satisfies Prisma.PassageInclude;

type Row = Prisma.PassageGetPayload<{ include: typeof include }>;

const toAdmin = (p: Row): PassageAdmin => ({
  id: p.id,
  title: p.title,
  text: p.text,
  questionCount: p._count.questions,
  updatedAt: p.updatedAt.toISOString(),
});

@Injectable()
export class PassagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PassageAdmin[]> {
    const rows = await this.prisma.passage.findMany({
      include,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toAdmin);
  }

  async create(data: PassageInput): Promise<PassageAdmin> {
    const p = await this.prisma.passage.create({ data, include });
    return toAdmin(p);
  }

  async update(id: string, data: PassageInput): Promise<PassageAdmin> {
    await this.ensureExists(id);
    const p = await this.prisma.passage.update({
      where: { id },
      data,
      include,
    });
    return toAdmin(p);
  }

  /** Đoạn văn còn câu hỏi thì không xoá (câu hỏi sẽ mất ngữ cảnh). */
  async remove(id: string): Promise<void> {
    const p = await this.prisma.passage.findUnique({ where: { id }, include });
    if (!p) throw notFound('Không tìm thấy đoạn văn');
    if (p._count.questions > 0) {
      throw conflict(
        'passage_in_use',
        `Đoạn văn còn ${p._count.questions} câu hỏi. Xoá hoặc chuyển các câu đó trước.`,
      );
    }
    await this.prisma.passage.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.passage.count({ where: { id } });
    if (!n) throw notFound('Không tìm thấy đoạn văn');
  }
}
