import { eq, inArray, and } from 'drizzle-orm'
import { db } from '@/db'
import { proposedActions } from '@/db/schema'
import { MemoryService } from '@/lib/memory/memory-service'
import type { AgentState, AgentProposedAction } from '@/types'

const MAX_ACTIVE_PROPOSALS = 14
const GENERATION_BLOCKED_THRESHOLD = 7 // block new proposals above this many active

const RISK_SCORE: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

const ACTION_IMPACT_SCORE: Record<string, number> = {
  CREATE_BLOG: 3,
  UPDATE_BLOG: 2,
  GENERATE_OUTLINE: 2,
  UPDATE_METADATA: 2,
  ADD_INTERNAL_LINKS: 1,
  CREATE_TOPIC_CLUSTER: 3,
  MERGE_CONTENT: 2,
  DELETE_CONTENT: 1,
  UPDATE_SCHEMA_MARKUP: 2,
}

function scoreAction(action: AgentProposedAction): number {
  const impactScore = ACTION_IMPACT_SCORE[action.actionType] ?? 1
  const riskPenalty = RISK_SCORE[action.riskLevel] ?? 2
  // Higher impact is better, lower risk is better
  return impactScore * 3 - riskPenalty
}

export async function plannerNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const runId = state.current_run_id
  console.log(`[plannerNode] Planning ${state.proposed_actions.length} proposed actions`)

  if (state.proposed_actions.length === 0) {
    console.warn('[plannerNode] No proposed actions to plan')
    return {}
  }

  // Count active proposals globally (excluding this run's own proposals which are already in state)
  const thisRunIds = state.proposed_actions.map((a) => a.id)
  const globalActiveRows = await db
    .select()
    .from(proposedActions)
    .where(
      and(
        inArray(proposedActions.status, ['pending', 'approved']),
        ...(thisRunIds.length > 0 ? [] : [])
      )
    )
  const globalActiveFromOtherRuns = globalActiveRows.filter(
    (r) => !thisRunIds.includes(r.id)
  ).length
  const availableSlots = Math.max(0, MAX_ACTIVE_PROPOSALS - globalActiveFromOtherRuns)

  if (availableSlots === 0) {
    console.log(
      `[plannerNode] Global active proposals (${globalActiveFromOtherRuns}) reached cap of ${MAX_ACTIVE_PROPOSALS}. Skipping all new proposals.`
    )
    // Mark all pending proposals for this run as skipped
    if (runId && thisRunIds.length > 0) {
      await db
        .update(proposedActions)
        .set({ status: 'skipped' })
        .where(inArray(proposedActions.id, thisRunIds))
    }
    return { proposed_actions: [] }
  }

  const memoryService = new MemoryService(db)
  const rejectedKeys = await memoryService.getRejectedSuggestions()
  const rejectedSet = new Set(rejectedKeys)

  // Deduplicate and filter actions
  const seenActionKeys = new Set<string>()
  const filteredActions: AgentProposedAction[] = []

  for (const action of state.proposed_actions) {
    // Build a deduplication key from action type + key payload fields
    const payload = action.payload as Record<string, unknown>
    const dedupKey = buildDedupKey(action.actionType, payload)

    // Skip if we've already seen this action in this run
    if (seenActionKeys.has(dedupKey)) {
      console.log(`[plannerNode] Deduplicating repeated action: ${dedupKey}`)
      continue
    }

    // Skip if previously rejected
    const rejectionKey = `rejected_suggestion:${dedupKey}`
    if (rejectedSet.has(rejectionKey)) {
      console.log(`[plannerNode] Skipping previously rejected action: ${dedupKey}`)
      // Mark as skipped in DB
      if (runId) {
        await db
          .update(proposedActions)
          .set({ status: 'skipped' })
          .where(eq(proposedActions.id, action.id))
      }
      continue
    }

    // Check topic duplicates for content creation actions
    if (
      action.actionType === 'CREATE_BLOG' ||
      action.actionType === 'GENERATE_OUTLINE'
    ) {
      const title = typeof payload['title'] === 'string' ? payload['title'] : ''
      const keywords = Array.isArray(payload['target_keywords'])
        ? (payload['target_keywords'] as string[])
        : []

      const isDuplicate = await memoryService.isTopicDuplicate(title, keywords)
      if (isDuplicate) {
        console.log(`[plannerNode] Skipping duplicate topic: ${title}`)
        if (runId) {
          await db
            .update(proposedActions)
            .set({ status: 'skipped' })
            .where(eq(proposedActions.id, action.id))
        }
        continue
      }
    }

    seenActionKeys.add(dedupKey)
    filteredActions.push(action)
  }

  // Sort by impact score (descending) and cap to available slots
  const sortedActions = filteredActions
    .sort((a, b) => scoreAction(b) - scoreAction(a))
    .slice(0, availableSlots)

  // Mark over-cap proposals as skipped
  const keptIds = new Set(sortedActions.map((a) => a.id))
  const overCapIds = filteredActions
    .filter((a) => !keptIds.has(a.id))
    .map((a) => a.id)
  if (runId && overCapIds.length > 0) {
    await db
      .update(proposedActions)
      .set({ status: 'skipped' })
      .where(inArray(proposedActions.id, overCapIds))
    console.log(`[plannerNode] Capped ${overCapIds.length} over-limit proposals`)
  }

  // Mark high-risk actions as requires_approval=true in DB
  for (const action of sortedActions) {
    const needsApproval = action.riskLevel === 'high' || action.requiresApproval
    if (needsApproval !== action.requiresApproval && runId) {
      await db
        .update(proposedActions)
        .set({ requiresApproval: needsApproval })
        .where(eq(proposedActions.id, action.id))
    }
  }

  console.log(
    `[plannerNode] After planning: ${sortedActions.length} actions (filtered ${state.proposed_actions.length - sortedActions.length})`
  )

  return {
    proposed_actions: sortedActions,
  }
}

function buildDedupKey(actionType: string, payload: Record<string, unknown>): string {
  const keyParts: string[] = [actionType]

  if (typeof payload['title'] === 'string') {
    keyParts.push(payload['title'].toLowerCase().replace(/\s+/g, '-').substring(0, 60))
  }
  if (typeof payload['slug'] === 'string') {
    keyParts.push(payload['slug'].substring(0, 60))
  }
  if (typeof payload['external_id'] === 'string') {
    keyParts.push(payload['external_id'])
  }
  if (typeof payload['source_id'] === 'string') {
    keyParts.push(payload['source_id'])
  }

  return keyParts.join(':')
}
