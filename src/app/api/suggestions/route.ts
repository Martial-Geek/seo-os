import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { memoryEntries } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10))
    )

    const suggestions = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.category, 'strategic_insight'))
      .orderBy(desc(memoryEntries.lastAccessedAt))
      .limit(limit)

    return NextResponse.json({ suggestions, total: suggestions.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
