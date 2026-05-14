import { AddInternalLinksSchema } from '@/types'
import type { AddInternalLinksPayload } from '@/types'
import { SanityMCPTool } from '@/lib/mcp/sanity'
import type { ToolHandler, ToolContext, ToolResult } from '../types'

export class AddInternalLinksHandler implements ToolHandler<AddInternalLinksPayload> {
  validate(payload: unknown): AddInternalLinksPayload {
    return AddInternalLinksSchema.parse(payload)
  }

  async execute(payload: AddInternalLinksPayload, context: ToolContext): Promise<ToolResult> {
    const { runId, memory } = context

    try {
      const sanityTool = new SanityMCPTool()

      // Build patch with internal link references
      // In Sanity, internal links in Portable Text are references
      const internalLinks = payload.links.map((link) => ({
        _type: 'internalLink',
        _key: `link-${link.target_id}-${link.position}`,
        reference: {
          _type: 'reference',
          _ref: link.target_id,
        },
        anchorText: link.anchor_text,
        position: link.position,
      }))

      const patch = {
        internalLinks,
        lastInternalLinksUpdate: new Date().toISOString(),
        agentRunId: runId,
      }

      await sanityTool.patchDocument(payload.source_id, patch)

      await memory.recordActionHistory(
        'ADD_INTERNAL_LINKS',
        `Added ${payload.links.length} internal links to document ${payload.source_id}: [${payload.links.map((l) => l.anchor_text).join(', ')}]`,
        runId
      )

      return {
        success: true,
        data: {
          sourceId: payload.source_id,
          linksAdded: payload.links.length,
          links: payload.links.map((l) => ({
            targetId: l.target_id,
            anchorText: l.anchor_text,
            position: l.position,
          })),
        },
        externalId: payload.source_id,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[AddInternalLinksHandler] Error:', message)
      return { success: false, error: message }
    }
  }
}
