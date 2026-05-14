import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import type { db as DbType } from '@/db'
import { memoryEntries, observations } from '@/db/schema'
import type { MemoryEntry } from '@/db/schema'
import type { MemoryCategory } from '@/types'

export class MemoryService {
  constructor(private readonly db: typeof DbType) {}

  async getMemoryContext(categories?: string[]): Promise<MemoryEntry[]> {
    const query = this.db
      .select()
      .from(memoryEntries)
      .orderBy(desc(memoryEntries.relevanceScore))
      .limit(50)

    let results: MemoryEntry[]

    if (categories && categories.length > 0) {
      results = await this.db
        .select()
        .from(memoryEntries)
        .where(inArray(memoryEntries.category, categories as MemoryCategory[]))
        .orderBy(desc(memoryEntries.relevanceScore))
        .limit(50)
    } else {
      results = await query
    }

    // Update last_accessed_at for fetched entries
    if (results.length > 0) {
      const ids = results.map((r) => r.id)
      await this.db
        .update(memoryEntries)
        .set({ lastAccessedAt: new Date() })
        .where(inArray(memoryEntries.id, ids))
    }

    return results
  }

  async upsertMemory(
    key: string,
    category: MemoryCategory,
    value: unknown,
    relevanceScore?: number
  ): Promise<void> {
    const score = relevanceScore?.toString() ?? '1'
    await this.db
      .insert(memoryEntries)
      .values({
        key,
        category,
        value: value as Record<string, unknown>,
        relevanceScore: score,
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: memoryEntries.key,
        set: {
          value: sql`excluded.value`,
          relevanceScore: sql`excluded.relevance_score`,
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        },
      })
  }

  async markTopicSeen(topic: string): Promise<void> {
    const key = `blog_topic:${topic.toLowerCase().replace(/\s+/g, '-')}`
    await this.upsertMemory(
      key,
      'blog_topic',
      { topic, seenAt: new Date().toISOString() },
      0.8
    )
  }

  async isTopicDuplicate(title: string, keywords: string[]): Promise<boolean> {
    const titleKey = `blog_topic:${title.toLowerCase().replace(/\s+/g, '-')}`

    // Check exact title match
    const exactMatch = await this.db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.key, titleKey))
      .limit(1)

    if (exactMatch.length > 0) return true

    // Check keyword-based matches
    for (const keyword of keywords) {
      const kwKey = `blog_topic:${keyword.toLowerCase().replace(/\s+/g, '-')}`
      const kwMatch = await this.db
        .select()
        .from(memoryEntries)
        .where(eq(memoryEntries.key, kwKey))
        .limit(1)
      if (kwMatch.length > 0) return true
    }

    return false
  }

  async recordActionHistory(
    actionType: string,
    summary: string,
    runId: string
  ): Promise<void> {
    const key = `action_history:${runId}:${actionType}:${Date.now()}`
    await this.upsertMemory(
      key,
      'action_history',
      {
        actionType,
        summary,
        runId,
        recordedAt: new Date().toISOString(),
      },
      0.6
    )
  }

  async getRecentObservations(runId: string): Promise<unknown[]> {
    const results = await this.db
      .select()
      .from(observations)
      .where(eq(observations.runId, runId))
      .orderBy(desc(observations.createdAt))
      .limit(100)

    return results
  }

  async getRejectedSuggestions(): Promise<string[]> {
    const results = await this.db
      .select({ key: memoryEntries.key })
      .from(memoryEntries)
      .where(eq(memoryEntries.category, 'rejected_suggestion'))
      .orderBy(desc(memoryEntries.lastAccessedAt))
      .limit(200)

    return results.map((r) => r.key)
  }

  /** Strategic insights tied to a specific agent run (see strategist / memory upsert keys). */
  async getStrategicInsightsForRun(runId: string): Promise<MemoryEntry[]> {
    const keyPrefix = `strategic_insight:run:${runId}:`

    return this.db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.category, 'strategic_insight'),
          or(
            like(memoryEntries.key, `${keyPrefix}%`),
            sql`(${memoryEntries.value}->>'run_id') = ${runId}`
          )
        )
      )
      .orderBy(desc(memoryEntries.createdAt))
  }
}
