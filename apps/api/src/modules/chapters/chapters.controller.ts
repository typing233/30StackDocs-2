import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('api')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Post('books/:bookId/chapters')
  @Roles('admin', 'editor')
  async create(
    @Param('bookId') bookId: string,
    @Body() dto: CreateChapterDto,
    @CurrentUser() user: any,
  ) {
    const chapter = await this.chaptersService.create(
      bookId, dto, user.id, user.tenantId, user.roles,
    );
    return { data: chapter };
  }

  @Get('books/:bookId/chapters')
  async findByBook(
    @Param('bookId') bookId: string,
    @CurrentUser() user: any,
  ) {
    const chapters = await this.chaptersService.findByBook(
      bookId, user.tenantId, user.id, user.roles,
    );
    return { data: chapters };
  }

  @Get('chapters/:id')
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const chapter = await this.chaptersService.findById(
      id, user.tenantId, user.id, user.roles,
    );
    return { data: chapter };
  }

  @Put('chapters/:id')
  @Roles('admin', 'editor')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChapterDto,
    @CurrentUser() user: any,
  ) {
    const chapter = await this.chaptersService.update(
      id, dto, user.id, user.tenantId, user.roles,
    );
    return { data: chapter };
  }

  @Put('books/:bookId/chapters/reorder')
  @Roles('admin', 'editor')
  async reorder(
    @Param('bookId') bookId: string,
    @Body() dto: ReorderChaptersDto,
    @CurrentUser() user: any,
  ) {
    await this.chaptersService.reorder(
      bookId, dto.orderedIds, user.tenantId, user.id, user.roles,
    );
    return { data: { message: 'Chapters reordered successfully' } };
  }

  @Delete('chapters/:id')
  @Roles('admin', 'editor')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.chaptersService.softDelete(id, user.tenantId, user.id, user.roles);
    return { data: { message: 'Chapter deleted successfully' } };
  }

  @Post('chapters/:id/restore')
  @Roles('admin')
  async restore(@Param('id') id: string, @CurrentUser() user: any) {
    await this.chaptersService.restore(id, user.tenantId);
    return { data: { message: 'Chapter restored successfully' } };
  }
}
