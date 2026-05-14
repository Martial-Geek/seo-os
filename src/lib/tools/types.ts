import type { db } from '@/db'
import type { MemoryService } from '@/lib/memory/memory-service'

export interface ToolHandler<T> {
  validate(payload: unknown): T
  execute(payload: T, context: ToolContext): Promise<ToolResult>
}

export interface ToolContext {
  runId: string
  executedBy: string
  db: typeof db
  memory: MemoryService
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  externalId?: string
}
