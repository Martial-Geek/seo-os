'use server'

import { revalidatePath } from 'next/cache'
import { agentService } from '@/services/agent-service'
import db from '@/db'
import { proposedActions } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

/**
 * Approves a proposed action.
 */
export async function approveAction(
  proposedActionId: string,
  decidedBy: string,
  notes?: string
): Promise<{ success: boolean }> {
  await agentService.approveAction(proposedActionId, decidedBy, notes)
  revalidatePath('/actions')
  return { success: true }
}

/**
 * Rejects a proposed action.
 */
export async function rejectAction(
  proposedActionId: string,
  decidedBy: string,
  notes?: string
): Promise<{ success: boolean }> {
  await agentService.rejectAction(proposedActionId, decidedBy, notes)
  revalidatePath('/actions')
  return { success: true }
}

/**
 * Fetches proposed actions with optional filters.
 */
export async function getProposedActions(filters?: {
  status?: 'pending' | 'approved' | 'rejected' | 'executed' | 'skipped'
  runId?: string
  actionType?: string
  limit?: number
}) {
  const conditions: SQL[] = []

  if (filters?.status) {
    conditions.push(eq(proposedActions.status, filters.status))
  }

  if (filters?.runId) {
    conditions.push(eq(proposedActions.runId, filters.runId))
  }

  if (filters?.actionType) {
    conditions.push(eq(proposedActions.actionType, filters.actionType))
  }

  const query = db
    .select()
    .from(proposedActions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(proposedActions.createdAt))

  if (filters?.limit) {
    return query.limit(filters.limit)
  }

  return query
}

/**
 * Executes all pending approved actions for a given run.
 */
export async function executePendingApprovedActions(
  runId: string
): Promise<{ success: boolean }> {
  await agentService.executePendingApprovedActions(runId)
  revalidatePath(`/runs/${runId}`)
  revalidatePath('/actions')
  return { success: true }
}
