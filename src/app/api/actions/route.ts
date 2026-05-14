import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { proposedActions } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const runId = searchParams.get('run_id')
    const actionType = searchParams.get('action_type')

    const filters: SQL[] = []

    if (status) {
      filters.push(
        eq(
          proposedActions.status,
          status as
            | 'pending'
            | 'approved'
            | 'rejected'
            | 'executed'
            | 'skipped'
        )
      )
    }

    if (runId) {
      filters.push(eq(proposedActions.runId, runId))
    }

    if (actionType) {
      filters.push(eq(proposedActions.actionType, actionType))
    }

    const results = await db
      .select()
      .from(proposedActions)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(proposedActions.createdAt))

    return NextResponse.json({ actions: results, total: results.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
