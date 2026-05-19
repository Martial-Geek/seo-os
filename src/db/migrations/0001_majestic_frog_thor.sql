CREATE TYPE "public"."agent_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."memory_category" AS ENUM('blog_topic', 'seo_observation', 'strategic_insight', 'rejected_suggestion', 'action_history');--> statement-breakpoint
CREATE TYPE "public"."observation_source" AS ENUM('search_console', 'analytics', 'sanity', 'memory');--> statement-breakpoint
CREATE TYPE "public"."proposed_action_status" AS ENUM('pending', 'approved', 'rejected', 'executed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'viewer');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "agent_run_status" DEFAULT 'pending' NOT NULL,
	"trigger_type" "trigger_type" DEFAULT 'manual' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposed_action_id" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"decided_by" varchar(255),
	"notes" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(500) NOT NULL,
	"source" varchar(100) NOT NULL,
	"title" text,
	"slug" varchar(500),
	"content_hash" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executed_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposed_action_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"executed_by" varchar(255),
	CONSTRAINT "executed_actions_proposed_action_id_unique" UNIQUE("proposed_action_id")
);
--> statement-breakpoint
CREATE TABLE "memory_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "memory_category" NOT NULL,
	"key" varchar(500) NOT NULL,
	"value" jsonb NOT NULL,
	"relevance_score" numeric(5, 2) DEFAULT '1' NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_entries_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source" "observation_source" NOT NULL,
	"type" varchar(100) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposed_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"risk_level" "risk_level" DEFAULT 'medium' NOT NULL,
	"status" "proposed_action_status" DEFAULT 'pending' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"reasoning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_proposed_action_id_proposed_actions_id_fk" FOREIGN KEY ("proposed_action_id") REFERENCES "public"."proposed_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executed_actions" ADD CONSTRAINT "executed_actions_proposed_action_id_proposed_actions_id_fk" FOREIGN KEY ("proposed_action_id") REFERENCES "public"."proposed_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executed_actions" ADD CONSTRAINT "executed_actions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_actions" ADD CONSTRAINT "proposed_actions_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;