import Anthropic from '@anthropic-ai/sdk'
import { GenerateOutlineSchema } from '@/types'
import type { GenerateOutlinePayload } from '@/types'
import type { ToolHandler, ToolContext, ToolResult } from '../types'

const anthropic = new Anthropic()

export class GenerateOutlineHandler implements ToolHandler<GenerateOutlinePayload> {
  validate(payload: unknown): GenerateOutlinePayload {
    return GenerateOutlineSchema.parse(payload)
  }

  async execute(payload: GenerateOutlinePayload, context: ToolContext): Promise<ToolResult> {
    const { runId, memory } = context

    try {
      const contentTypeInstructions: Record<string, string> = {
        'how-to': 'Use numbered steps with clear action verbs. Include prerequisites and expected outcomes.',
        'listicle': 'Create numbered or bulleted sections with parallel structure. Each item should be scannable.',
        'pillar': 'Create a comprehensive, authoritative structure with main topics and detailed subtopics.',
        'comparison': 'Structure with criteria sections and clear comparison points. Include a summary section.',
        'review': 'Include overview, features, pros/cons, performance, pricing, and verdict sections.',
        'news': 'Lead with the most important information (inverted pyramid). Include context and implications.',
        'guide': 'Progressive structure from basics to advanced. Include practical examples throughout.',
        'case-study': 'Problem, approach, implementation, results, and lessons learned format.',
      }

      const instructions = contentTypeInstructions[payload.content_type] ?? ''

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Generate a detailed SEO-optimized content outline for:

Title: ${payload.title}
Content Type: ${payload.content_type}
Target Keywords: ${payload.target_keywords.join(', ')}
Number of Sections: ${payload.section_count}
Target Word Count: ${payload.word_count_target} words

Content Type Guidelines: ${instructions}

Requirements:
- Create exactly ${payload.section_count} main sections (H2 headings)
- Each section should have 2-4 subsections (H3 headings)
- Include estimated word count per section
- Mark where to naturally include target keywords
- Add brief notes on what to cover in each section
- Include suggested internal link opportunities
- Add a meta description suggestion

Format the outline in Markdown with clear hierarchy. Start with the meta description suggestion, then the full outline.`,
          },
        ],
      })

      const textContent = message.content.find((c) => c.type === 'text')
      const outline = textContent
        ? textContent.text
        : `# ${payload.title}\n\n${payload.target_keywords.map((kw) => `## ${kw}`).join('\n\n')}`

      // Store as strategic insight in memory
      const insightKey = `strategic_insight:outline:${payload.title.toLowerCase().replace(/\s+/g, '-').substring(0, 80)}`
      await memory.upsertMemory(
        insightKey,
        'strategic_insight',
        {
          type: 'content_outline',
          title: payload.title,
          content_type: payload.content_type,
          target_keywords: payload.target_keywords,
          outline,
          generated_at: new Date().toISOString(),
          run_id: runId,
        },
        0.9
      )

      await memory.recordActionHistory(
        'GENERATE_OUTLINE',
        `Generated ${payload.content_type} outline for "${payload.title}" with ${payload.section_count} sections`,
        runId
      )

      return {
        success: true,
        data: {
          title: payload.title,
          content_type: payload.content_type,
          outline,
          target_keywords: payload.target_keywords,
          word_count_target: payload.word_count_target,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[GenerateOutlineHandler] Error:', message)
      return { success: false, error: message }
    }
  }
}
