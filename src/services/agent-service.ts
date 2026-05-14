import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import {
  agentRuns,
  approvals,
  executedActions,
  observations,
  proposedActions,
} from '@/db/schema'
import type {
  AgentRun,
  Approval,
  ExecutedAction,
  NewAgentRun,
  Observation,
  ProposedAction,
} from '@/db/schema'
import { MemoryService } from '@/lib/memory/memory-service'
import { executeAction } from '@/lib/tools/registry'
import { runSEOAgent } from '@/agents/graphs/seo-graph'
import type { ActionType, TriggerType } from '@/types'

// ─── Run Details Type ──────────────────────────────────────────────────────────

export interface RunDetails {
  run: AgentRun
  observations: Observation[]
  proposed_actions: ProposedAction[]
  executed_actions: ExecutedAction[]
  approvals: Approval[]
}

// ─── AgentService ──────────────────────────────────────────────────────────────

export class AgentService {
  private readonly memoryService: MemoryService

  constructor() {
    this.memoryService = new MemoryService(db)
  }

  /**
   * Creates an agent_run record and returns the new run ID.
   */
  async startRun(trigger: TriggerType = 'manual'): Promise<string> {
    const [run] = await db
      .insert(agentRuns)
      .values({
        status: 'pending',
        triggerType: trigger,
        startedAt: new Date(),
        metadata: {
          trigger_type: trigger,
          started_at: new Date().toISOString(),
        },
      } satisfies NewAgentRun)
      .returning()

    if (!run) {
      throw new Error('Failed to create agent run record')
    }

    console.log(`[AgentService] Created run: ${run.id} (trigger: ${trigger})`)
    return run.id
  }

  /**
   * Marks the run as running and invokes the LangGraph pipeline.
   */
  async executeRun(runId: string): Promise<void> {
    // Mark as running
    await db
      .update(agentRuns)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(agentRuns.id, runId))

