import { NextRequest, NextResponse } from 'next/server'
import { agentService } from '@/services/agent-service'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const run = await agentService.getRun(id)
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.status === 'completed' || run.status === 'failed') {
      return NextResponse.json(
        { error: `Cannot cancel a run with status: ${run.status}` },
        { status: 409 }
      )
    }

    await agentService.cancelRun(id)

    return NextResponse.json({ message: 'Run cancelled', runId: id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
