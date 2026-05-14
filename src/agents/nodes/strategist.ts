import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/db'
import { proposedActions } from '@/db/schema'
import { ActionType } from '@/types'
import type {
  AgentState,
  StrategicSuggestion,
  AgentProposedAction,
  AgentObservation,
} from '@/types'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic()

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

function getAnalysisFromObservations(observations: AgentObservation[]): AgentObservation | null {
  return observations.find((o) => o.type === 'analysis') ?? null
}

function formatAnalysisForPrompt(analysis: AgentObservation | null): string {
  if (!analysis) return 'No analysis data available.'
  return JSON.stringify(analysis.data, null, 2).substring(0, 6000)
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

  const analysisObs = getAnalysisFromObservations(state.observations)
  const analysisText = formatAnalysisForPrompt(analysisObs)
  const recentTopics = state.memory_context.recent_topics.slice(0, 20)
  const rejectedSuggestions = state.memory_context.rejected_suggestions.slice(0, 15)

  const systemPrompt = `You are an expert SEO strategist with deep experience in content strategy, technical SEO, and organic growth.
Based on data analysis, generate specific, actionable strategic suggestions and executable operations.
Always prioritize high-impact, low-risk actions. Avoid suggesting topics already covered or previously rejected.`

  const userPrompt = `Based on this SEO analysis, generate 3-7 strategic suggestions and 2-5 executable operations.

## Analysis Data
${analysisText}

## Already Covered Topics (DO NOT suggest these)
${recentTopics.length > 0 ? recentTopics.join(', ') : 'None'}

## Previously Rejected Suggestions (DO NOT repeat these)
${rejectedSuggestions.length > 0 ? rejectedSuggestions.join(', ') : 'None'}

## Available Action Types
${Object.values(ActionType).join(', ')}

## Action Payload Schemas
- CREATE_BLOG: { title, slug (kebab-case), outline, target_keywords[], meta_description, word_count_target, internal_links[] }
- UPDATE_METADATA: { external_id, title?, meta_description?, og_title?, og_description? }
- GENERATE_OUTLINE: { title, target_keywords[], section_count, word_count_target, content_type }
- ADD_INTERNAL_LINKS: { source_id, links[{ target_id, anchor_text, position }] }

Return ONLY a valid JSON object with this structure:
{
  "strategic_suggestions": [
    {
      "title": "string (concise suggestion title)",
      "description": "string (what to do and why)",
      "rationale": "string (data-backed reasoning)",
      "supporting_data": { "metric": "value" },
      "estimated_impact": "low" | "medium" | "high",
      "category": "string (e.g. content_creation, technical_seo, keyword_optimization)"
    }
  ],
  "proposed_actions": [
    {
      "action_type": "ACTION_TYPE_FROM_ENUM",
      "payload": { ... matching schema above ... },
      "risk_level": "low" | "medium" | "high",
      "reasoning": "string (specific data points justifying this action)"
    }
  ]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    if (!textContent) throw new Error('No text content in response')

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in strategist response')

    const output = JSON.parse(jsonMatch[0]) as StrategistOutput

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

    // Build AgentProposedAction objects and save to DB
    const proposedActionsList: AgentProposedAction[] = []

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
    console.error('[strategistNode] Error:', err)
    return {}
  }
}
