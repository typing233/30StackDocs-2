import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedFeatures1700000000002 implements MigrationInterface {
  name = 'AdvancedFeatures1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // ABAC Policy Rules
    // ========================================
    await queryRunner.query(`
      CREATE TABLE "abac_policies" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "tenantId" uuid NOT NULL,
        "entityType" varchar NOT NULL,
        "action" varchar NOT NULL,
        "effect" varchar NOT NULL DEFAULT 'allow',
        "priority" int NOT NULL DEFAULT 0,
        "conditions" jsonb NOT NULL DEFAULT '{}',
        "enabled" boolean NOT NULL DEFAULT true,
        "createdBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_abac_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_abac_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id"),
        CONSTRAINT "CHK_abac_effect" CHECK ("effect" IN ('allow', 'deny'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_abac_tenant_entity" ON "abac_policies" ("tenantId", "entityType", "action")`);

    // Extend entity_permissions with deny support and priority
    await queryRunner.query(`ALTER TABLE "entity_permissions" ADD COLUMN "effect" varchar NOT NULL DEFAULT 'allow'`);
    await queryRunner.query(`ALTER TABLE "entity_permissions" ADD COLUMN "priority" int NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "entity_permissions" ADD CONSTRAINT "CHK_ep_effect" CHECK ("effect" IN ('allow', 'deny'))`);

    // ========================================
    // API Tokens
    // ========================================
    await queryRunner.query(`
      CREATE TABLE "api_tokens" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "tokenHash" varchar NOT NULL,
        "tokenPrefix" varchar(12) NOT NULL,
        "userId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]',
        "rateLimit" int NOT NULL DEFAULT 60,
        "expiresAt" TIMESTAMP,
        "lastUsedAt" TIMESTAMP,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_api_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_api_tokens_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_api_tokens_hash" ON "api_tokens" ("tokenHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_api_tokens_tenant" ON "api_tokens" ("tenantId")`);

    // Idempotency keys
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "key" varchar NOT NULL,
        "tenantId" uuid NOT NULL,
        "method" varchar NOT NULL,
        "path" varchar NOT NULL,
        "statusCode" int NOT NULL,
        "responseBody" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_idempotency_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_idempotency_key_tenant" UNIQUE ("key", "tenantId")
      )
    `);

    // ========================================
    // Search Index
    // ========================================
    await queryRunner.query(`
      ALTER TABLE "pages" ADD COLUMN "searchVector" tsvector
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pages_search" ON "pages" USING GIN ("searchVector")
    `);

    // Search index for books
    await queryRunner.query(`
      ALTER TABLE "books" ADD COLUMN "searchVector" tsvector
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_books_search" ON "books" USING GIN ("searchVector")
    `);

    // Trigger function to update page search vector
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION pages_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" :=
          setweight(to_tsvector('simple', COALESCE(NEW."name", '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(NEW."contentMarkdown",
            regexp_replace(COALESCE(NEW."contentHtml", ''), '<[^>]*>', ' ', 'g')
          , '')), 'B');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "pages_search_update"
      BEFORE INSERT OR UPDATE OF "name", "contentHtml", "contentMarkdown"
      ON "pages"
      FOR EACH ROW EXECUTE FUNCTION pages_search_vector_update()
    `);

    // Trigger function to update book search vector
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION books_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" :=
          setweight(to_tsvector('simple', COALESCE(NEW."name", '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(NEW."description", '')), 'B');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "books_search_update"
      BEFORE INSERT OR UPDATE OF "name", "description"
      ON "books"
      FOR EACH ROW EXECUTE FUNCTION books_search_vector_update()
    `);

    // ========================================
    // Export Jobs
    // ========================================
    await queryRunner.query(`
      CREATE TABLE "export_jobs" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "format" varchar NOT NULL,
        "entityType" varchar NOT NULL,
        "entityId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "progress" int NOT NULL DEFAULT 0,
        "options" jsonb NOT NULL DEFAULT '{}',
        "filePath" varchar,
        "fileSize" bigint,
        "error" text,
        "attempts" int NOT NULL DEFAULT 0,
        "maxAttempts" int NOT NULL DEFAULT 3,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_export_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_export_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id"),
        CONSTRAINT "FK_export_user" FOREIGN KEY ("userId") REFERENCES "users"("id"),
        CONSTRAINT "CHK_export_format" CHECK ("format" IN ('pdf', 'html', 'markdown')),
        CONSTRAINT "CHK_export_status" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_export_tenant_user" ON "export_jobs" ("tenantId", "userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_export_status" ON "export_jobs" ("status")`);

    // ========================================
    // System Configuration
    // ========================================
    await queryRunner.query(`
      CREATE TABLE "system_configs" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "tenantId" uuid,
        "key" varchar NOT NULL,
        "value" jsonb NOT NULL,
        "description" text,
        "updatedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_system_config_key_tenant" UNIQUE ("key", "tenantId")
      )
    `);

    // Config history for rollback
    await queryRunner.query(`
      CREATE TABLE "system_config_history" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "configId" uuid NOT NULL,
        "tenantId" uuid,
        "key" varchar NOT NULL,
        "value" jsonb NOT NULL,
        "previousValue" jsonb,
        "changedBy" uuid,
        "changeReason" text,
        "version" int NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_config_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_config_history_config" FOREIGN KEY ("configId") REFERENCES "system_configs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_config_history_config" ON "system_config_history" ("configId")`);
    await queryRunner.query(`CREATE INDEX "IDX_config_history_tenant" ON "system_config_history" ("tenantId")`);

    // ========================================
    // Extend roles table for preset roles metadata
    // ========================================
    await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "description" text`);
    await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isSystem" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "permissions" jsonb NOT NULL DEFAULT '[]'`);

    // Backfill existing search vectors
    await queryRunner.query(`
      UPDATE "pages" SET "searchVector" =
        setweight(to_tsvector('simple', COALESCE("name", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE("contentMarkdown",
          regexp_replace(COALESCE("contentHtml", ''), '<[^>]*>', ' ', 'g')
        , '')), 'B')
    `);
    await queryRunner.query(`
      UPDATE "books" SET "searchVector" =
        setweight(to_tsvector('simple', COALESCE("name", '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE("description", '')), 'B')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "books_search_update" ON "books"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS books_search_vector_update()`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "pages_search_update" ON "pages"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS pages_search_vector_update()`);
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "searchVector"`);
    await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN IF EXISTS "searchVector"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "permissions"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "isSystem"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "description"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_config_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_configs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "export_jobs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_tokens" CASCADE`);
    await queryRunner.query(`ALTER TABLE "entity_permissions" DROP CONSTRAINT IF EXISTS "CHK_ep_effect"`);
    await queryRunner.query(`ALTER TABLE "entity_permissions" DROP COLUMN IF EXISTS "priority"`);
    await queryRunner.query(`ALTER TABLE "entity_permissions" DROP COLUMN IF EXISTS "effect"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "abac_policies" CASCADE`);
  }
}
