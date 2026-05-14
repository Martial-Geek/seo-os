import { db } from '@/db'
import { executedActions, proposedActions } from '@/db/schema'
import { MemoryService } from '@/lib/memory/memory-service'
import { executeAction } from '@/lib/tools/registry'
import type { AgentState, AgentProposedAction } from '@/types'
import { eq } from 'drizzle-orm'

// Extended state type that includes graph-only fields
type ExecutionState = AgentState & { execution_results?: unknown[] }
type ExecutionStateReturn = Partial<AgentState> & { execution_results?: unknown[] }

export async function executionNode(
  state: ExecutionState
): Promise<ExecutionStateReturn> {
  const runId = state.current_run_id
  console.log(`[executionNode] Executing approved actions for run ${runId}`)

  if (!runId) {
    console.warn('[executionNode] No run_id in state, skipping execution')
    return {}
  }

  const approvedActions = state.proposed_actions.filter(
    (a) => a.status === 'approved'
  )

  if (approvedActions.length === 0) {
    console.log('[executionNode] No approved actions to execute')
    return {}
  }

  console.log(`[executionNode] Executing ${approvedActions.length} approved actions`)

  const memoryService = new MemoryService(db)
  const executionResults: Array<{
    actionId: string
    actionType: string
    success: boolean
    result: unknown
  }> = []

  const updatedActions: AgentProposedAction[] = [...state.proposed_actions]

  for (const action of approvedActions) {
    console.log(`[executionNode] Executing: ${action.actionType} (${action.id})`)

    try {
      const result = await executeAction(action.actionType, action.payload, {
        runId,
        executedBy: 'agent',
        db,
        memory: memoryService,
      })

      // Store executed action record in DB
      await db.insert(executedActions).values({
        proposedActionId: action.id,
        runId,
        result: result as unknown as Record<string, unknown>,
        executedBy: 'agent',
      })

      // Update proposed action status
      const newStatus = result.success ? 'executed' : 'skipped'
      await db
        .update(proposedActions)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(proposedActions.id, action.id))

      // Update in-state action
      const idx = updatedActions.findIndex((a) => a.id === action.id)
      if (idx !== -1) {
        updatedActions[idx] = { ...action, status: newStatus }
      }

      // Record in memory
      await memoryService.recordActionHistory(
        action.actionType,
        result.success
          ? `Successfully executed ${action.actionType}: ${JSON.stringify(result.data ?? {}).substring(0, 200)}`
          : `Failed to execute ${action.actionType}: ${result.error ?? 'unknown error'}`,
        runId
      )

      executionResults.push({
        actionId: action.id,
        actionType: action.actionType,
        success: result.success,
        result,
      })

      console.log(
        `[executionNode] ${result.success ? 'SUCCESS' : 'FAILED'}: ${action.actionType} (${action.id})`
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[executionNode] Error executing ${action.actionType}:`, message)

      // Mark as skipped on unexpected error
      await db
        .update(proposedActions)
        .set({ status: 'skipped', updatedAt: new Date() })
        .where(eq(proposedActions.id, action.id))

      const idx = updatedActions.findIndex((a) => a.id === action.id)
      if (idx !== -1) {
        updatedActions[idx] = { ...action, status: 'skipped' }
      }

      executionResults.push({
        actionId: action.id,
        actionType: action.actionType,
        success: false,
        result: { error: message },
      })
    }
  }

  const successCount = executionResults.filter((r) => r.success).length
  console.log(
    `[executionNode] Completed: ${successCount}/${executionResults.length} actions succeeded`
  )

  return {
    proposed_actions: updatedActions,
    execution_results: [...(state.execution_results ?? []), ...executionResults],
  } as ExecutionStateReturn
}
