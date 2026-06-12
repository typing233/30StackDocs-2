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
import { CheckPermission } from '../../common/decorators/permissions.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';

@Controller('api/books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @Roles('admin', 'editor')
  @RequireScope('books:write')
  async create(@Body() dto: CreateBookDto, @CurrentUser() user: any) {
    const book = await this.booksService.create(dto, user.id, user.tenantId);
    return { data: book };
  }

  @Get()
  @RequireScope('books:read')
  async findAll(@Query() query: PaginationDto, @CurrentUser() user: any) {
    return this.booksService.findAll(user.tenantId, query, user.id, user.roles);
  }

  @Get(':id')
  @RequireScope('books:read')
  @CheckPermission({ entityType: 'book', action: 'view', idParam: 'id' })
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    const book = await this.booksService.findByIdWithRelations(id, user.tenantId);
    return { data: book };
  }

  @Put(':id')
  @Roles('admin', 'editor')
  @RequireScope('books:write')
  @CheckPermission({ entityType: 'book', action: 'edit', idParam: 'id' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @CurrentUser() user: any,
  ) {
    const book = await this.booksService.update(id, dto, user.id, user.tenantId);
    return { data: book };
  }

  @Delete(':id')
  @Roles('admin', 'editor')
  @RequireScope('books:write')
  @CheckPermission({ entityType: 'book', action: 'delete', idParam: 'id' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.booksService.softDelete(id, user.tenantId);
    return { data: { message: 'Book deleted successfully' } };
  }

  @Post(':id/restore')
  @Roles('admin')
  @RequireScope('books:write')
  async restore(@Param('id') id: string, @CurrentUser() user: any) {
    await this.booksService.restore(id, user.tenantId);
    return { data: { message: 'Book restored successfully' } };
  }
}
