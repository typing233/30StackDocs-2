import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { Page } from './entities/page.entity';
import { PageRevision } from './entities/page-revision.entity';
import { PageSanitizer } from './pages.sanitizer';

@Module({
  imports: [TypeOrmModule.forFeature([Page, PageRevision])],
  providers: [PagesService, PageSanitizer],
  controllers: [PagesController],
  exports: [PagesService],
})
export class PagesModule {}
