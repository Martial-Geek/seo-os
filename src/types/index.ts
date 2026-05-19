import { z } from 'zod'

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ActionType {
  CREATE_BLOG = 'CREATE_BLOG',
  UPDATE_BLOG = 'UPDATE_BLOG',
  ADD_INTERNAL_LINKS = 'ADD_INTERNAL_LINKS',
  UPDATE_METADATA = 'UPDATE_METADATA',
  GENERATE_OUTLINE = 'GENERATE_OUTLINE',
  CREATE_TOPIC_CLUSTER = 'CREATE_TOPIC_CLUSTER',
  MERGE_CONTENT = 'MERGE_CONTENT',
  DELETE_CONTENT = 'DELETE_CONTENT',
  UPDATE_SCHEMA_MARKUP = 'UPDATE_SCHEMA_MARKUP',
}

// ─── Literal / Union Types ────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export type AgentRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TriggerType = 'manual' | 'scheduled'

export type ObservationSource = 'search_console' | 'analytics' | 'sanity' | 'memory'

export type UserRole = 'admin' | 'viewer'

export type MemoryCategory =
  | 'blog_topic'
  | 'seo_observation'
  | 'strategic_insight'
  | 'rejected_suggestion'
  | 'action_history'

export type ApprovalDecision = 'approved' | 'rejected'

export type ProposedActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'skipped'

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── Agent State (LangGraph) ──────────────────────────────────────────────────

export interface AgentObservation {
  id: string
  source: ObservationSource
  type: string
  data: Record<string, unknown>
  createdAt: Date
}

export interface AgentProposedAction {
  id: string
  actionType: ActionType
  payload: Record<string, unknown>
  riskLevel: RiskLevel
  status: ProposedActionStatus
  requiresApproval: boolean
  reasoning?: string
}

export interface AgentState {
  observations: AgentObservation[]
  proposed_actions: AgentProposedAction[]
  strategic_suggestions: StrategicSuggestion[]
  memory_context: MemoryContext
  conversation_history: ConversationMessage[]
  current_run_id: string | null
  run_metadata: RunMetadata
}

export interface MemoryContext {
  recent_topics: string[]
  rejected_suggestions: string[]
  strategic_insights: string[]
  action_history: ActionHistoryEntry[]
}

export interface ActionHistoryEntry {
  actionType: ActionType
  executedAt: Date
  outcome: 'success' | 'failure'
  summary: string
}

export interface RunMetadata {
  trigger_type: TriggerType
  started_at: Date | null
  completed_at: Date | null
  error?: string
  observations_count: number
  actions_proposed: number
  actions_executed: number
}

// ─── Strategic Suggestion ─────────────────────────────────────────────────────

export interface StrategicSuggestion {
  id: string
  title: string
  description: string
  rationale: string
  supporting_data: Record<string, unknown>
  estimated_impact: 'low' | 'medium' | 'high'
  category: string
  created_at: Date
}

// ─── MCP Tool Result ──────────────────────────────────────────────────────────

export interface MCPToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: Record<string, unknown>
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const CreateBlogSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
  outline: z.string().min(1),
  target_keywords: z.array(z.string().min(1)).min(1).max(20),
  meta_description: z.string().min(1).max(160),
  word_count_target: z.number().int().min(100).max(20000),
  internal_links: z.array(z.string().url()).default([]),
  content_draft: z.string().optional(),
})

export const UpdateBlogSchema = z.object({
  external_id: z.string().min(1),
  changes: z
    .object({
      title: z.string().min(1).max(500).optional(),
      slug: z
        .string()
        .min(1)
        .max(500)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
      outline: z.string().min(1).optional(),
      target_keywords: z.array(z.string().min(1)).min(1).max(20).optional(),
      meta_description: z.string().min(1).max(160).optional(),
      word_count_target: z.number().int().min(100).max(20000).optional(),
      internal_links: z.array(z.string().url()).optional(),
      content_draft: z.string().optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'At least one change field must be provided',
    }),
  reason: z.string().min(1).max(1000),
})

