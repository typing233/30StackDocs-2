import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { ExportJob } from './entities/export-job.entity';
import { Page } from '../pages/entities/page.entity';
import { Book } from '../books/entities/book.entity';
import { Chapter } from '../chapters/entities/chapter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExportJob, Page, Book, Chapter])],
  providers: [ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}
