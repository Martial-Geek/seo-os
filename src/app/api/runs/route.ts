import { NextRequest, NextResponse } from 'next/server'
import { agentService } from '@/services/agent-service'
import db from '@/db'
import { agentRuns } from '@/db/schema'
import { desc, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const offset = (page - 1) * limit

    const [runs, countResult] = await Promise.all([
      db
        .select()
        .from(agentRuns)
        .orderBy(desc(agentRuns.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentRuns),
    ])

    const total = countResult[0]?.count ?? 0

    return NextResponse.json({ runs, total, page, limit })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const trigger: 'manual' | 'scheduled' =
      body.trigger === 'scheduled' ? 'scheduled' : 'manual'

    const runId = await agentService.startRun(trigger)

    return NextResponse.json({ runId }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
