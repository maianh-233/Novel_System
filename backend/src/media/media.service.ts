import { Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { badRequest } from '../common/errors.js';
import { StorageService } from './storage.service.js';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 3 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'video/webm': 'webm', // ghi âm từ trình duyệt thường có kiểu này
};

/** Cạnh dài nhất của ảnh sau khi thu nhỏ — đủ nét cho thẻ game, nhẹ cho máy học sinh. */
const IMAGE_MAX_EDGE = 800;

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Nhận ảnh bất kỳ (jpg/png/webp/gif), kiểm tra nội dung thật của file (không tin đuôi file),
   * thu nhỏ, đổi sang WebP và bỏ metadata (EXIF, vị trí GPS...).
   */
  async saveImage(data: Buffer): Promise<{ url: string }> {
    const type = await fileTypeFromBuffer(data);
    if (!type || !IMAGE_TYPES.has(type.mime)) {
      throw badRequest(
        'unsupported_image',
        'Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF',
      );
    }
    let webp: Buffer;
    try {
      webp = await sharp(data, {
        animated: false,
        limitInputPixels: 50_000_000,
      })
        .rotate() // xoay đúng chiều theo EXIF trước khi bỏ EXIF
        .resize(IMAGE_MAX_EDGE, IMAGE_MAX_EDGE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw badRequest(
        'broken_image',
        'Không đọc được ảnh này. Thử lưu lại ảnh rồi tải lên.',
      );
    }
    return { url: await this.storage.save('images', 'webp', webp) };
  }

  async saveAudio(data: Buffer): Promise<{ url: string }> {
    const type = await fileTypeFromBuffer(data);
    const ext = type && AUDIO_TYPES[type.mime];
    if (!ext) {
      throw badRequest(
        'unsupported_audio',
        'Chỉ nhận âm thanh MP3, M4A, OGG, WAV hoặc WebM',
      );
    }
    return { url: await this.storage.save('audio', ext, data) };
  }
}
