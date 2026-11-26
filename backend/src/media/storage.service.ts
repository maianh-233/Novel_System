import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { Env } from '../config/env.js';

export type MediaKind = 'images' | 'audio';

/** URL công khai của file: /uploads/<kind>/<tên file>. */
export const UPLOADS_URL_PREFIX = '/uploads';

/**
 * Lưu file vào ổ đĩa của máy chủ. Khi triển khai thật có thể thay bằng
 * bản lưu lên S3/R2 với cùng hàm `save` (xem docs/PLAN.md mục 5).
 */
@Injectable()
export class StorageService {
  readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolveUploadDir(config.get('UPLOAD_DIR', { infer: true }));
  }

  async save(kind: MediaKind, ext: string, data: Buffer): Promise<string> {
    const name = `${randomUUID()}.${ext}`;
    const dir = join(this.root, kind);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), data, { flag: 'wx' });
    return `${UPLOADS_URL_PREFIX}/${kind}/${name}`;
  }
}

export function resolveUploadDir(dir: string): string {
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}
