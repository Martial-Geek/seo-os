import { z, ZodError } from 'zod'
import {
  ActionType,
  CreateBlogSchema,
  UpdateBlogSchema,
  AddInternalLinksSchema,
  UpdateMetadataSchema,
  GenerateOutlineSchema,
  CreateTopicClusterSchema,
  MergeContentSchema,
  DeleteContentSchema,
  UpdateSchemaMarkupSchema,
} from '@/types'
import type { ExecutableOperation } from '@/types'

// ─── Schema Map ───────────────────────────────────────────────────────────────

const ACTION_SCHEMA_MAP: Record<ActionType, z.ZodTypeAny> = {
  [ActionType.CREATE_BLOG]: CreateBlogSchema,
  [ActionType.UPDATE_BLOG]: UpdateBlogSchema,
  [ActionType.ADD_INTERNAL_LINKS]: AddInternalLinksSchema,
  [ActionType.UPDATE_METADATA]: UpdateMetadataSchema,
  [ActionType.GENERATE_OUTLINE]: GenerateOutlineSchema,
  [ActionType.CREATE_TOPIC_CLUSTER]: CreateTopicClusterSchema,
  [ActionType.MERGE_CONTENT]: MergeContentSchema,
  [ActionType.DELETE_CONTENT]: DeleteContentSchema,
  [ActionType.UPDATE_SCHEMA_MARKUP]: UpdateSchemaMarkupSchema,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Picks the correct Zod schema based on actionType and parses payload.
 * Throws ZodError if validation fails.
 */
export function validateAction(
  actionType: ActionType,
  payload: unknown
): ExecutableOperation {
  const schema = ACTION_SCHEMA_MAP[actionType]
  if (!schema) {
    throw new Error(`Unknown action type: ${actionType}`)
  }

  const parsed = schema.parse(payload)

  return { type: actionType, payload: parsed } as ExecutableOperation
}

/**
 * Returns true if the action type is high risk (DELETE_CONTENT, MERGE_CONTENT).
 */
export function isHighRisk(actionType: ActionType): boolean {
  return (
    actionType === ActionType.DELETE_CONTENT ||
    actionType === ActionType.MERGE_CONTENT
  )
}

/**
 * Returns true if the action type is medium risk (UPDATE_BLOG, UPDATE_METADATA).
 */
export function isMediumRisk(actionType: ActionType): boolean {
  return (
    actionType === ActionType.UPDATE_BLOG ||
    actionType === ActionType.UPDATE_METADATA
  )
}

/**
 * Formats a ZodError into a human-readable string.
 */
export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join(', ')
}
