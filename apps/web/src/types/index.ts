export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  roles: string[];
}

export interface Book {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  chapters?: Chapter[];
  directPages?: Page[];
}

export interface Chapter {
  id: string;
  name: string;
  slug: string;
  bookId: string;
  priority: number;
  version: number;
  pages?: Page[];
}

export interface Page {
  id: string;
  name: string;
  slug: string;
  chapterId: string | null;
  bookId: string;
  contentHtml: string | null;
  contentMarkdown: string | null;
  priority: number;
  isDraft: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageRevision {
  id: string;
  pageId: string;
  contentHtml: string;
  contentMarkdown: string | null;
  versionNumber: number;
  createdBy: string;
  createdAt: string;
  summary: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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

export interface ExportJob {
  id: string;
  type: string;
  format: string;
  entityType: string;
  entityId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  filePath: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  rateLimit: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface SystemConfigEntry {
  id: string;
  key: string;
  value: any;
  updatedBy: string | null;
  updatedAt: string;
}

export interface AbacPolicy {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  action: string;
  effect: 'allow' | 'deny';
  priority: number;
  conditions: Record<string, any>;
  enabled: boolean;
  createdAt: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  tenantId: string;
}
