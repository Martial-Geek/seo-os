'use server'

import { revalidatePath } from 'next/cache'
import db from '@/db'
import { memoryEntries } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { MemoryCategory } from '@/types'

/**
 * Fetches memory entries with an optional category filter.
 */
export async function getMemoryEntries(options?: {
  category?: MemoryCategory
  limit?: number
}) {
  const query = db
    .select()
    .from(memoryEntries)
    .where(
      options?.category ? eq(memoryEntries.category, options.category) : undefined
    )
    .orderBy(desc(memoryEntries.lastAccessedAt))

  if (options?.limit) {
    return query.limit(options.limit)
  }

  return query
}

/**
 * Deletes a single memory entry by ID.
 */
export async function deleteMemoryEntry(id: string): Promise<{ success: boolean }> {
  await db.delete(memoryEntries).where(eq(memoryEntries.id, id))
  revalidatePath('/memory')
  return { success: true }
}

/**
 * Deletes all memory entries in a given category.
 */
export async function clearMemoryByCategory(
  category: MemoryCategory
): Promise<{ success: boolean; deleted: number }> {
  const toDelete = await db
    .select({ id: memoryEntries.id })
    .from(memoryEntries)
    .where(eq(memoryEntries.category, category))

  if (toDelete.length === 0) {
    return { success: true, deleted: 0 }
  }

  await db.delete(memoryEntries).where(eq(memoryEntries.category, category))

  revalidatePath('/memory')

  return { success: true, deleted: toDelete.length }
}
