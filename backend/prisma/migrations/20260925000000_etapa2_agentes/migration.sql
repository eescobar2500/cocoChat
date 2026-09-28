-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "active_configuration_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "runtime" TEXT NOT NULL DEFAULT 'openai_responses',
    "published_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'api',
    "end_user_ref" TEXT,
    "external_session_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "token_usage" JSONB,
    "configuration_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_active_configuration_id_key" ON "agents"("active_configuration_id");

-- CreateIndex
CREATE INDEX "agents_organization_id_status_idx" ON "agents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "agent_configurations_organization_id_idx" ON "agent_configurations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configurations_agent_id_version_key" ON "agent_configurations"("agent_id", "version");

-- CreateIndex
CREATE INDEX "conversations_organization_id_agent_id_last_message_at_idx" ON "conversations"("organization_id", "agent_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_active_configuration_id_fkey" FOREIGN KEY ("active_configuration_id") REFERENCES "agent_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configurations" ADD CONSTRAINT "agent_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configurations" ADD CONSTRAINT "agent_configurations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "agent_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================
-- RLS (ADR-0002 / ADR-0007): mismas políticas que las tablas de la Etapa 1.
-- El GRANT de DML llega por ALTER DEFAULT PRIVILEGES de la migración inicial.
-- ============================================================

ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agents"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));

ALTER TABLE "agent_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_configurations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agent_configurations"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));

ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "conversations"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "messages"
  USING (app_can_access("organization_id")) WITH CHECK (app_can_access("organization_id"));
