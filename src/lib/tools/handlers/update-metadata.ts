import { eq } from 'drizzle-orm'
import { contentSnapshots } from '@/db/schema'
import { UpdateMetadataSchema } from '@/types'
import type { UpdateMetadataPayload } from '@/types'
import { SanityMCPTool } from '@/lib/mcp/sanity'
import type { ToolHandler, ToolContext, ToolResult } from '../types'

export class UpdateMetadataHandler implements ToolHandler<UpdateMetadataPayload> {
  validate(payload: unknown): UpdateMetadataPayload {
    return UpdateMetadataSchema.parse(payload)
  }

  async execute(payload: UpdateMetadataPayload, context: ToolContext): Promise<ToolResult> {
    const { runId, memory } = context

    try {
      const patch: Record<string, string> = {}

      if (payload.title) patch['title'] = payload.title
      if (payload.meta_description) patch['metaDescription'] = payload.meta_description
      if (payload.og_title) patch['ogTitle'] = payload.og_title
      if (payload.og_description) patch['ogDescription'] = payload.og_description

      if (Object.keys(patch).length === 0) {
        return { success: false, error: 'No metadata fields to update' }
      }

      // Call Sanity patch mutation
      const sanityTool = new SanityMCPTool()
      await sanityTool.patchDocument(payload.external_id, patch)

      // Update content snapshot in DB if it exists
      const existing = await context.db
        .select()
        .from(contentSnapshots)
        .where(eq(contentSnapshots.externalId, payload.external_id))
        .limit(1)

      if (existing.length > 0) {
        const currentMetadata = (existing[0].metadata ?? {}) as Record<string, unknown>
        await context.db
          .update(contentSnapshots)
          .set({
            title: payload.title ?? existing[0].title,
            metadata: {
              ...currentMetadata,
              meta_description: payload.meta_description ?? currentMetadata['meta_description'],
              og_title: payload.og_title ?? currentMetadata['og_title'],
              og_description: payload.og_description ?? currentMetadata['og_description'],
              last_metadata_update: new Date().toISOString(),
              updated_by_run: runId,
            },
          })
          .where(eq(contentSnapshots.externalId, payload.external_id))
      }

      // Record in memory
      await memory.recordActionHistory(
        'UPDATE_METADATA',
        `Updated metadata for document ${payload.external_id}: changed fields [${Object.keys(patch).join(', ')}]`,
        runId
      )

      return {
        success: true,
        data: { externalId: payload.external_id, updatedFields: Object.keys(patch) },
        externalId: payload.external_id,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[UpdateMetadataHandler] Error:', message)
      return { success: false, error: message }
    }
  }
}
