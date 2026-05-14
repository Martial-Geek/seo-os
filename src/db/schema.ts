import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  numeric,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'viewer'])

export const agentRunStatusEnum = pgEnum('agent_run_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
])

export const triggerTypeEnum = pgEnum('trigger_type', ['manual', 'scheduled'])

export const observationSourceEnum = pgEnum('observation_source', [
  'search_console',
  'analytics',
  'sanity',
  'memory',
])

export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high'])

export const proposedActionStatusEnum = pgEnum('proposed_action_status', [
  'pending',
  'approved',
  'rejected',
  'executed',
  'skipped',
])

export const memoryCategoryEnum = pgEnum('memory_category', [
  'blog_topic',
  'seo_observation',
  'strategic_insight',
  'rejected_suggestion',
  'action_history',
])

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'approved',
  'rejected',
])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  role: userRoleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  status: agentRunStatusEnum('status').notNull().default('pending'),
  triggerType: triggerTypeEnum('trigger_type').notNull().default('manual'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export const observations = pgTable('observations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid('run_id')
    .notNull()
    .references(() => agentRuns.id, { onDelete: 'cascade' }),
  source: observationSourceEnum('source').notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export const proposedActions = pgTable('proposed_actions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid('run_id')
    .notNull()
    .references(() => agentRuns.id, { onDelete: 'cascade' }),
  actionType: varchar('action_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  riskLevel: riskLevelEnum('risk_level').notNull().default('medium'),
  status: proposedActionStatusEnum('status').notNull().default('pending'),
  requiresApproval: boolean('requires_approval').notNull().default(true),
  reasoning: text('reasoning'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export const executedActions = pgTable('executed_actions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  proposedActionId: uuid('proposed_action_id')
    .notNull()
    .unique()
    .references(() => proposedActions.id, { onDelete: 'restrict' }),
  runId: uuid('run_id')
    .notNull()
    .references(() => agentRuns.id, { onDelete: 'cascade' }),
  result: jsonb('result').default(sql`'{}'::jsonb`),
  executedAt: timestamp('executed_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  executedBy: varchar('executed_by', { length: 255 }),
})

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  proposedActionId: uuid('proposed_action_id')
    .notNull()
    .references(() => proposedActions.id, { onDelete: 'cascade' }),
  decision: approvalDecisionEnum('decision').notNull(),
  decidedBy: varchar('decided_by', { length: 255 }),
  notes: text('notes'),
  decidedAt: timestamp('decided_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export const memoryEntries = pgTable('memory_entries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  category: memoryCategoryEnum('category').notNull(),
  key: varchar('key', { length: 500 }).notNull().unique(),
  value: jsonb('value').notNull(),
  relevanceScore: numeric('relevance_score', { precision: 5, scale: 2 })
    .notNull()
    .default('1'),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export const contentSnapshots = pgTable('content_snapshots', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  externalId: varchar('external_id', { length: 500 }).notNull(),
  source: varchar('source', { length: 100 }).notNull(),
  title: text('title'),
  slug: varchar('slug', { length: 500 }),
  contentHash: varchar('content_hash', { length: 64 }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  messages: jsonb('messages').notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type AgentRun = typeof agentRuns.$inferSelect
export type NewAgentRun = typeof agentRuns.$inferInsert

export type Observation = typeof observations.$inferSelect
export type NewObservation = typeof observations.$inferInsert

export type ProposedAction = typeof proposedActions.$inferSelect
export type NewProposedAction = typeof proposedActions.$inferInsert

export type ExecutedAction = typeof executedActions.$inferSelect
export type NewExecutedAction = typeof executedActions.$inferInsert

export type Approval = typeof approvals.$inferSelect
export type NewApproval = typeof approvals.$inferInsert

export type MemoryEntry = typeof memoryEntries.$inferSelect
export type NewMemoryEntry = typeof memoryEntries.$inferInsert

export type ContentSnapshot = typeof contentSnapshots.$inferSelect
export type NewContentSnapshot = typeof contentSnapshots.$inferInsert

export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
