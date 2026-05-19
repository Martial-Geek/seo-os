import { NextRequest, NextResponse, after } from 'next/server'
import { agentService } from '@/services/agent-service'
import db from '@/db'
import { proposedActions } from '@/db/schema'
import { inArray } from 'drizzle-orm'

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

    const run = await agentService.getRun(id)
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.status === 'running') {
      return NextResponse.json({ error: 'This run is already executing' }, { status: 409 })
    }
    if (run.status === 'completed' || run.status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot start execution for a ${run.status} run` },
        { status: 409 }
      )
    }

    // Block if too many active proposals already exist
    const allActive = await db
      .select()
      .from(proposedActions)
      .where(inArray(proposedActions.status, ['pending', 'approved']))
    if (allActive.length >= GENERATION_BLOCKED_THRESHOLD) {
      return NextResponse.json(
        {
          error: `${allActive.length} proposals are still pending or approved. Complete or discard most of them before running the agent (threshold: ${GENERATION_BLOCKED_THRESHOLD}).`,
          activeCount: allActive.length,
          threshold: GENERATION_BLOCKED_THRESHOLD,
        },
        { status: 409 }
      )
    }

    after(async () => {
      try {
        await agentService.executeRun(id)
      } catch (err) {
        console.error(`[POST /api/runs/${id}/execute] executeRun failed:`, err)
      }
    })

    return NextResponse.json(
      { message: 'Execution started', runId: id },
      { status: 202 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
