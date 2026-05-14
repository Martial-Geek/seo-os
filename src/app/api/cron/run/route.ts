import { NextRequest, NextResponse, after } from 'next/server'
import { agentService } from '@/services/agent-service'

export async function GET(req: NextRequest) {
  try {
    const cronSecret = req.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET environment variable is not configured' },
        { status: 500 }
      )
    }

    if (!cronSecret || cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const runId = await agentService.startRun('scheduled')

    after(async () => {
      try {
        await agentService.executeRun(runId)
      } catch (err) {
        console.error(`[cron/run] executeRun failed for ${runId}:`, err)
      }
    })

    return NextResponse.json({
      message: 'Scheduled run started',
      runId,
      startedAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
