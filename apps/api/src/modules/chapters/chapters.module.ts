import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChaptersService } from './chapters.service';
import { ChaptersController } from './chapters.controller';
import { Chapter } from './entities/chapter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chapter])],
  providers: [ChaptersService],
  controllers: [ChaptersController],
  exports: [ChaptersService],
})
export class ChaptersModule {}
