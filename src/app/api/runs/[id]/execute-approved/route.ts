import { NextRequest, NextResponse, after } from 'next/server'
import { agentService } from '@/services/agent-service'

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

    after(async () => {
      try {
        await agentService.executePendingApprovedActions(id)
      } catch (err) {
        console.error(`[POST /api/runs/${id}/execute-approved] failed:`, err)
      }
    })

    return NextResponse.json(
      { message: 'Executing approved actions', runId: id },
      { status: 202 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
