import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Page } from '../pages/entities/page.entity';
import { Book } from '../books/entities/book.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { RedisService } from '../redis/redis.service';

export interface SearchResult {
  id: string;
  type: 'page' | 'book';
  title: string;
  slug: string;
  snippet: string;
  bookId?: string;
  bookName?: string;
  chapterId?: string;
  chapterName?: string;
  rank: number;
  highlights: string[];
}

export interface SearchOptions {
  query: string;
  tenantId: string;
  userId: string;
  userRoles: string[];
  userRoleIds: string[];
  page?: number;
  limit?: number;
  entityTypes?: string[];
  bookId?: string;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepo: Repository<Page>,
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    private readonly permissionsService: PermissionsService,
    private readonly redis: RedisService,
  ) {}

  async search(options: SearchOptions): Promise<{ data: SearchResult[]; meta: { total: number; page: number; limit: number } }> {
    const { query, tenantId, userId, userRoles, userRoleIds, page = 1, limit = 20, entityTypes, bookId } = options;

    if (!query || query.trim().length === 0) {
      return { data: [], meta: { total: 0, page, limit } };
    }

    const tsQuery = this.buildTsQuery(query);
    const cacheKey = `search:${tenantId}:${userId}:${tsQuery}:${page}:${limit}:${entityTypes?.join(',') || ''}:${bookId || ''}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const results: SearchResult[] = [];
    let total = 0;

    const searchPages = !entityTypes || entityTypes.includes('page');
    const searchBooks = !entityTypes || entityTypes.includes('book');

    if (searchPages) {
      const pageResults = await this.searchPages(tsQuery, query, tenantId, userId, userRoles, userRoleIds, bookId);
      results.push(...pageResults.items);
      total += pageResults.total;
    }

    if (searchBooks && !bookId) {
      const bookResults = await this.searchBooks(tsQuery, query, tenantId, userId, userRoles, userRoleIds);
      results.push(...bookResults.items);
      total += bookResults.total;
    }

    // Sort by rank (relevance)
    results.sort((a, b) => b.rank - a.rank);

    const offset = (page - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);

    const response = { data: paginatedResults, meta: { total, page, limit } };
    await this.redis.set(cacheKey, JSON.stringify(response), 60);
    return response;
  }

  private async searchPages(
    tsQuery: string,
    rawQuery: string,
    tenantId: string,
    userId: string,
    userRoles: string[],
    userRoleIds: string[],
    bookId?: string,
  ): Promise<{ items: SearchResult[]; total: number }> {
    const qb = this.pageRepo
      .createQueryBuilder('p')
      .select([
        'p.id',
        'p.name',
        'p.slug',
        'p.bookId',
        'p.chapterId',
      ])
      .addSelect(`ts_rank(p."searchVector", to_tsquery('simple', :tsQuery))`, 'rank')
      .addSelect(
        `ts_headline('simple', COALESCE(p."name", ''), to_tsquery('simple', :tsQuery), 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20')`,
        'title_highlight',
      )
      .addSelect(
        `ts_headline('simple', COALESCE(p."contentMarkdown", regexp_replace(COALESCE(p."contentHtml", ''), '<[^>]*>', ' ', 'g')), to_tsquery('simple', :tsQuery), 'StartSel=<mark>, StopSel=</mark>, MaxWords=80, MinWords=30')`,
        'content_highlight',
      )
      .leftJoin('books', 'b', 'b.id = p."bookId"')
      .addSelect('b.name', 'book_name')
      .leftJoin('chapters', 'c', 'c.id = p."chapterId"')
      .addSelect('c.name', 'chapter_name')
      .where('p."tenantId" = :tenantId', { tenantId })
      .andWhere('p."deletedAt" IS NULL')
      .andWhere(`p."searchVector" @@ to_tsquery('simple', :tsQuery)`)
      .setParameter('tsQuery', tsQuery)
      .orderBy('rank', 'DESC');

    if (bookId) {
      qb.andWhere('p."bookId" = :bookId', { bookId });
    }

    // Apply permission filter
    this.permissionsService.applyPermissionFilter(qb, 'p', userId, tenantId, userRoles, 'page', userRoleIds);

    const total = await qb.getCount();
    const raw = await qb.getRawMany();

    const items: SearchResult[] = raw.map((row) => ({
      id: row.p_id,
      type: 'page' as const,
      title: row.p_name,
      slug: row.p_slug,
      snippet: row.content_highlight || '',
      bookId: row.p_bookId,
      bookName: row.book_name,
      chapterId: row.p_chapterId,
      chapterName: row.chapter_name,
      rank: parseFloat(row.rank) * 1.0,
      highlights: [row.title_highlight, row.content_highlight].filter(Boolean),
    }));

    return { items, total };
  }

  private async searchBooks(
    tsQuery: string,
    rawQuery: string,
    tenantId: string,
    userId: string,
    userRoles: string[],
    userRoleIds: string[],
  ): Promise<{ items: SearchResult[]; total: number }> {
    const qb = this.bookRepo
      .createQueryBuilder('b')
      .select(['b.id', 'b.name', 'b.slug'])
      .addSelect(`ts_rank(b."searchVector", to_tsquery('simple', :tsQuery))`, 'rank')
      .addSelect(
        `ts_headline('simple', COALESCE(b."name", ''), to_tsquery('simple', :tsQuery), 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20')`,
        'title_highlight',
      )
      .addSelect(
        `ts_headline('simple', COALESCE(b."description", ''), to_tsquery('simple', :tsQuery), 'StartSel=<mark>, StopSel=</mark>, MaxWords=80, MinWords=30')`,
        'desc_highlight',
      )
      .where('b."tenantId" = :tenantId', { tenantId })
      .andWhere('b."deletedAt" IS NULL')
      .andWhere(`b."searchVector" @@ to_tsquery('simple', :tsQuery)`)
      .setParameter('tsQuery', tsQuery)
      .orderBy('rank', 'DESC');

    this.permissionsService.applyPermissionFilter(qb, 'b', userId, tenantId, userRoles, 'book', userRoleIds);

    const total = await qb.getCount();
    const raw = await qb.getRawMany();

    const items: SearchResult[] = raw.map((row) => ({
      id: row.b_id,
      type: 'book' as const,
      title: row.b_name,
      slug: row.b_slug,
      snippet: row.desc_highlight || '',
      rank: parseFloat(row.rank) * 1.5, // Boost book matches
      highlights: [row.title_highlight, row.desc_highlight].filter(Boolean),
    }));

    return { items, total };
  }

  private buildTsQuery(query: string): string {
    // Support Chinese by splitting on character boundaries and using 'simple' config
    // Each token is joined with & for AND semantics
    const tokens = query
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((token) => {
        // Escape special characters
        const escaped = token.replace(/[&|!():*'\\]/g, '');
        if (!escaped) return null;
        return `${escaped}:*`;
      })
      .filter(Boolean);

    if (tokens.length === 0) return '';
    return tokens.join(' & ');
  }

  async reindexPage(pageId: string): Promise<void> {
    await this.pageRepo.query(
      `UPDATE pages SET "searchVector" =
        setweight(to_tsvector('simple', COALESCE("name", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE("contentMarkdown",
          regexp_replace(COALESCE("contentHtml", ''), '<[^>]*>', ' ', 'g')
        , '')), 'B')
      WHERE id = $1`,
      [pageId],
    );
  }

  async reindexBook(bookId: string): Promise<void> {
    await this.bookRepo.query(
      `UPDATE books SET "searchVector" =
        setweight(to_tsvector('simple', COALESCE("name", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE("description", '')), 'B')
      WHERE id = $1`,
      [bookId],
    );
  }

  async reindexAll(tenantId: string): Promise<void> {
    await this.pageRepo.query(
      `UPDATE pages SET "searchVector" =
        setweight(to_tsvector('simple', COALESCE("name", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE("contentMarkdown",
          regexp_replace(COALESCE("contentHtml", ''), '<[^>]*>', ' ', 'g')
        , '')), 'B')
      WHERE "tenantId" = $1`,
      [tenantId],
    );
    await this.bookRepo.query(
      `UPDATE books SET "searchVector" =
        setweight(to_tsvector('simple', COALESCE("name", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE("description", '')), 'B')
      WHERE "tenantId" = $1`,
      [tenantId],
    );
    await this.redis.delPattern(`search:${tenantId}:*`);
  }

  async invalidateSearchCache(tenantId: string): Promise<void> {
    await this.redis.delPattern(`search:${tenantId}:*`);
  }
}
