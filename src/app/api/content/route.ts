import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { contentSnapshots } from '@/db/schema'
import { desc, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
    )
    const offset = (page - 1) * limit

    const [snapshots, countResult] = await Promise.all([
      db
        .select()
        .from(contentSnapshots)
        .orderBy(desc(contentSnapshots.lastSyncedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contentSnapshots),
    ])

    const total = countResult[0]?.count ?? 0

    return NextResponse.json({
      content: snapshots,
      total,
      page,
      limit,
      hasNextPage: offset + snapshots.length < total,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
