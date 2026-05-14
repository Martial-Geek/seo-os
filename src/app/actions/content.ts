'use server'

import { revalidatePath } from 'next/cache'
import db from '@/db'
import { contentSnapshots } from '@/db/schema'
import { desc, sql } from 'drizzle-orm'

/**
 * Returns paginated content snapshots.
 */
export async function getContentSnapshots(options?: {
  page?: number
  limit?: number
}) {
  const page = Math.max(1, options?.page ?? 1)
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20))
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

  return {
    content: snapshots,
    total,
    page,
    limit,
    hasNextPage: offset + snapshots.length < total,
  }
}

/**
 * Syncs content from Sanity CMS.
 * Calls the Sanity MCP tool if available; otherwise returns mock data.
 */
export async function syncContentFromSanity(): Promise<{
  success: boolean
  synced: number
  message: string
}> {
  try {
    // Attempt to use Sanity MCP tool if available
    // This import is dynamic to avoid breaking when the tool is not configured
    let sanityContent: Array<{
      id: string
      title: string
      slug: string
      source: string
      metadata?: Record<string, unknown>
    }> | null = null

    try {
      const { SanityMCPTool } = await import('@/lib/mcp/sanity')
      const tool = new SanityMCPTool()
      const posts = await tool.execute({
        projectId: process.env.SANITY_PROJECT_ID,
        dataset: process.env.SANITY_DATASET ?? 'production',
      })
      if (Array.isArray(posts) && posts.length > 0) {
        sanityContent = posts.map((p) => ({
          id: p._id,
          title: p.title,
          slug: p.slug.current,
          source: 'sanity',
          metadata: {
            metaTitle: p.metaTitle,
            metaDescription: p.metaDescription,
            publishedAt: p.publishedAt,
            updatedAt: p._updatedAt,
            categories: p.categories,
          },
        }))
      }
    } catch {
      sanityContent = null
    }

    if (!sanityContent) {
      return {
        success: true,
        synced: 0,
        message: 'Sanity not configured. Set SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_API_TOKEN to sync real content.',
      }
    }

    // Upsert content into the database
    let synced = 0
    for (const item of sanityContent) {
      await db
        .insert(contentSnapshots)
        .values({
          externalId: item.id,
          source: item.source ?? 'sanity',
          title: item.title,
          slug: item.slug,
          metadata: (item.metadata ?? {}) as Record<string, unknown>,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: contentSnapshots.externalId,
          set: {
            title: item.title,
            slug: item.slug,
            metadata: (item.metadata ?? {}) as Record<string, unknown>,
            lastSyncedAt: new Date(),
          },
        })

      synced++
    }

    revalidatePath('/content')

    return {
      success: true,
      synced,
      message: `Successfully synced ${synced} content items from Sanity.`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      synced: 0,
      message: `Failed to sync content: ${message}`,
    }
  }
}
