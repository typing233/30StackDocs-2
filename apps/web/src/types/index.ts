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
