'use server'

import { revalidatePath } from 'next/cache'
import { agentService } from '@/services/agent-service'
import type { TriggerType } from '@/types'

/**
 * Creates a new agent run record.
 */
export async function createRun(
  trigger: TriggerType = 'manual'
): Promise<{ runId: string }> {
  const runId = await agentService.startRun(trigger)
  revalidatePath('/runs')
  return { runId }
}

/**
 * Triggers execution of an existing run (fire-and-forget).
 */
export async function executeRun(runId: string): Promise<{ success: boolean }> {
  // Fire and forget
  agentService.executeRun(runId).catch(console.error)
  revalidatePath('/runs')
  revalidatePath(`/runs/${runId}`)
  return { success: true }
}

/**
 * Cancels a pending or running agent run.
 */
export async function cancelRun(runId: string): Promise<{ success: boolean }> {
  await agentService.cancelRun(runId)
  revalidatePath('/runs')
  revalidatePath(`/runs/${runId}`)
  return { success: true }
}

/**
 * Returns recent agent runs.
 */
export async function getRecentRuns(limit = 20) {
  return agentService.getRecentRuns(limit)
}

/**
 * Returns a run with its full details (observations, proposed actions, executed actions).
 */
export async function getRunDetails(runId: string) {
  return agentService.getRunWithDetails(runId)
}
