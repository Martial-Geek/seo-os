-- SEO OS Initial Migration
-- Generated reference SQL matching Drizzle ORM schema

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "user_role" AS ENUM ('admin', 'viewer');

CREATE TYPE "agent_run_status" AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE "trigger_type" AS ENUM ('manual', 'scheduled');

CREATE TYPE "observation_source" AS ENUM (
  'search_console',
  'analytics',
  'sanity',
  'memory'
);

CREATE TYPE "risk_level" AS ENUM ('low', 'medium', 'high');

CREATE TYPE "proposed_action_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'executed',
  'skipped'
);

CREATE TYPE "memory_category" AS ENUM (
  'blog_topic',
  'seo_observation',
  'strategic_insight',
  'rejected_suggestion',
  'action_history'
);

CREATE TYPE "approval_decision" AS ENUM ('approved', 'rejected');

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"      VARCHAR(255) NOT NULL UNIQUE,
  "name"       VARCHAR(255),
  "role"       "user_role" NOT NULL DEFAULT 'viewer',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "agent_runs" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "status"       "agent_run_status" NOT NULL DEFAULT 'pending',
  "trigger_type" "trigger_type" NOT NULL DEFAULT 'manual',
  "started_at"   TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "error"        TEXT,
  "metadata"     JSONB DEFAULT '{}'::jsonb,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "observations" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id"     UUID NOT NULL REFERENCES "agent_runs"("id") ON DELETE CASCADE,
  "source"     "observation_source" NOT NULL,
  "type"       VARCHAR(100) NOT NULL,
  "data"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "proposed_actions" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id"            UUID NOT NULL REFERENCES "agent_runs"("id") ON DELETE CASCADE,
  "action_type"       VARCHAR(100) NOT NULL,
  "payload"           JSONB NOT NULL,
  "risk_level"        "risk_level" NOT NULL DEFAULT 'medium',
  "status"            "proposed_action_status" NOT NULL DEFAULT 'pending',
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "reasoning"         TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "executed_actions" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "proposed_action_id" UUID NOT NULL UNIQUE REFERENCES "proposed_actions"("id") ON DELETE RESTRICT,
  "run_id"             UUID NOT NULL REFERENCES "agent_runs"("id") ON DELETE CASCADE,
  "result"             JSONB DEFAULT '{}'::jsonb,
  "executed_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "executed_by"        VARCHAR(255)
);

CREATE TABLE "approvals" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "proposed_action_id" UUID NOT NULL REFERENCES "proposed_actions"("id") ON DELETE CASCADE,
  "decision"           "approval_decision" NOT NULL,
  "decided_by"         VARCHAR(255),
  "notes"              TEXT,
  "decided_at"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "memory_entries" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category"         "memory_category" NOT NULL,
  "key"              VARCHAR(500) NOT NULL UNIQUE,
  "value"            JSONB NOT NULL,
  "relevance_score"  NUMERIC(5, 2) NOT NULL DEFAULT 1,
  "last_accessed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expires_at"       TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "content_snapshots" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_id"    VARCHAR(500) NOT NULL,
  "source"         VARCHAR(100) NOT NULL,
  "title"          TEXT,
  "slug"           VARCHAR(500),
  "content_hash"   VARCHAR(64),
  "metadata"       JSONB DEFAULT '{}'::jsonb,
  "last_synced_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "conversations" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id"     UUID REFERENCES "agent_runs"("id") ON DELETE SET NULL,
  "messages"   JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_observations_run_id       ON "observations"("run_id");
CREATE INDEX idx_observations_source       ON "observations"("source");
CREATE INDEX idx_proposed_actions_run_id   ON "proposed_actions"("run_id");
CREATE INDEX idx_proposed_actions_status   ON "proposed_actions"("status");
CREATE INDEX idx_executed_actions_run_id   ON "executed_actions"("run_id");
CREATE INDEX idx_approvals_proposed_action ON "approvals"("proposed_action_id");
CREATE INDEX idx_memory_entries_category   ON "memory_entries"("category");
CREATE INDEX idx_memory_entries_expires_at ON "memory_entries"("expires_at");
CREATE INDEX idx_content_snapshots_source  ON "content_snapshots"("source");
CREATE INDEX idx_content_snapshots_ext_id  ON "content_snapshots"("external_id");
CREATE INDEX idx_conversations_run_id      ON "conversations"("run_id");
CREATE INDEX idx_agent_runs_status         ON "agent_runs"("status");
CREATE INDEX idx_agent_runs_trigger_type   ON "agent_runs"("trigger_type");
