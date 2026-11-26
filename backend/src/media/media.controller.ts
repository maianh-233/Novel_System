import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  dictionaryLookupSchema,
  imageImportSchema,
  imageSearchSchema,
  type DictionaryLookupRequest,
  type ImageImportRequest,
} from '@novel/shared';
import type { z } from 'zod';
import { badRequest } from '../common/errors.js';
import {
  AUDIO_MAX_BYTES,
  IMAGE_MAX_BYTES,
  MediaService,
} from './media.service.js';
import { RemoteMediaService } from './remote-media.service.js';

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
  constructor(
    private readonly media: MediaService,
    private readonly remote: RemoteMediaService,
  ) {}

  /** Tìm ảnh minh hoạ: Fluent Emoji, hoặc Pixabay nếu máy chủ có key. */
  @Get('search')
  search(
    @Query({ schema: imageSearchSchema })
    query: z.output<typeof imageSearchSchema>,
  ) {
    return this.remote.searchImages(query.q, query.source, query.kind);
  }

  /** Tải ảnh đã chọn về máy chủ, trả về đường dẫn /uploads/images/... */
  @Post('import')
  @HttpCode(201)
  importImage(@Body({ schema: imageImportSchema }) body: ImageImportRequest) {
    return this.remote.importImage(body.source, body.id);
  }

  /** Tra phiên âm, câu ví dụ và tải file đọc về máy chủ. */
  @Post('dictionary')
  @HttpCode(200)
  dictionary(
    @Body({ schema: dictionaryLookupSchema }) body: DictionaryLookupRequest,
  ) {
    return this.remote.lookupDictionary(body.word);
  }

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
