import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { proposedActions } from '@/db/schema'
import type { AgentState, AgentProposedAction } from '@/types'

export async function approvalNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const runId = state.current_run_id
  const autoApproveLowRisk =
    process.env.AUTO_APPROVE_LOW_RISK === 'true'

  console.log(
    `[approvalNode] Processing ${state.proposed_actions.length} actions (auto-approve low risk: ${autoApproveLowRisk})`
  )

  const updatedActions: AgentProposedAction[] = []

  for (const action of state.proposed_actions) {
    // Skip actions that are already resolved
    if (
      action.status === 'approved' ||
      action.status === 'rejected' ||
      action.status === 'executed' ||
      action.status === 'skipped'
    ) {
      updatedActions.push(action)
      continue
    }

    const isLowRisk = action.riskLevel === 'low'
    const shouldAutoApprove = autoApproveLowRisk && isLowRisk && !action.requiresApproval

    if (shouldAutoApprove) {
      // Auto-approve low risk actions
      const updated: AgentProposedAction = {
        ...action,
        status: 'approved',
        requiresApproval: false,
      }
      updatedActions.push(updated)

      if (runId) {
        await db
          .update(proposedActions)
          .set({ status: 'approved', requiresApproval: false, updatedAt: new Date() })
          .where(eq(proposedActions.id, action.id))
      }

      console.log(
        `[approvalNode] Auto-approved low-risk action: ${action.actionType} (${action.id})`
      )
    } else if (!action.requiresApproval) {
      // Actions that don't require approval are auto-approved
      const updated: AgentProposedAction = {
        ...action,
        status: 'approved',
      }
      updatedActions.push(updated)

      if (runId) {
        await db
          .update(proposedActions)
          .set({ status: 'approved', updatedAt: new Date() })
          .where(eq(proposedActions.id, action.id))
      }

      console.log(
        `[approvalNode] Approved action (no approval required): ${action.actionType} (${action.id})`
      )
    } else {
      // Mark as pending — waiting for human approval
      const updated: AgentProposedAction = {
        ...action,
        status: 'pending',
        requiresApproval: true,
      }
      updatedActions.push(updated)

      if (runId) {
        await db
          .update(proposedActions)
          .set({ status: 'pending', requiresApproval: true, updatedAt: new Date() })
          .where(eq(proposedActions.id, action.id))
      }

      console.log(
        `[approvalNode] Action requires human approval: ${action.actionType} risk=${action.riskLevel} (${action.id})`
      )
    }
  }

  const approvedCount = updatedActions.filter((a) => a.status === 'approved').length
  const pendingCount = updatedActions.filter((a) => a.status === 'pending').length

  console.log(
    `[approvalNode] Result: ${approvedCount} approved, ${pendingCount} pending human review`
  )

  return {
    proposed_actions: updatedActions,
  }
}
