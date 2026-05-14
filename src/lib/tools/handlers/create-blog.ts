import Anthropic from '@anthropic-ai/sdk'
import { contentSnapshots } from '@/db/schema'
import { CreateBlogSchema } from '@/types'
import type { CreateBlogPayload } from '@/types'
import { SanityMCPTool } from '@/lib/mcp/sanity'
import type { ToolHandler, ToolContext, ToolResult } from '../types'

const anthropic = new Anthropic()

export class CreateBlogHandler implements ToolHandler<CreateBlogPayload> {
  validate(payload: unknown): CreateBlogPayload {
    return CreateBlogSchema.parse(payload)
  }

  async execute(payload: CreateBlogPayload, context: ToolContext): Promise<ToolResult> {
    const { runId, memory } = context

    try {
      // 1. Check for duplicate topic
      const isDuplicate = await memory.isTopicDuplicate(
        payload.title,
        payload.target_keywords
      )

      if (isDuplicate) {
        return {
          success: false,
          error: `Topic "${payload.title}" appears to be a duplicate of existing content`,
        }
      }

      // 2. Generate content draft if not provided
      let contentDraft = payload.content_draft

      if (!contentDraft) {
        console.log(`[CreateBlogHandler] Generating content draft for: ${payload.title}`)

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: `Write a comprehensive blog post based on this outline:

Title: ${payload.title}
Target Keywords: ${payload.target_keywords.join(', ')}
Meta Description: ${payload.meta_description}
Target Word Count: ${payload.word_count_target}
Outline: ${payload.outline}

Requirements:
- Write in a clear, engaging, and authoritative tone
- Naturally incorporate the target keywords
- Structure with H2 and H3 headings following the outline
- Include actionable insights and specific examples
- Write approximately ${payload.word_count_target} words
- Format in Markdown

Write the full blog post now:`,
            },
          ],
        })

        const textContent = message.content.find((c) => c.type === 'text')
        contentDraft = textContent ? textContent.text : `# ${payload.title}\n\n${payload.outline}`
      }

      // 3. Create document in Sanity (or dry run)
      const sanityTool = new SanityMCPTool()
      const projectId = process.env.SANITY_PROJECT_ID

      const sanityDoc = {
        _type: 'post',
        title: payload.title,
        slug: { _type: 'slug', current: payload.slug },
        metaDescription: payload.meta_description,
        body: contentDraft,
        targetKeywords: payload.target_keywords,
        status: 'draft',
        createdByAgent: true,
        agentRunId: runId,
        createdAt: new Date().toISOString(),
      }

      let externalId: string

      if (!projectId) {
        console.log(`[DRY RUN] Would create blog: ${payload.title}`)
        externalId = `dry-run-${Date.now()}`
      } else {
        const result = await sanityTool.createDocument(sanityDoc)
        externalId = result._id
      }

      // 4. Store content snapshot in DB
      await context.db.insert(contentSnapshots).values({
        externalId,
        source: 'sanity',
        title: payload.title,
        slug: payload.slug,
        metadata: {
          target_keywords: payload.target_keywords,
          meta_description: payload.meta_description,
          word_count_target: payload.word_count_target,
          run_id: runId,
          created_by_agent: true,
        },
      })

      // 5. Mark topic as seen in memory
      await memory.markTopicSeen(payload.title)
      for (const keyword of payload.target_keywords.slice(0, 3)) {
        await memory.markTopicSeen(keyword)
      }

      // 6. Record action history
      await memory.recordActionHistory(
        'CREATE_BLOG',
        `Created blog post: "${payload.title}" (${payload.slug}) targeting [${payload.target_keywords.slice(0, 3).join(', ')}]`,
        runId
      )

      return {
        success: true,
        data: { title: payload.title, slug: payload.slug },
        externalId,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[CreateBlogHandler] Error:', message)
      return { success: false, error: message }
    }
  }
}
