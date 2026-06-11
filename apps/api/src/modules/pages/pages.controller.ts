import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';
import { AutoSaveDto } from './dto/auto-save.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('api/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @Roles('admin', 'editor')
  async create(@Body() dto: CreatePageDto, @CurrentUser() user: any) {
    const page = await this.pagesService.create(dto, user.id, user.tenantId);
    return { data: page };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    const page = await this.pagesService.findBySlug(slug, user.tenantId);
    return { data: page };
  }

  @Put(':id')
  @Roles('admin', 'editor')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: any,
  ) {
    const page = await this.pagesService.update(
      id,
      dto,
      user.id,
      user.tenantId,
    );
    return { data: page };
  }

  @Patch(':id/draft')
  @Roles('admin', 'editor')
  async saveDraft(
    @Param('id') id: string,
    @Body() dto: AutoSaveDto,
    @CurrentUser() user: any,
  ) {
    await this.pagesService.saveDraft(id, dto, user.id, user.tenantId);
    return { data: { message: 'Draft saved' } };
  }

  @Put(':id/move')
  @Roles('admin', 'editor')
  async move(
    @Param('id') id: string,
    @Body() dto: MovePageDto,
    @CurrentUser() user: any,
  ) {
    const page = await this.pagesService.move(id, dto, user.id, user.tenantId);
    return { data: page };
  }

  @Get(':id/revisions')
  async getRevisions(@Param('id') id: string, @CurrentUser() user: any) {
    const revisions = await this.pagesService.getRevisions(id, user.tenantId);
    return { data: revisions };
  }

  @Get(':id/revisions/:revId')
  async getRevision(
    @Param('id') id: string,
    @Param('revId') revId: string,
    @CurrentUser() user: any,
  ) {
    const revision = await this.pagesService.getRevision(
      id,
      revId,
      user.tenantId,
    );
    return { data: revision };
  }

  @Get(':id/diff')
  async getDiff(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: any,
  ) {
    const diff = await this.pagesService.getDiff(
      id,
      parseInt(from, 10),
      parseInt(to, 10),
      user.tenantId,
    );
    return { data: diff };
  }

  @Post(':id/rollback/:revId')
  @Roles('admin', 'editor')
  async rollback(
    @Param('id') id: string,
    @Param('revId') revId: string,
    @CurrentUser() user: any,
  ) {
    const page = await this.pagesService.rollback(
      id,
      revId,
      user.id,
      user.tenantId,
    );
    return { data: page };
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.pagesService.softDelete(id, user.tenantId);
    return { data: { message: 'Page deleted successfully' } };
  }

  @Post(':id/restore')
  @Roles('admin')
  async restore(@Param('id') id: string, @CurrentUser() user: any) {
    await this.pagesService.restore(id, user.tenantId);
    return { data: { message: 'Page restored successfully' } };
  }
}
