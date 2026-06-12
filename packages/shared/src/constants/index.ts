export enum Role {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum Permission {
  VIEW = 'view',
  EDIT = 'edit',
  DELETE = 'delete',
  CREATE = 'create',
  MANAGE = 'manage',
}

export enum EntityType {
  BOOK = 'book',
  CHAPTER = 'chapter',
  PAGE = 'page',
}

export enum PermissionEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

export enum ExportFormat {
  PDF = 'pdf',
  HTML = 'html',
  MARKDOWN = 'markdown',
}

export enum ExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ApiTokenScope {
  BOOKS_READ = 'books:read',
  BOOKS_WRITE = 'books:write',
  CHAPTERS_READ = 'chapters:read',
  CHAPTERS_WRITE = 'chapters:write',
  PAGES_READ = 'pages:read',
  PAGES_WRITE = 'pages:write',
  EXPORT = 'export',
  SEARCH = 'search',
  ADMIN = 'admin',
}
