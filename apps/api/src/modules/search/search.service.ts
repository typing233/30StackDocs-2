import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    const cacheKey = `search:${tenantId}:${userId}:${query}:${page}:${limit}:${entityTypes?.join(',') || ''}:${bookId || ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Use a UNION ALL query with LIMIT/OFFSET at the SQL level
    const likePattern = `%${query.replace(/[%_\\]/g, '\\$&')}%`;
    const tsQuery = this.buildTsQuery(query);
    const offset = (page - 1) * limit;

    const searchPages = !entityTypes || entityTypes.includes('page');
    const searchBooks = !entityTypes || entityTypes.includes('book');

    const parts: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (searchPages) {
      // Permission subquery for pages
      const permFilter = this.buildPermissionSubquery('p', userId, tenantId, userRoles, userRoleIds, 'page');

      parts.push(`
        SELECT
          p.id,
          'page' AS type,
          p."name" AS title,
          p.slug,
          p."bookId" AS "bookId",
          p."chapterId" AS "chapterId",
          b."name" AS "bookName",
          c."name" AS "chapterName",
          (
            CASE WHEN p."searchVector" @@ to_tsquery('simple', $${paramIdx})
              THEN ts_rank(p."searchVector", to_tsquery('simple', $${paramIdx}))
              ELSE 0
            END
            + CASE WHEN p."name" ILIKE $${paramIdx + 1} THEN 0.5 ELSE 0 END
          ) AS rank,
          ts_headline('simple', COALESCE(p."name", ''), to_tsquery('simple', $${paramIdx}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=10, HighlightAll=true') AS title_hl,
          ts_headline('simple',
            COALESCE(p."contentMarkdown", regexp_replace(COALESCE(p."contentHtml", ''), '<[^>]*>', ' ', 'g'), ''),
            to_tsquery('simple', $${paramIdx}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20') AS content_hl
        FROM pages p
        LEFT JOIN books b ON b.id = p."bookId"
        LEFT JOIN chapters c ON c.id = p."chapterId"
        WHERE p."tenantId" = $${paramIdx + 2}
          AND p."deletedAt" IS NULL
          AND (
            p."searchVector" @@ to_tsquery('simple', $${paramIdx})
            OR p."name" ILIKE $${paramIdx + 1}
            OR p."contentMarkdown" ILIKE $${paramIdx + 1}
            OR p."contentHtml" ILIKE $${paramIdx + 1}
          )
          ${bookId ? `AND p."bookId" = $${paramIdx + 3}` : ''}
          ${permFilter.sql}
      `);
      params.push(tsQuery, likePattern, tenantId);
      paramIdx += 3;
      if (bookId) { params.push(bookId); paramIdx++; }
      params.push(...permFilter.params);
      paramIdx += permFilter.params.length;
    }

    if (searchBooks && !bookId) {
      const permFilter = this.buildPermissionSubquery('bk', userId, tenantId, userRoles, userRoleIds, 'book');

      parts.push(`
        SELECT
          bk.id,
          'book' AS type,
          bk."name" AS title,
          bk.slug,
          NULL AS "bookId",
          NULL AS "chapterId",
          NULL AS "bookName",
          NULL AS "chapterName",
          (
            CASE WHEN bk."searchVector" @@ to_tsquery('simple', $${paramIdx})
              THEN ts_rank(bk."searchVector", to_tsquery('simple', $${paramIdx})) * 1.5
              ELSE 0
            END
            + CASE WHEN bk."name" ILIKE $${paramIdx + 1} THEN 0.8 ELSE 0 END
          ) AS rank,
          ts_headline('simple', COALESCE(bk."name", ''), to_tsquery('simple', $${paramIdx}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=10, HighlightAll=true') AS title_hl,
          ts_headline('simple', COALESCE(bk."description", ''), to_tsquery('simple', $${paramIdx}),
            'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20') AS content_hl
        FROM books bk
        WHERE bk."tenantId" = $${paramIdx + 2}
          AND bk."deletedAt" IS NULL
          AND (
            bk."searchVector" @@ to_tsquery('simple', $${paramIdx})
            OR bk."name" ILIKE $${paramIdx + 1}
            OR bk."description" ILIKE $${paramIdx + 1}
          )
          ${permFilter.sql}
      `);
      params.push(tsQuery, likePattern, tenantId);
      paramIdx += 3;
      params.push(...permFilter.params);
      paramIdx += permFilter.params.length;
    }

    if (parts.length === 0) {
      return { data: [], meta: { total: 0, page, limit } };
    }

    const unionSql = parts.join(' UNION ALL ');

    // Count query
    const countSql = `SELECT COUNT(*) AS total FROM (${unionSql}) AS _search`;
    const countResult = await this.pageRepo.query(countSql, params);
    const total = parseInt(countResult[0]?.total || '0', 10);

    if (total === 0) {
      const response = { data: [], meta: { total: 0, page, limit } };
      await this.redis.set(cacheKey, JSON.stringify(response), 60);
      return response;
    }

    // Data query with ORDER BY + LIMIT/OFFSET at SQL level
    const dataSql = `SELECT * FROM (${unionSql}) AS _search ORDER BY rank DESC LIMIT ${limit} OFFSET ${offset}`;
    const rows = await this.pageRepo.query(dataSql, params);

    const results: SearchResult[] = rows.map((row: any) => ({
      id: row.id,
      type: row.type as 'page' | 'book',
      title: row.title,
      slug: row.slug,
      snippet: row.content_hl || '',
      bookId: row.bookId || undefined,
      bookName: row.bookName || undefined,
      chapterId: row.chapterId || undefined,
      chapterName: row.chapterName || undefined,
      rank: parseFloat(row.rank) || 0,
      highlights: [row.title_hl, row.content_hl].filter(Boolean),
    }));

    const response = { data: results, meta: { total, page, limit } };
    await this.redis.set(cacheKey, JSON.stringify(response), 60);
    return response;
  }

  /**
   * Build a tsquery string that supports Chinese (CJK unigrams) and western tokens.
   * Each CJK character becomes its own token; western words use prefix match.
   * Tokens are joined with OR for broad recall.
   */
  private buildTsQuery(query: string): string {
    const cjkRange = /[一-鿿㐀-䶿豈-﫿]/;
    const chars = query.trim().split('');
    const tokens: string[] = [];
    let western = '';

    for (const ch of chars) {
      if (cjkRange.test(ch)) {
        if (western.trim()) {
          tokens.push(this.escapeTsToken(western.trim()));
          western = '';
        }
        tokens.push(this.escapeTsToken(ch));
      } else if (/\s/.test(ch)) {
        if (western.trim()) {
          tokens.push(this.escapeTsToken(western.trim()));
          western = '';
        }
      } else {
        western += ch;
      }
    }
    if (western.trim()) {
      tokens.push(this.escapeTsToken(western.trim()));
    }

    if (tokens.length === 0) return "''";

    // Use prefix matching for each token so partial words match
    return tokens.map((t) => `${t}:*`).join(' | ');
  }

  private escapeTsToken(token: string): string {
    return token.replace(/[&|!():*'\\<>]/g, '');
  }

  /**
   * Build a permission filter as raw SQL + params for use in native queries.
   * Returns empty filter for admin/editor/viewer roles (they can view everything
   * unless explicitly denied, which we skip for search perf).
   */
  private buildPermissionSubquery(
    alias: string,
    userId: string,
    tenantId: string,
    userRoles: string[],
    userRoleIds: string[],
    entityType: string,
  ): { sql: string; params: any[] } {
    if (userRoles.includes('admin') || userRoles.includes('editor') || userRoles.includes('viewer')) {
      // Check explicit deny
      return {
        sql: `AND NOT EXISTS (
          SELECT 1 FROM entity_permissions ep_d
          WHERE ep_d."entityType" = '${entityType}'
            AND ep_d."entityId" = ${alias}.id
            AND ep_d."tenantId" = '${tenantId}'
            AND ep_d.effect = 'deny'
            AND ep_d.action = 'view'
            AND (ep_d."userId" = '${userId}' ${userRoleIds.length > 0 ? `OR ep_d."roleId" IN (${userRoleIds.map((r) => `'${r}'`).join(',')})` : ''})
        )`,
        params: [],
      };
    }

    // Users without standard roles: must have explicit grant or be creator
    return {
      sql: `AND (
        ${alias}."createdBy" = '${userId}'
        OR EXISTS (
          SELECT 1 FROM entity_permissions ep_a
          WHERE ep_a."entityType" = '${entityType}'
            AND ep_a."entityId" = ${alias}.id
            AND ep_a."tenantId" = '${tenantId}'
            AND ep_a.effect = 'allow'
            AND ep_a.action IN ('view', 'edit')
            AND (ep_a."userId" = '${userId}' ${userRoleIds.length > 0 ? `OR ep_a."roleId" IN (${userRoleIds.map((r) => `'${r}'`).join(',')})` : ''})
        )
      )`,
      params: [],
    };
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
