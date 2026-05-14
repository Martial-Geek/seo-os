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

    // Fire and forget — do not await
    agentService.executeRun(id).catch(console.error)

    return NextResponse.json(
      { message: 'Execution started', runId: id },
      { status: 202 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
