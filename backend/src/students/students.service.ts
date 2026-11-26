import { Injectable } from '@nestjs/common';
import {
  findGame,
  type PlaySessionSummary,
  type StudentAdmin,
  type StudentCredentials,
  type StudentDetail,
  type StudentUpdate,
} from '@novel/shared';
import { conflict, isUniqueViolation, notFound } from '../common/errors.js';
import { hashPassword } from '../common/password.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  generateStudentPassword,
  usernameBase,
  usernameCandidate,
} from './credentials.js';

const MAX_USERNAME_ATTEMPTS = 60;

/** Đầu giây hiện tại — token cấp trong cùng giây (iat tính bằng giây) vẫn còn hợp lệ. */
const nowSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

export const finishedSessionInclude = {
  game: { select: { slug: true } },
  lesson: { select: { title: true } },
} satisfies Prisma.PlaySessionInclude;

type FinishedSessionRow = Prisma.PlaySessionGetPayload<{
  include: typeof finishedSessionInclude;
}>;

export function toSessionSummary(s: FinishedSessionRow): PlaySessionSummary {
  return {
    id: s.id,
    gameSlug: s.game.slug,
    gameName: findGame(s.game.slug)?.name ?? s.game.slug,
    lessonTitle: s.lesson.title,
    stars: s.stars,
    correctCount: s.correctCount,
    wrongCount: s.wrongCount,
    durationMs: s.durationMs,
    finishedAt: (s.finishedAt ?? s.startedAt).toISOString(),
  };
}

const listSelect = {
  id: true,
  displayName: true,
  username: true,
  isActive: true,
  totalStars: true,
  createdAt: true,
  _count: { select: { sessions: { where: { finishedAt: { not: null } } } } },
  sessions: {
    where: { finishedAt: { not: null } },
    orderBy: { finishedAt: 'desc' },
    take: 1,
    select: { finishedAt: true },
  },
} satisfies Prisma.StudentSelect;

type ListRow = Prisma.StudentGetPayload<{ select: typeof listSelect }>;

function toAdmin(s: ListRow): StudentAdmin {
  return {
    id: s.id,
    displayName: s.displayName,
    username: s.username,
    isActive: s.isActive,
    totalStars: s.totalStars,
    sessionCount: s._count.sessions,
    lastPlayedAt: s.sessions[0]?.finishedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<StudentAdmin[]> {
    const rows = await this.prisma.student.findMany({
      select: listSelect,
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    });
    return rows.map(toAdmin);
  }

  async get(id: string): Promise<StudentDetail> {
    const s = await this.prisma.student.findUnique({
      where: { id },
      select: listSelect,
    });
    if (!s) throw notFound('Không tìm thấy học sinh');
    const sessions = await this.prisma.playSession.findMany({
      where: { studentId: id, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      take: 100,
      include: finishedSessionInclude,
    });
    return { ...toAdmin(s), sessions: sessions.map(toSessionSummary) };
  }

  /**
   * Tạo nhiều tài khoản một lần. Mật khẩu chỉ trả về ở đây (và khi đặt lại) để giáo viên in phiếu —
   * database chỉ giữ bản băm.
   */
  async bulkCreate(names: string[]): Promise<StudentCredentials[]> {
    const created: StudentCredentials[] = [];
    for (const displayName of names) {
      const password = generateStudentPassword();
      const passwordHash = await hashPassword(password);
      const base = usernameBase(displayName);
      for (let attempt = 0; ; attempt++) {
        if (attempt >= MAX_USERNAME_ATTEMPTS) {
          throw conflict(
            'username_exhausted',
            `Không tìm được tên đăng nhập trống cho "${displayName}"`,
          );
        }
        const username = usernameCandidate(base, attempt);
        try {
          const s = await this.prisma.student.create({
            data: { displayName, username, passwordHash },
          });
          created.push({ id: s.id, displayName, username, password });
          break;
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
        }
      }
    }
    return created;
  }

  async update(id: string, data: StudentUpdate): Promise<StudentAdmin> {
    const s = await this.prisma.student.findUnique({ where: { id } });
    if (!s) throw notFound('Không tìm thấy học sinh');
    await this.prisma.student.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && {
          displayName: data.displayName,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        // Khoá tài khoản → đăng xuất em đó khỏi mọi máy.
        ...(data.isActive === false &&
          s.isActive && { passwordChangedAt: nowSecond() }),
      },
    });
    return (await this.listOne(id))!;
  }

  /** Đặt mật khẩu mới và đăng xuất em khỏi mọi máy. */
  async resetPassword(id: string): Promise<StudentCredentials> {
    const s = await this.prisma.student.findUnique({ where: { id } });
    if (!s) throw notFound('Không tìm thấy học sinh');
    const password = generateStudentPassword();
    await this.prisma.student.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: nowSecond(),
      },
    });
    return {
      id,
      displayName: s.displayName,
      username: s.username,
      password,
    };
  }

  /** Chỉ xoá được tài khoản chưa có lượt chơi nào — có rồi thì khoá để giữ lịch sử học tập. */
  async remove(id: string): Promise<void> {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: {
        _count: {
          select: { sessions: { where: { finishedAt: { not: null } } } },
        },
      },
    });
    if (!s) throw notFound('Không tìm thấy học sinh');
    if (s._count.sessions > 0) {
      throw conflict(
        'student_has_history',
        'Em này đã có lượt chơi nên không xoá được (để giữ lịch sử học tập). Hãy khoá tài khoản thay vì xoá.',
      );
    }
    await this.prisma.$transaction([
      // Lượt bắt đầu nhưng chưa xong không phải lịch sử học tập.
      this.prisma.playSession.deleteMany({ where: { studentId: id } }),
      this.prisma.student.delete({ where: { id } }),
    ]);
  }

  private async listOne(id: string): Promise<StudentAdmin | null> {
    const s = await this.prisma.student.findUnique({
      where: { id },
      select: listSelect,
    });
    return s && toAdmin(s);
  }
}
