import { NextRequest, NextResponse } from 'next/server'
import { agentService } from '@/services/agent-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const decidedBy: string = body.decidedBy ?? 'unknown'
    const notes: string | undefined = body.notes

    await agentService.rejectAction(id, decidedBy, notes)

    return NextResponse.json({ message: 'Action rejected', actionId: id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
