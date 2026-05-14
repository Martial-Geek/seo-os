import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { agentRuns } from '@/db/schema'
import { MemoryService } from '@/lib/memory/memory-service'
import type { AgentState } from '@/types'

// Extended state type that includes graph-only fields
type LoggingState = AgentState & { execution_results?: unknown[] }

export async function loggingNode(
  state: LoggingState
): Promise<Partial<LoggingState>> {
  const runId = state.current_run_id
  console.log(`[loggingNode] Finalizing run ${runId}`)

  const memoryService = new MemoryService(db)

  const totalObservations = state.observations.length
  const totalProposed = state.proposed_actions.length
  const totalApproved = state.proposed_actions.filter((a) => a.status === 'approved' || a.status === 'executed').length
  const totalExecuted = state.proposed_actions.filter((a) => a.status === 'executed').length
  const totalSkipped = state.proposed_actions.filter((a) => a.status === 'skipped').length
  const totalPending = state.proposed_actions.filter((a) => a.status === 'pending').length
  const executionResults = (state.execution_results ?? []) as Array<{
    actionId: string
    actionType: string
    success: boolean
  }>
  const executionSuccessCount = executionResults.filter((r) => r.success).length

  const summary = {
    runId,
    completedAt: new Date().toISOString(),
    observations: totalObservations,
    proposedActions: totalProposed,
    approvedActions: totalApproved,
    executedActions: totalExecuted,
    skippedActions: totalSkipped,
    pendingApprovalActions: totalPending,
    executionSuccessRate:
      totalExecuted > 0 ? `${executionSuccessCount}/${totalExecuted}` : '0/0',
    strategicSuggestions: state.strategic_suggestions.length,
    triggerType: state.run_metadata?.trigger_type ?? 'manual',
  }

  console.log('[loggingNode] Run summary:', summary)

  // Update agent_run status to completed
  if (runId) {
    try {
      await db
        .update(agentRuns)
        .set({
          status: 'completed',
          completedAt: new Date(),
          metadata: {
            ...(state.run_metadata as unknown as Record<string, unknown>),
            ...summary,
          },
        })
        .where(eq(agentRuns.id, runId))
    } catch (err) {
      console.error('[loggingNode] Failed to update agent run status:', err)
    }

    // Store final summary in memory
    try {
      await memoryService.upsertMemory(
        `action_history:run_summary:${runId}`,
        'action_history',
        summary,
        0.7
      )
    } catch (err) {
      console.error('[loggingNode] Failed to store run summary in memory:', err)
    }
  }

  return state
}
