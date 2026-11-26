import { Module } from '@nestjs/common';
import { PlayController } from './play.controller.js';
import { PlayService } from './play.service.js';

@Module({
  controllers: [PlayController],
  providers: [PlayService],
  exports: [PlayService],
})
export class PlayModule {}
