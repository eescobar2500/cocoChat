-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_key_ciphertext" TEXT NOT NULL,
    "data_key_version" INTEGER NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['chat']::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "ciphertext" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "label" TEXT,
    "last_used_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "session_id" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "api_keys_organization_id_idx" ON "api_keys"("organization_id");

-- CreateIndex
CREATE INDEX "provider_credentials_organization_id_provider_idx" ON "provider_credentials"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "usage_records_organization_id_created_at_idx" ON "usage_records"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- Multi-tenancy: aislamiento por fila (ADR-0002, ADR-0007)
--
-- Prisma no genera nada de lo que sigue. Se escribe a mano y se revisa en
-- cada cambio de esquema.
--
-- Contexto por transacción (lo fija src/db/prisma.js):
--   app.organization_id  → la organización de la petición
--   app.context          → 'platform' solo para operaciones de plataforma
--                          (crear organizaciones, resolver una API key,
--                          iniciar sesión). Nunca desde un handler de tenant.
-- ============================================================

CREATE OR REPLACE FUNCTION app_current_organization_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.context', true) = 'platform'
$$;

CREATE OR REPLACE FUNCTION app_can_access(org uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_is_platform() OR org = app_current_organization_id()
$$;

-- Tablas de tenant: solo las filas de la organización en contexto.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "organizations"
  USING (app_can_access("id")) WITH CHECK (app_can_access("id"));

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "memberships"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));

ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "api_keys"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));

ALTER TABLE "provider_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_credentials" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "provider_credentials"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));

ALTER TABLE "usage_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "usage_records"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));

-- Usuarios: globales. En contexto de tenant solo se ven los miembros de la
-- organización; crear o buscar usuarios por email es cosa de plataforma.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_full_access ON "users"
  USING (app_is_platform()) WITH CHECK (app_is_platform());
CREATE POLICY tenant_members_read ON "users" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."user_id" = "users"."id"
      AND m."organization_id" = app_current_organization_id()
  ));

-- ============================================================
-- Rol de la aplicación
--
-- La API conecta con un rol que hereda de `cocochat_app`: sin BYPASSRLS,
-- sin SUPERUSER y que NO es dueño de las tablas. Con el rol equivocado las
-- políticas se aplican pero no filtran nada; src/db/prisma.js lo comprueba
-- al arrancar. Las migraciones se ejecutan con el rol dueño del esquema.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cocochat_app') THEN
    CREATE ROLE cocochat_app NOLOGIN NOBYPASSRLS NOSUPERUSER;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA "public" TO cocochat_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO cocochat_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cocochat_app;
-- La tabla de control de Prisma es solo del rol de migraciones.
REVOKE ALL ON TABLE "_prisma_migrations" FROM cocochat_app;
