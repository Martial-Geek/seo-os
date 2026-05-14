import Anthropic from '@anthropic-ai/sdk'
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages'
import { db } from '@/db'
import { proposedActions } from '@/db/schema'
import { MemoryService } from '@/lib/memory/memory-service'
import { ActionType } from '@/types'
import type {
  AgentState,
  StrategicSuggestion,
  AgentProposedAction,
  AgentObservation,
} from '@/types'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic()

const AGENT_MODEL = process.env.SEO_AGENT_MODEL ?? 'claude-sonnet-4-6'

const STRATEGIST_TOOL_NAME = 'strategist_output' as const

const strategistTool: Tool = {
  name: STRATEGIST_TOOL_NAME,
  description:
    'Submit strategic SEO suggestions and typed proposed actions. Use only action_type values from the allowed enum.',
  input_schema: {
    type: 'object',
    properties: {
      strategic_suggestions: {
        type: 'array',
        description: '3–7 high-signal strategic suggestions',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Concise suggestion title' },
            description: { type: 'string', description: 'What to do and why' },
            rationale: { type: 'string', description: 'Data-backed reasoning' },
            supporting_data: {
              type: 'object',
              description: 'Key metrics or references',
              additionalProperties: true,
            },
            estimated_impact: { type: 'string', enum: ['low', 'medium', 'high'] },
            category: {
              type: 'string',
              description: 'e.g. content_creation, technical_seo, keyword_optimization',
            },
          },
          required: ['title', 'description', 'rationale', 'estimated_impact'],
        },
      },
      proposed_actions: {
        type: 'array',
        description: '2–5 executable operations (minimum 2)',
        minItems: 2,
        items: {
          type: 'object',
          properties: {
            action_type: {
              type: 'string',
              enum: Object.values(ActionType) as [string, ...string[]],
            },
            payload: {
              type: 'object',
              description: 'Must match the schema for the chosen action_type',
              additionalProperties: true,
            },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            reasoning: { type: 'string', description: 'Data points justifying this action' },
          },
          required: ['action_type', 'payload', 'risk_level', 'reasoning'],
        },
      },
    },
    required: ['strategic_suggestions', 'proposed_actions'],
  },
}

interface StrategistOutput {
  strategic_suggestions: Array<{
    title: string
    description: string
    rationale: string
    supporting_data: Record<string, unknown>
    estimated_impact: 'low' | 'medium' | 'high'
    category: string
  }>
  proposed_actions: Array<{
    action_type: string
    payload: Record<string, unknown>
    risk_level: 'low' | 'medium' | 'high'
    reasoning: string
  }>
}

function formatAnalysisForPrompt(observations: AgentObservation[]): string {
  const analysis = observations.find((o) => o.type === 'analysis')
  const inventory = observations.find((o) => o.type === 'content_inventory')

  let text = ''

  if (analysis) {
    text += JSON.stringify(analysis.data, null, 2).substring(0, 5000)
  } else if (observations.length > 0) {
    const raw = observations
      .filter((o) => o.type !== 'analysis')
      .slice(0, 12)
      .map((o) => `### ${o.source} / ${o.type}\n${JSON.stringify(o.data, null, 2).substring(0, 2500)}`)
      .join('\n\n')
    text += 'No structured analysis — using raw collector data.\n\n' + raw
  } else {
    return 'No analysis data available.'
  }

  // Append available Sanity slugs so the model can reference real documents
  if (inventory) {
    const posts = (inventory.data as Record<string, unknown>)['posts']
    if (Array.isArray(posts) && posts.length > 0) {
      const slugList = (posts as Array<Record<string, unknown>>)
        .slice(0, 30)
        .map((p) => {
          const slug = (p['slug'] as Record<string, unknown>)?.['current'] ?? p['slug']
          return `  - slug: "${slug}"  _id: "${p['_id']}"  title: "${p['title']}"`
        })
        .join('\n')
      text += `\n\n## Existing Sanity Documents (use these exact slug/id values for UPDATE_METADATA external_id)\n${slugList}`
    }
  }

  return text.substring(0, 7000)
}

function validateActionType(type: string): ActionType | null {
  const validTypes = Object.values(ActionType) as string[]
  if (validTypes.includes(type)) return type as ActionType
  return null
}

