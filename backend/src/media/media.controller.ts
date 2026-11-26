import {
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { badRequest } from '../common/errors.js';
import {
  AUDIO_MAX_BYTES,
  IMAGE_MAX_BYTES,
  MediaService,
} from './media.service.js';

/** Phần của file multer mà ta dùng (multer lưu file trong bộ nhớ). */
interface UploadedBinary {
  buffer: Buffer;
}

function requireFile(file: UploadedBinary | undefined): Buffer {
  if (!file?.buffer?.length) {
    throw badRequest('missing_file', 'Chưa chọn file (trường "file")');
  }
  return file.buffer;
}

// Nằm dưới /api/admin → chỉ giáo viên đã đăng nhập mới tải lên được.
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('images')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  uploadImage(@UploadedFile() file?: UploadedBinary) {
    return this.media.saveImage(requireFile(file));
  }

  @Post('audio')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AUDIO_MAX_BYTES, files: 1 },
    }),
  )
  uploadAudio(@UploadedFile() file?: UploadedBinary) {
    return this.media.saveAudio(requireFile(file));
  }
}
