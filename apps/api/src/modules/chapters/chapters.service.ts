import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Chapter } from './entities/chapter.entity';
import { Page } from '../pages/entities/page.entity';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@Injectable()
export class ChaptersService {
  constructor(
    @InjectRepository(Chapter)
    private readonly chapterRepo: Repository<Chapter>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    bookId: string,
    dto: CreateChapterDto,
    userId: string,
    tenantId: string,
  ) {
    const maxPriority = await this.chapterRepo
      .createQueryBuilder('ch')
      .select('MAX(ch.priority)', 'max')
      .where('ch."bookId" = :bookId AND ch."tenantId" = :tenantId', { bookId, tenantId })
      .getRawOne();

    const priority = (maxPriority?.max || 0) + 1000;
    const slug = this.generateSlug(dto.name);

    const chapter = this.chapterRepo.create({
      name: dto.name,
      slug,
      bookId,
      priority,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.chapterRepo.save(chapter);
  }

  async findByBook(bookId: string, tenantId: string) {
    return this.chapterRepo.find({
      where: { bookId, tenantId },
      relations: ['pages'],
      order: { priority: 'ASC' },
    });
  }

  async findById(id: string, tenantId: string) {
    const chapter = await this.chapterRepo.findOne({
      where: { id, tenantId },
      relations: ['pages'],
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  async update(
    id: string,
    dto: UpdateChapterDto,
    userId: string,
    tenantId: string,
  ) {
    const chapter = await this.chapterRepo.findOne({ where: { id, tenantId } });
    if (!chapter) throw new NotFoundException('Chapter not found');

    if (chapter.version !== dto.version) {
      throw new ConflictException(
        'Resource was modified by another user. Please refresh and try again.',
      );
    }

    if (dto.name) {
      chapter.name = dto.name;
      chapter.slug = this.generateSlug(dto.name);
    }
    chapter.updatedBy = userId;

    return this.chapterRepo.save(chapter);
  }

  async reorder(bookId: string, orderedIds: string[], tenantId: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.find(Chapter, {
        where: { bookId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });

      const gap = 1000;
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(Chapter, orderedIds[i], {
          priority: (i + 1) * gap,
        });
      }
    });
  }

  async softDelete(id: string, tenantId: string) {
    await this.dataSource.transaction(async (manager) => {
      const ch = await manager.findOne(Chapter, {
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!ch) throw new NotFoundException('Chapter not found');
      if (ch.deletedAt) return;

      const now = new Date();
      await manager.update(
        Page,
        { chapterId: id, tenantId, deletedAt: IsNull() },
        { deletedAt: now },
      );
      await manager.update(Chapter, { id }, { deletedAt: now });
    });
  }

  async restore(id: string, tenantId: string) {
    await this.dataSource.transaction(async (manager) => {
      const chapter = await manager.findOne(Chapter, {
        where: { id, tenantId },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      });
      if (!chapter) throw new NotFoundException('Chapter not found');
      if (!chapter.deletedAt) return;

      const deletedAt = chapter.deletedAt;
      await manager
        .createQueryBuilder()
        .update(Page)
        .set({ deletedAt: null as any })
        .where(
          '"chapterId" = :id AND "tenantId" = :tenantId AND "deletedAt" = :deletedAt',
          { id, tenantId, deletedAt },
        )
        .execute();

      await manager
        .createQueryBuilder()
        .update(Chapter)
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