export async function strategistNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const runId = state.current_run_id
  console.log('[strategistNode] Generating strategic suggestions and proposed actions')

  const analysisText = formatAnalysisForPrompt(state.observations)
  const recentTopics = state.memory_context.recent_topics.slice(0, 20)
  const rejectedSuggestions = state.memory_context.rejected_suggestions.slice(0, 15)

  const systemPrompt = `You are an expert SEO strategist with deep experience in content strategy, technical SEO, and organic growth.
Based on data analysis, generate specific, actionable strategic suggestions and executable operations.
Always prioritize high-impact, low-risk actions. Avoid suggesting topics already covered or previously rejected.
Every tool call must include at least two proposed_actions with valid action_type from the enum and realistic payloads.`

  const userPrompt = `Based on this SEO analysis, generate 3-7 strategic suggestions and 2-5 executable operations.
You MUST return at least 2 proposed_actions (each with action_type, payload, risk_level, reasoning).

## Analysis Data
${analysisText}

## Already Covered Topics (DO NOT suggest these)
${recentTopics.length > 0 ? recentTopics.join(', ') : 'None'}

## Previously Rejected Suggestions (DO NOT repeat these)
${rejectedSuggestions.length > 0 ? rejectedSuggestions.join(', ') : 'None'}

## Available Action Types
${Object.values(ActionType).join(', ')}

## Action Payload Schemas
- CREATE_BLOG: { title: string, slug: "kebab-case-string", outline: "single markdown string with all sections", target_keywords: string[], meta_description: string (max 160 chars), word_count_target: number, internal_links: string[] (URL strings only, e.g. ["/blog/related-post"]) }
- UPDATE_METADATA: { external_id: "_id from the Existing Sanity Documents list above", title?: string, meta_description?: string (max 160 chars), og_title?: string, og_description?: string }
- GENERATE_OUTLINE: { title: string, target_keywords: string[], section_count: number, word_count_target: number, content_type: "how-to"|"listicle"|"pillar"|"comparison"|"review"|"news"|"guide"|"case-study" }
- ADD_INTERNAL_LINKS: { source_id: "_id from the Existing Sanity Documents list above", links: [{ target_id: "_id from list", anchor_text: string, position: number }] }

Call the tool ${STRATEGIST_TOOL_NAME} once with your full output. Do not emit raw JSON in plain text.`

  try {
    const message = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      tools: [strategistTool],
      tool_choice: { type: 'tool', name: STRATEGIST_TOOL_NAME },
      messages: [{ role: 'user', content: userPrompt }],
    })

    console.log(`[strategistNode] stop_reason: ${message.stop_reason}`)

    const toolUse = message.content.find(
      (c): c is ToolUseBlock => c.type === 'tool_use' && c.name === STRATEGIST_TOOL_NAME
    )
    if (!toolUse) {
      const names = message.content
        .filter((c) => c.type === 'tool_use')
        .map((c) => (c as ToolUseBlock).name)
      throw new Error(
        `Expected tool_use ${STRATEGIST_TOOL_NAME}, got: ${names.length ? names.join(', ') : 'none'}`
      )
    }

    const output = toolUse.input as StrategistOutput

    // Build StrategicSuggestion objects
    const strategicSuggestions: StrategicSuggestion[] = (output.strategic_suggestions ?? []).map(
      (s) => ({
        id: randomUUID(),
        title: s.title,
        description: s.description,
        rationale: s.rationale,
        supporting_data: s.supporting_data ?? {},
        estimated_impact: s.estimated_impact ?? 'medium',
        category: s.category ?? 'general',
        created_at: new Date(),
      })
    )

    if (runId && strategicSuggestions.length > 0) {
      const memoryService = new MemoryService(db)
      for (const s of strategicSuggestions) {
        await memoryService.upsertMemory(
          `strategic_insight:run:${runId}:${s.id}`,
          'strategic_insight',
          {
            run_id: runId,
            suggestion_id: s.id,
            title: s.title,
            description: s.description,
            rationale: s.rationale,
            supporting_data: s.supporting_data,
            estimated_impact: s.estimated_impact,
            category: s.category,
            created_at: s.created_at.toISOString(),
            source: 'strategist',
          },
          0.75
        )
      }
    }

    // Build AgentProposedAction objects and save to DB
    const proposedActionsList: AgentProposedAction[] = []

    console.log(`[strategistNode] Raw proposed_actions count: ${output.proposed_actions?.length ?? 0}`)
    console.log(`[strategistNode] Action types from model: ${(output.proposed_actions ?? []).map(a => a.action_type).join(', ')}`)

    for (const action of output.proposed_actions ?? []) {
      const actionType = validateActionType(action.action_type)
      if (!actionType) {
        console.warn(`[strategistNode] Unknown action type: ${action.action_type}, skipping`)
        continue
      }

      const id = randomUUID()
      const requiresApproval = action.risk_level !== 'low'

      const agentAction: AgentProposedAction = {
        id,
        actionType,
        payload: action.payload,
        riskLevel: action.risk_level,
        status: 'pending',
        requiresApproval,
        reasoning: action.reasoning,
      }

      proposedActionsList.push(agentAction)

      // Save to DB
      if (runId) {
        await db.insert(proposedActions).values({
          id,
          runId,
          actionType,
          payload: action.payload,
          riskLevel: action.risk_level,
          status: 'pending',
          requiresApproval,
          reasoning: action.reasoning,
        })
      }
    }

    console.log(
      `[strategistNode] Generated: ${strategicSuggestions.length} suggestions, ${proposedActionsList.length} proposed actions`
    )

    return {
      strategic_suggestions: [...state.strategic_suggestions, ...strategicSuggestions],
      proposed_actions: [...state.proposed_actions, ...proposedActionsList],
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[strategistNode] Error:', errMsg)

    const errorObs: AgentObservation = {
      id: randomUUID(),
      source: 'memory',
      type: 'strategist_error',
      data: { error: errMsg, timestamp: new Date().toISOString() },
      createdAt: new Date(),
    }

    if (runId) {
      const { observations } = await import('@/db/schema')
      await db.insert(observations).values({
        runId,
        source: 'memory',
        type: 'strategist_error',
        data: { error: errMsg },
      })
    }

    return { observations: [errorObs] }
  }
}