    try {
      await runSEOAgent(runId)
      // loggingNode handles marking completed
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[AgentService] Run ${runId} failed:`, message)

      await db
        .update(agentRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error: message,
        })
        .where(eq(agentRuns.id, runId))

      throw err
    }
  }

  /**
   * Cancels a run that is pending or running.
   */
  async cancelRun(runId: string): Promise<void> {
    await db
      .update(agentRuns)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(agentRuns.id, runId))

    console.log(`[AgentService] Cancelled run: ${runId}`)
  }

  /**
   * Fetches a single agent run by ID.
   */
  async getRun(runId: string): Promise<AgentRun | null> {
    const results = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId))
      .limit(1)

    return results[0] ?? null
  }

  /**
   * Fetches a run with all related records.
   */
  async getRunWithDetails(runId: string): Promise<RunDetails | null> {
    const run = await this.getRun(runId)
    if (!run) return null

    const [obs, proposed, executed] = await Promise.all([
      db.select().from(observations).where(eq(observations.runId, runId)),
      db.select().from(proposedActions).where(eq(proposedActions.runId, runId)),
      db.select().from(executedActions).where(eq(executedActions.runId, runId)),
    ])

    // Fetch approvals for all proposed actions in this run
    const proposedIds = proposed.map((p) => p.id)
    let approvalsList: Approval[] = []
    if (proposedIds.length > 0) {
      const { inArray } = await import('drizzle-orm')
      approvalsList = await db
        .select()
        .from(approvals)
        .where(inArray(approvals.proposedActionId, proposedIds))
    }

    return {
      run,
      observations: obs,
      proposed_actions: proposed,
      executed_actions: executed,
      approvals: approvalsList,
    }
  }

  /**
   * Approves a proposed action and creates an approval record.
   */
  async approveAction(
    proposedActionId: string,
    decidedBy: string,
    notes?: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(proposedActions)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(proposedActions.id, proposedActionId))

      await tx.insert(approvals).values({
        proposedActionId,
        decision: 'approved',
        decidedBy,
        notes: notes ?? null,
      })
    })

    console.log(
      `[AgentService] Approved action ${proposedActionId} by ${decidedBy}`
    )
  }

  /**
   * Rejects a proposed action and creates an approval record.
   * Also stores in memory so future runs don't repeat the suggestion.
   */
  async rejectAction(
    proposedActionId: string,
    decidedBy: string,
    notes?: string
  ): Promise<void> {
    // Fetch the action first so we can store it in memory
    const [action] = await db
      .select()
      .from(proposedActions)
      .where(eq(proposedActions.id, proposedActionId))
      .limit(1)

    await db.transaction(async (tx) => {
      await tx
        .update(proposedActions)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(proposedActions.id, proposedActionId))

      await tx.insert(approvals).values({
        proposedActionId,
        decision: 'rejected',
        decidedBy,
        notes: notes ?? null,
      })
    })

    // Store in memory for deduplication in future runs
    if (action) {
      const payload = action.payload as Record<string, unknown>
      const titleSlug =
        typeof payload['title'] === 'string'
          ? payload['title'].toLowerCase().replace(/\s+/g, '-').substring(0, 60)
          : proposedActionId.substring(0, 20)

      const rejectionKey = `rejected_suggestion:${action.actionType}:${titleSlug}`
      await this.memoryService.upsertMemory(
        rejectionKey,
        'rejected_suggestion',
        {
          actionType: action.actionType,
          payload,
          rejectedBy: decidedBy,
          rejectionNotes: notes,
          rejectedAt: new Date().toISOString(),
        },
        0.9
      )
    }

    console.log(
      `[AgentService] Rejected action ${proposedActionId} by ${decidedBy}`
    )
  }

  /**
   * Finds all approved-but-not-yet-executed actions for a run and executes them.
   * Useful for processing actions approved asynchronously after initial run.
   */
  async executePendingApprovedActions(runId: string): Promise<void> {
    const run = await this.getRun(runId)
    if (!run) throw new Error(`Run not found: ${runId}`)

    // Find approved actions that haven't been executed yet
    const approved = await db
      .select()
      .from(proposedActions)
      .where(eq(proposedActions.runId, runId))

    const toExecute = approved.filter((a) => a.status === 'approved')

    if (toExecute.length === 0) {
      console.log(`[AgentService] No pending approved actions for run ${runId}`)
      return
    }

    console.log(
      `[AgentService] Executing ${toExecute.length} pending approved actions for run ${runId}`
    )

    for (const action of toExecute) {
      try {
        const result = await executeAction(
          action.actionType as ActionType,
          action.payload,
          {
            runId,
            executedBy: 'agent:async',
            db,
            memory: this.memoryService,
          }
        )

        // Check if already executed (prevent double execution)
        const existing = await db
          .select()
          .from(executedActions)
          .where(eq(executedActions.proposedActionId, action.id))
          .limit(1)

        if (existing.length === 0) {
          await db.insert(executedActions).values({
            proposedActionId: action.id,
            runId,
            result: result as unknown as Record<string, unknown>,
            executedBy: 'agent:async',
          })
        }

        const newStatus = result.success ? 'executed' : 'skipped'
        await db
          .update(proposedActions)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(proposedActions.id, action.id))

        await this.memoryService.recordActionHistory(
          action.actionType,
          result.success
            ? `Async executed ${action.actionType}: ${JSON.stringify(result.data ?? {}).substring(0, 200)}`
            : `Async execution failed for ${action.actionType}: ${result.error ?? 'unknown error'}`,
          runId
        )

        console.log(
          `[AgentService] Async executed ${action.actionType} (${action.id}): ${result.success ? 'success' : 'failed'}`
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(
          `[AgentService] Error executing action ${action.id}:`,
          message
        )
      }
    }
  }

  /**
   * Returns recent agent runs ordered by creation time descending.
   */
  async getRecentRuns(limit = 10): Promise<AgentRun[]> {
    return db
      .select()
      .from(agentRuns)
      .orderBy(desc(agentRuns.createdAt))
      .limit(limit)
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

export const agentService = new AgentService()
