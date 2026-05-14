import { NextRequest, NextResponse } from 'next/server'
import db from '@/db'
import { memoryEntries } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const results = await db
      .select()
      .from(memoryEntries)
      .where(
        category
          ? eq(
              memoryEntries.category,
              category as
                | 'blog_topic'
                | 'seo_observation'
                | 'strategic_insight'
                | 'rejected_suggestion'
                | 'action_history'
            )
          : undefined
      )
      .orderBy(desc(memoryEntries.lastAccessedAt))

    return NextResponse.json({ entries: results, total: results.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    await db.delete(memoryEntries).where(eq(memoryEntries.id, id))

    return NextResponse.json({ message: 'Memory entry deleted', id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
