import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('api/books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @Roles('admin', 'editor')
  async create(@Body() dto: CreateBookDto, @CurrentUser() user: any) {
    const book = await this.booksService.create(dto, user.id, user.tenantId);
    return { data: book };
  }

  @Get()
  async findAll(@Query() query: PaginationDto, @CurrentUser() user: any) {
    const isAdmin = user.roles.includes('admin');
    return this.booksService.findAll(user.tenantId, query, user.id, isAdmin);
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    const book = await this.booksService.findBySlug(slug, user.tenantId);
    return { data: book };
  }

  @Put(':id')
  @Roles('admin', 'editor')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @CurrentUser() user: any,
  ) {
    const book = await this.booksService.update(id, dto, user.id, user.tenantId);
    return { data: book };
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.booksService.softDelete(id, user.tenantId);
    return { data: { message: 'Book deleted successfully' } };
  }

  @Post(':id/restore')
  @Roles('admin')
  async restore(@Param('id') id: string, @CurrentUser() user: any) {
    await this.booksService.restore(id, user.tenantId);
    return { data: { message: 'Book restored successfully' } };
  }
}
