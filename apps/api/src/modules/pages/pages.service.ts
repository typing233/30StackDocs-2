import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Page } from './entities/page.entity';
import { PageRevision } from './entities/page-revision.entity';
import { PermissionsService } from '../permissions/permissions.service';
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
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(dto: CreatePageDto, userId: string, tenantId: string, userRoles: string[]) {
    // Check permission on parent book
    const canEdit = await this.permissionsService.hasPermission(
      userId, tenantId, 'book', dto.bookId, ['edit'],
    );
    if (!canEdit && !userRoles.includes('admin')) {
      throw new ForbiddenException('No permission to create pages in this book');
    }

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

    const sanitizedHtml = this.sanitizer.clean(dto.contentHtml);

    const page = this.pageRepo.create({
      name: dto.name,
      slug,
      bookId: dto.bookId,
      chapterId: dto.chapterId || null,
      contentHtml: sanitizedHtml,
      contentMarkdown: dto.contentMarkdown || null,
      priority,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.pageRepo.save(page);

    // Create initial revision (v1) so version history includes creation
    await this.revisionRepo.save(
      this.revisionRepo.create({
        pageId: saved.id,
        contentHtml: sanitizedHtml || '',
        contentMarkdown: dto.contentMarkdown || null,
        versionNumber: 1,
        createdBy: userId,
        summary: 'Initial version',
      }),
    );

    return saved;
  }

  async findBySlug(slug: string, tenantId: string, userId: string, userRoles: string[]) {
    const page = await this.pageRepo.findOne({
      where: { slug, tenantId },
    });
    if (!page) throw new NotFoundException('Page not found');

    // Check view permission (page inherits from chapter -> book)
    const parents: { type: string; id: string }[] = [
      { type: 'book', id: page.bookId },
    ];
    if (page.chapterId) {
      parents.unshift({ type: 'chapter', id: page.chapterId });
    }

    if (!userRoles.includes('admin') && page.createdBy !== userId) {
      const canView = await this.permissionsService.hasPermission(
        userId, tenantId, 'page', page.id, ['view'], parents,
      );
      if (!canView) {
        throw new ForbiddenException('No permission to view this page');
      }
    }

    return page;
  }

  async findById(id: string, tenantId: string) {
    const page = await this.pageRepo.findOne({
      where: { id, tenantId },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async update(id: string, dto: UpdatePageDto, userId: string, tenantId: string, userRoles: string[]) {
    return this.dataSource.transaction(async (manager) => {
      const page = await manager.findOne(Page, {
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!page) throw new NotFoundException('Page not found');

      // Check edit permission
      const parents: { type: string; id: string }[] = [
        { type: 'book', id: page.bookId },
      ];
      if (page.chapterId) parents.unshift({ type: 'chapter', id: page.chapterId });

      if (!userRoles.includes('admin') && page.createdBy !== userId) {
        const canEdit = await this.permissionsService.hasPermission(
          userId, tenantId, 'page', id, ['edit'], parents,
        );
        if (!canEdit) {
          throw new ForbiddenException('No permission to edit this page');
        }
      }

      if (page.version !== dto.version) {
        throw new ConflictException(
          'Resource was modified by another user. Please refresh and try again.',
        );
      }

      // Get next version number
      const lastRevision = await manager.findOne(PageRevision, {
        where: { pageId: id },
        order: { versionNumber: 'DESC' },
      });
      const nextVersion = (lastRevision?.versionNumber ?? 0) + 1;

      // Update page content
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

      const savedPage = await manager.save(Page, page);

      // Create revision AFTER save so it records the new content
      await manager.save(PageRevision, {
        pageId: id,
        contentHtml: savedPage.contentHtml || '',
        contentMarkdown: savedPage.contentMarkdown,
        versionNumber: nextVersion,
        createdBy: userId,
      });

      return savedPage;
    });
  }

  async saveDraft(id: string, dto: AutoSaveDto, userId: string, tenantId: string, userRoles: string[]) {
    const page = await this.findById(id, tenantId);

    // Check edit permission
    const parents: { type: string; id: string }[] = [
      { type: 'book', id: page.bookId },
    ];
    if (page.chapterId) parents.unshift({ type: 'chapter', id: page.chapterId });

    if (!userRoles.includes('admin') && page.createdBy !== userId) {
      const canEdit = await this.permissionsService.hasPermission(
        userId, tenantId, 'page', id, ['edit'], parents,
      );
      if (!canEdit) {
        throw new ForbiddenException('No permission to edit this page');
      }
    }

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

  async move(id: string, dto: MovePageDto, userId: string, tenantId: string, userRoles: string[]) {
    return this.dataSource.transaction(async (manager) => {
      const page = await manager.findOne(Page, {
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!page) throw new NotFoundException('Page not found');

      // Check edit permission on source
      const canEdit = await this.permissionsService.hasPermission(
        userId, tenantId, 'page', id, ['edit'],
        [{ type: 'book', id: page.bookId }],
      );
      if (!canEdit && !userRoles.includes('admin') && page.createdBy !== userId) {
        throw new ForbiddenException('No permission to move this page');
      }

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
    userRoles: string[],
  ) {
    return this.dataSource.transaction(async (manager) => {
      const page = await manager.findOne(Page, {
        where: { id: pageId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!page) throw new NotFoundException('Page not found');

      // Check edit permission
      if (!userRoles.includes('admin') && page.createdBy !== userId) {
        const canEdit = await this.permissionsService.hasPermission(
          userId, tenantId, 'page', pageId, ['edit'],
          [{ type: 'book', id: page.bookId }],
        );
        if (!canEdit) {
          throw new ForbiddenException('No permission to rollback this page');
        }
      }

      const targetRevision = await manager.findOne(PageRevision, {
        where: { id: revisionId, pageId },
      });
      if (!targetRevision) throw new NotFoundException('Revision not found');

      // Get next version number
      const lastRevision = await manager.findOne(PageRevision, {
        where: { pageId },
        order: { versionNumber: 'DESC' },
      });
      const nextVersion = (lastRevision?.versionNumber ?? 0) + 1;

      // Apply rollback
      page.contentHtml = targetRevision.contentHtml;
      page.contentMarkdown = targetRevision.contentMarkdown;
      page.updatedBy = userId;
      page.isDraft = false;

      const savedPage = await manager.save(Page, page);

      // Record the rollback as a new revision
      await manager.save(PageRevision, {
        pageId,
        contentHtml: savedPage.contentHtml || '',
        contentMarkdown: savedPage.contentMarkdown,
        versionNumber: nextVersion,
        createdBy: userId,
        summary: `Rollback to v${targetRevision.versionNumber}`,
      });

      return savedPage;
    });
  }

  async softDelete(id: string, tenantId: string, userId: string, userRoles: string[]) {
    const page = await this.findById(id, tenantId);

    const canDelete = await this.permissionsService.hasPermission(
      userId, tenantId, 'page', id, ['delete'],
      [{ type: 'book', id: page.bookId }],
    );
    if (!canDelete && !userRoles.includes('admin') && page.createdBy !== userId) {
      throw new ForbiddenException('No permission to delete this page');
    }

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
