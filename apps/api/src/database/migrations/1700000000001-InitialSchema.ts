import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000001 implements MigrationInterface {
  name = 'InitialSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Tenants
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id")
      )
    `);

    // Roles
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roles_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);

    // Users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL,
        "name" varchar NOT NULL,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_users_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);

    // User Roles join table
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "usersId" uuid NOT NULL,
        "rolesId" uuid NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("usersId", "rolesId"),
        CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("rolesId") REFERENCES "roles"("id") ON DELETE CASCADE
      )
    `);

    // Entity Permissions
    await queryRunner.query(`
      CREATE TABLE "entity_permissions" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "entityType" varchar NOT NULL,
        "entityId" uuid NOT NULL,
        "roleId" uuid,
        "userId" uuid,
        "action" varchar NOT NULL,
        "tenantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entity_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ep_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);

    // Books
    await queryRunner.query(`
      CREATE TABLE "books" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "description" text,
        "tenantId" uuid NOT NULL,
        "createdBy" uuid,
        "updatedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_books" PRIMARY KEY ("id"),
        CONSTRAINT "FK_books_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);

    // Chapters
    await queryRunner.query(`
      CREATE TABLE "chapters" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "bookId" uuid NOT NULL,
        "priority" float NOT NULL DEFAULT 0,
        "tenantId" uuid NOT NULL,
        "createdBy" uuid,
        "updatedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_chapters" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chapters_book" FOREIGN KEY ("bookId") REFERENCES "books"("id"),
        CONSTRAINT "FK_chapters_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);

    // Pages
    await queryRunner.query(`
      CREATE TABLE "pages" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "chapterId" uuid,
        "bookId" uuid NOT NULL,
        "contentHtml" text,
        "contentMarkdown" text,
        "priority" float NOT NULL DEFAULT 0,
        "isDraft" boolean NOT NULL DEFAULT false,
        "tenantId" uuid NOT NULL,
        "createdBy" uuid,
        "updatedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_pages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pages_chapter" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id"),
        CONSTRAINT "FK_pages_book" FOREIGN KEY ("bookId") REFERENCES "books"("id"),
        CONSTRAINT "FK_pages_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);

    // Page Revisions
    await queryRunner.query(`
      CREATE TABLE "page_revisions" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "pageId" uuid NOT NULL,
        "contentHtml" text NOT NULL,
        "contentMarkdown" text,
        "versionNumber" int NOT NULL,
        "createdBy" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "summary" text,
        CONSTRAINT "PK_page_revisions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_revisions_page" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE
      )
    `);

    // Audit Logs
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "userId" uuid,
        "tenantId" uuid NOT NULL,
        "action" varchar NOT NULL,
        "entityType" varchar,
        "entityId" uuid,
        "changes" jsonb,
        "ip" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);

    // Refresh Tokens
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "tokenHash" varchar NOT NULL,
        "userId" uuid NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_books_tenant" ON "books" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_books_slug" ON "books" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_chapters_book" ON "chapters" ("bookId")`);
    await queryRunner.query(`CREATE INDEX "IDX_chapters_tenant" ON "chapters" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pages_chapter" ON "pages" ("chapterId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pages_book" ON "pages" ("bookId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pages_tenant" ON "pages" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_revisions_page" ON "page_revisions" ("pageId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_tenant" ON "audit_logs" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_entity" ON "audit_logs" ("entityType", "entityId")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_token_hash" ON "refresh_tokens" ("tokenHash")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "page_revisions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chapters" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "books" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "entity_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants" CASCADE`);
  }
}
