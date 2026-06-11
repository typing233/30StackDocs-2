import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Page } from './entities/page.entity';
import { PageRevision } from './entities/page-revision.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';
import { AutoSaveDto } from './dto/auto-save.dto';
import { PageSanitizer } from './pages.sanitizer';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepo: Repository<Page>,
    @InjectRepository(PageRevision)
    private readonly revisionRepo: Repository<PageRevision>,
    private readonly dataSource: DataSource,
    private readonly sanitizer: PageSanitizer,
  ) {}

  async create(dto: CreatePageDto, userId: string, tenantId: string) {
    const maxPriority = await this.pageRepo
      .createQueryBuilder('p')
      .select('MAX(p.priority)', 'max')
      .where('p.bookId = :bookId AND p.tenantId = :tenantId', {
        bookId: dto.bookId,
        tenantId,
      })
      .getRawOne();

    const priority = (maxPriority?.max || 0) + 1000;
    const slug = this.generateSlug(dto.name);

    const page = this.pageRepo.create({
      name: dto.name,
      slug,
      bookId: dto.bookId,
      chapterId: dto.chapterId || null,
      contentHtml: this.sanitizer.clean(dto.contentHtml),
      contentMarkdown: dto.contentMarkdown || null,
      priority,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.pageRepo.save(page);
  }

  async findBySlug(slug: string, tenantId: string) {
    const page = await this.pageRepo.findOne({
      where: { slug, tenantId },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async findById(id: string, tenantId: string) {
    const page = await this.pageRepo.findOne({
      where: { id, tenantId },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async update(id: string, dto: UpdatePageDto, userId: string, tenantId: string) {
    return this.dataSource.transaction(async (manager) => {
      const page = await manager.findOne(Page, {
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!page) throw new NotFoundException('Page not found');

      if (page.version !== dto.version) {
        throw new ConflictException(
          'Resource was modified by another user. Please refresh and try again.',
        );
      }

      // Create revision from current state before updating
      if (page.contentHtml) {
        const lastRevision = await manager.findOne(PageRevision, {
          where: { pageId: id },
          order: { versionNumber: 'DESC' },
        });
        const nextVersion = (lastRevision?.versionNumber ?? 0) + 1;

        await manager.save(PageRevision, {
          pageId: id,
          contentHtml: page.contentHtml,
          contentMarkdown: page.contentMarkdown,
          versionNumber: nextVersion,
          createdBy: userId,
        });
      }

      if (dto.name) {
        page.name = dto.name;
        page.slug = this.generateSlug(dto.name);
      }
      if (dto.contentHtml !== undefined) {
        page.contentHtml = this.sanitizer.clean(dto.contentHtml);
      }
      if (dto.contentMarkdown !== undefined) {
        page.contentMarkdown = dto.contentMarkdown || null;
      }
      page.isDraft = false;
      page.updatedBy = userId;

      return manager.save(Page, page);
    });
  }

  async saveDraft(id: string, dto: AutoSaveDto, userId: string, tenantId: string) {
    await this.pageRepo.update(
      { id, tenantId },
      {
        contentHtml: this.sanitizer.clean(dto.contentHtml),
        contentMarkdown: dto.contentMarkdown || null,
        isDraft: true,
        updatedBy: userId,
      },
    );
  }

  async move(id: string, dto: MovePageDto, userId: string, tenantId: string) {
    return this.dataSource.transaction(async (manager) => {
      const page = await manager.findOne(Page, {
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!page) throw new NotFoundException('Page not found');

      if (dto.targetChapterId) {
        page.chapterId = dto.targetChapterId;
      } else if (dto.targetBookId) {
        page.chapterId = null;
        page.bookId = dto.targetBookId;
      }

      page.priority = dto.priority;
      page.updatedBy = userId;
      return manager.save(Page, page);
    });
  }

  async getRevisions(pageId: string, tenantId: string) {
    await this.findById(pageId, tenantId);
    return this.revisionRepo.find({
      where: { pageId },
      order: { versionNumber: 'DESC' },
      select: ['id', 'versionNumber', 'createdBy', 'createdAt', 'summary'],
    });
  }

  async getRevision(pageId: string, revisionId: string, tenantId: string) {
    await this.findById(pageId, tenantId);
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId, pageId },
    });
    if (!revision) throw new NotFoundException('Revision not found');
    return revision;
  }

  async getDiff(
    pageId: string,
    fromVersion: number,
    toVersion: number,
    tenantId: string,
  ) {
    await this.findById(pageId, tenantId);

    const [fromRev, toRev] = await Promise.all([
      this.revisionRepo.findOne({ where: { pageId, versionNumber: fromVersion } }),
      this.revisionRepo.findOne({ where: { pageId, versionNumber: toVersion } }),
    ]);

    if (!fromRev || !toRev) {
      throw new NotFoundException('Revision not found');
    }

    // Return raw content for client-side diffing
    return {
      from: {
        version: fromRev.versionNumber,
        contentHtml: fromRev.contentHtml,
        contentMarkdown: fromRev.contentMarkdown,
        createdAt: fromRev.createdAt,
      },
      to: {
        version: toRev.versionNumber,
        contentHtml: toRev.contentHtml,
        contentMarkdown: toRev.contentMarkdown,
        createdAt: toRev.createdAt,
      },
    };
  }

  async rollback(
    pageId: string,
    revisionId: string,
    userId: string,
    tenantId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const page = await manager.findOne(Page, {
        where: { id: pageId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!page) throw new NotFoundException('Page not found');

      const targetRevision = await manager.findOne(PageRevision, {
        where: { id: revisionId, pageId },
      });
      if (!targetRevision) throw new NotFoundException('Revision not found');

      // Save current state as new revision before rollback
      const lastRevision = await manager.findOne(PageRevision, {
        where: { pageId },
        order: { versionNumber: 'DESC' },
      });
      const nextVersion = (lastRevision?.versionNumber ?? 0) + 1;

      await manager.save(PageRevision, {
        pageId,
        contentHtml: page.contentHtml || '',
        contentMarkdown: page.contentMarkdown,
        versionNumber: nextVersion,
        createdBy: userId,
        summary: `Before rollback to v${targetRevision.versionNumber}`,
      });

      // Apply rollback
      page.contentHtml = targetRevision.contentHtml;
      page.contentMarkdown = targetRevision.contentMarkdown;
      page.updatedBy = userId;
      page.isDraft = false;

      return manager.save(Page, page);
    });
  }

  async softDelete(id: string, tenantId: string) {
    const page = await this.findById(id, tenantId);
    page.deletedAt = new Date();
    await this.pageRepo.save(page);
  }

  async restore(id: string, tenantId: string) {
    const page = await this.pageRepo.findOne({
      where: { id, tenantId },
      withDeleted: true,
    });
    if (!page) throw new NotFoundException('Page not found');
    page.deletedAt = null;
    await this.pageRepo.save(page);
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
