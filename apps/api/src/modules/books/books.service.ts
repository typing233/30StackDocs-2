import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Book } from './entities/book.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { Page } from '../pages/entities/page.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    private readonly dataSource: DataSource,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(dto: CreateBookDto, userId: string, tenantId: string) {
    const slug = this.generateSlug(dto.name);
    const book = this.bookRepo.create({
      name: dto.name,
      slug,
      description: dto.description || null,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.bookRepo.save(book);
  }

  async findAll(
    tenantId: string,
    query: PaginationDto,
    userId: string,
    userRoles: string[],
  ) {
    const { page = 1, limit = 20, search, sortBy = 'updatedAt', sortOrder = 'DESC' } = query;

    let qb = this.bookRepo
      .createQueryBuilder('book')
      .where('book.tenantId = :tenantId', { tenantId })
      .andWhere('book.deletedAt IS NULL');

    // Apply permission-based filtering
    qb = this.permissionsService.applyPermissionFilter(
      qb, 'book', userId, tenantId, userRoles, 'book',
    );

    if (search) {
      qb.andWhere(
        '(book.name ILIKE :search OR book.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const allowedSortFields = ['name', 'createdAt', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    qb.orderBy(`book.${sortField}`, sortOrder);

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string, tenantId: string, userId: string, userRoles: string[]) {
    const book = await this.bookRepo.findOne({
      where: { slug, tenantId },
      relations: ['chapters', 'chapters.pages', 'directPages'],
    });
    if (!book) throw new NotFoundException('Book not found');

    // Check read permission
    const canView = await this.permissionsService.hasPermission(
      userId, tenantId, 'book', book.id, ['view'],
    );
    if (!canView && !userRoles.includes('admin') && book.createdBy !== userId) {
      throw new ForbiddenException('No permission to view this book');
    }
    return book;
  }

  async findById(id: string, tenantId: string) {
    const book = await this.bookRepo.findOne({
      where: { id, tenantId },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async update(id: string, dto: UpdateBookDto, userId: string, tenantId: string, userRoles: string[]) {
    const book = await this.findById(id, tenantId);

    // Check edit permission
    const canEdit = await this.permissionsService.hasPermission(
      userId, tenantId, 'book', id, ['edit'],
    );
    if (!canEdit && !userRoles.includes('admin') && book.createdBy !== userId) {
      throw new ForbiddenException('No permission to edit this book');
    }

    if (book.version !== dto.version) {
      throw new ConflictException(
        'Resource was modified by another user. Please refresh and try again.',
      );
    }

    if (dto.name) {
      book.name = dto.name;
      book.slug = this.generateSlug(dto.name);
    }
    if (dto.description !== undefined) {
      book.description = dto.description || null;
    }
    book.updatedBy = userId;

    return this.bookRepo.save(book);
  }

  async softDelete(id: string, tenantId: string, userId: string, userRoles: string[]) {
    const canDelete = await this.permissionsService.hasPermission(
      userId, tenantId, 'book', id, ['delete'],
    );
    if (!canDelete && !userRoles.includes('admin')) {
      throw new ForbiddenException('No permission to delete this book');
    }

    await this.dataSource.transaction(async (manager) => {
      const book = await manager.findOne(Book, {
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!book) throw new NotFoundException('Book not found');
      if (book.deletedAt) return;

      const now = new Date();
      await manager.update(
        Chapter,
        { bookId: id, tenantId, deletedAt: IsNull() },
        { deletedAt: now },
      );
      await manager.update(
        Page,
        { bookId: id, tenantId, deletedAt: IsNull() },
        { deletedAt: now },
      );
      await manager.update(Book, { id }, { deletedAt: now });
    });
  }

  async restore(id: string, tenantId: string) {
    await this.dataSource.transaction(async (manager) => {
      const book = await manager.findOne(Book, {
        where: { id, tenantId },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      });
      if (!book) throw new NotFoundException('Book not found');
      if (!book.deletedAt) return;

      const deletedAt = book.deletedAt;
      await manager
        .createQueryBuilder()
        .update(Chapter)
        .set({ deletedAt: null as any })
        .where('"bookId" = :id AND "tenantId" = :tenantId AND "deletedAt" = :deletedAt', {
          id,
          tenantId,
          deletedAt,
        })
        .execute();

      await manager
        .createQueryBuilder()
        .update(Page)
        .set({ deletedAt: null as any })
        .where('"bookId" = :id AND "tenantId" = :tenantId AND "deletedAt" = :deletedAt', {
          id,
          tenantId,
          deletedAt,
        })
        .execute();

      await manager
        .createQueryBuilder()
        .update(Book)
        .set({ deletedAt: null as any })
        .where('id = :id', { id })
        .execute();
    });
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9一-龥]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = Date.now().toString(36).slice(-4);
    return `${base}-${suffix}`;
  }
}
