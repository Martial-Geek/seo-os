import { NextRequest, NextResponse, after } from 'next/server'
import { agentService } from '@/services/agent-service'
import db from '@/db'
import { proposedActions } from '@/db/schema'
import { inArray } from 'drizzle-orm'

const MAX_ACTIVE_PROPOSALS = 14
const GENERATION_BLOCKED_THRESHOLD = 7

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id === 'undefined') {
      return NextResponse.json({ error: 'Invalid run id' }, { status: 400 })
    }

    const details = await agentService.getRunWithDetails(id)
    if (!details) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const { run } = details

    if (run.status === 'running') {
      return NextResponse.json(
        { error: 'This run is already executing' },
        { status: 409 }
      )
    }

    if (details.observations.length === 0) {
      return NextResponse.json(
        {
          error:
            'No observations for this run yet. Finish collection and analysis first, then try again.',
        },
        { status: 400 }
      )
    }

    // Block generation if too many active proposals remain system-wide
    const allActive = await db
      .select()
      .from(proposedActions)
      .where(inArray(proposedActions.status, ['pending', 'approved']))
    if (allActive.length >= GENERATION_BLOCKED_THRESHOLD) {
      return NextResponse.json(
        {
          error: `${allActive.length} proposals are still pending or approved. Complete or discard most of them before generating new ones (threshold: ${GENERATION_BLOCKED_THRESHOLD}, cap: ${MAX_ACTIVE_PROPOSALS}).`,
          activeCount: allActive.length,
          threshold: GENERATION_BLOCKED_THRESHOLD,
        },
        { status: 409 }
      )
    }

    after(async () => {
      try {
        await agentService.runProposalsFromRunObservations(id)
      } catch (err) {
        console.error(`[POST /api/runs/${id}/proposals] runProposalsFromRunObservations failed:`, err)
      }
    })

    return NextResponse.json(
      { message: 'Proposal generation started', runId: id },
      { status: 202 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