export const AddInternalLinksSchema = z.object({
  source_id: z.string().min(1),
  links: z
    .array(
      z.object({
        target_id: z.string().min(1),
        anchor_text: z.string().min(1).max(200),
        position: z.number().int().min(0),
      })
    )
    .min(1)
    .max(50),
})

export const UpdateMetadataSchema = z.object({
  external_id: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  seo_title: z.string().min(1).max(500).optional(),
  seo_description: z.string().min(1).max(160).optional(),
  og_title: z.string().min(1).max(500).optional(),
  og_description: z.string().min(1).max(300).optional(),
})

export const GenerateOutlineSchema = z.object({
  title: z.string().min(1).max(500),
  target_keywords: z.array(z.string().min(1)).min(1).max(20),
  section_count: z.number().int().min(2).max(20),
  word_count_target: z.number().int().min(100).max(20000),
  content_type: z.enum([
    'how-to',
    'listicle',
    'pillar',
    'comparison',
    'review',
    'news',
    'guide',
    'case-study',
  ]),
})

export const CreateTopicClusterSchema = z.object({
  pillar_topic: z.string().min(1).max(500),
  subtopics: z.array(z.string().min(1)).min(2).max(30),
  existing_content_ids: z.array(z.string().min(1)).default([]),
})

export const MergeContentSchema = z.object({
  source_ids: z.array(z.string().min(1)).min(2).max(10),
  target_title: z.string().min(1).max(500),
  target_slug: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  reason: z.string().min(1).max(1000),
})

export const DeleteContentSchema = z.object({
  external_id: z.string().min(1),
  reason: z.string().min(1).max(1000),
  require_confirmation: z.literal(true),
})

export const UpdateSchemaMarkupSchema = z.object({
  external_id: z.string().min(1),
  schema_type: z.enum([
    'Article',
    'BlogPosting',
    'FAQPage',
    'HowTo',
    'WebPage',
    'Product',
    'Review',
    'BreadcrumbList',
  ]),
  schema_data: z.record(z.string(), z.unknown()),
  reason: z.string().min(1).max(1000),
})

// ─── Inferred Schema Types ────────────────────────────────────────────────────

export type CreateBlogPayload = z.infer<typeof CreateBlogSchema>
export type UpdateBlogPayload = z.infer<typeof UpdateBlogSchema>
export type AddInternalLinksPayload = z.infer<typeof AddInternalLinksSchema>
export type UpdateMetadataPayload = z.infer<typeof UpdateMetadataSchema>
export type GenerateOutlinePayload = z.infer<typeof GenerateOutlineSchema>
export type CreateTopicClusterPayload = z.infer<typeof CreateTopicClusterSchema>
export type MergeContentPayload = z.infer<typeof MergeContentSchema>
export type DeleteContentPayload = z.infer<typeof DeleteContentSchema>
export type UpdateSchemaMarkupPayload = z.infer<typeof UpdateSchemaMarkupSchema>

// ─── Discriminated Union ──────────────────────────────────────────────────────

export type ExecutableOperation =
  | { type: ActionType.CREATE_BLOG; payload: CreateBlogPayload }
  | { type: ActionType.UPDATE_BLOG; payload: UpdateBlogPayload }
  | { type: ActionType.ADD_INTERNAL_LINKS; payload: AddInternalLinksPayload }
  | { type: ActionType.UPDATE_METADATA; payload: UpdateMetadataPayload }
  | { type: ActionType.GENERATE_OUTLINE; payload: GenerateOutlinePayload }
  | { type: ActionType.CREATE_TOPIC_CLUSTER; payload: CreateTopicClusterPayload }
  | { type: ActionType.MERGE_CONTENT; payload: MergeContentPayload }
  | { type: ActionType.DELETE_CONTENT; payload: DeleteContentPayload }
  | { type: ActionType.UPDATE_SCHEMA_MARKUP; payload: UpdateSchemaMarkupPayload }

// ─── API Response Types ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

export interface ApiError {
  message: string
  code: string
  details?: Record<string, unknown>
}
