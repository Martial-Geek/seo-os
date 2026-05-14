import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/db'
import { observations } from '@/db/schema'
import type { AgentState, AgentObservation } from '@/types'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic()

interface AnalysisResult {
  keyword_opportunities: Array<{
    keyword: string
    opportunity_type: string
    current_position?: number
    estimated_traffic_gain: string
    rationale: string
  }>
  content_gaps: Array<{
    topic: string
    gap_type: string
    evidence: string
    priority: 'high' | 'medium' | 'low'
  }>
  performance_issues: Array<{
    page_or_query: string
    issue_type: string
    metric: string
    current_value: number
    benchmark: number
    recommendation: string
  }>
  cannibalization_risks: Array<{
    competing_pages: string[]
    shared_keyword: string
    recommendation: string
  }>
  summary: string
}

function formatObservationsForPrompt(obs: AgentObservation[]): string {
  return obs.map((o) => {
    const dataStr = JSON.stringify(o.data, null, 2).substring(0, 3000)
    return `### ${o.source.toUpperCase()} — ${o.type}\n${dataStr}`
  }).join('\n\n')
}

function formatMemoryContextForPrompt(state: AgentState): string {
  const mc = state.memory_context
  const lines: string[] = []

  if (mc.recent_topics.length > 0) {
    lines.push(`**Recently covered topics:** ${mc.recent_topics.slice(0, 15).join(', ')}`)
  }
  if (mc.rejected_suggestions.length > 0) {
    lines.push(`**Previously rejected:** ${mc.rejected_suggestions.slice(0, 10).join(', ')}`)
  }
  if (mc.strategic_insights.length > 0) {
    lines.push(`**Strategic insights on record:** ${mc.strategic_insights.slice(0, 5).join('; ')}`)
  }
  if (mc.action_history.length > 0) {
    lines.push(`**Recent actions:** ${mc.action_history.slice(0, 5).map((a) => a.summary).join('; ')}`)
  }

  return lines.length > 0 ? lines.join('\n') : 'No prior memory context available.'
}

export async function analysisNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const runId = state.current_run_id
  console.log(`[analysisNode] Analyzing ${state.observations.length} observations`)

  if (state.observations.length === 0) {
    console.warn('[analysisNode] No observations to analyze')
    return {}
  }

  const observationText = formatObservationsForPrompt(state.observations)
  const memoryText = formatMemoryContextForPrompt(state)

  const prompt = `You are an expert SEO analyst. Analyze the following data from multiple sources and identify actionable insights.

## Memory Context (what we already know / have done)
${memoryText}

## Raw Data from Collection
${observationText}

## Analysis Task
Analyze the data and identify:
1. **Keyword opportunities** — queries with high impressions but poor CTR, or position 5-20 with good volume
2. **Content gaps** — topics with search volume but no existing content, or thin coverage
3. **Performance issues** — pages with declining traffic, high bounce rate, or low engagement
4. **Cannibalization risks** — multiple pages competing for the same keywords

Return your analysis as a JSON object with this exact structure:
{
  "keyword_opportunities": [{ "keyword": string, "opportunity_type": string, "current_position": number | null, "estimated_traffic_gain": string, "rationale": string }],
  "content_gaps": [{ "topic": string, "gap_type": string, "evidence": string, "priority": "high"|"medium"|"low" }],
  "performance_issues": [{ "page_or_query": string, "issue_type": string, "metric": string, "current_value": number, "benchmark": number, "recommendation": string }],
  "cannibalization_risks": [{ "competing_pages": string[], "shared_keyword": string, "recommendation": string }],
  "summary": string
}

Be specific and data-driven. Reference actual numbers from the data. Only include findings backed by evidence.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    if (!textContent) {
      throw new Error('No text content in response')
    }

    // Extract JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in analysis response')
    }

    const analysis = JSON.parse(jsonMatch[0]) as AnalysisResult

    // Create analysis observations
    const analysisObs: AgentObservation = {
      id: randomUUID(),
      source: 'memory',
      type: 'analysis',
      data: analysis as unknown as Record<string, unknown>,
      createdAt: new Date(),
    }

    if (runId) {
      await db.insert(observations).values({
        runId,
        source: 'memory',
        type: 'analysis',
        data: analysis as unknown as Record<string, unknown>,
      })
    }

    console.log(
      `[analysisNode] Found: ${analysis.keyword_opportunities?.length ?? 0} keyword opps, ` +
      `${analysis.content_gaps?.length ?? 0} content gaps, ` +
      `${analysis.performance_issues?.length ?? 0} performance issues`
    )

    return {
      observations: [...state.observations, analysisObs],
    }
  } catch (err) {
    console.error('[analysisNode] Error:', err)

    // Return a minimal analysis observation so the graph can continue
    const fallbackObs: AgentObservation = {
      id: randomUUID(),
      source: 'memory',
      type: 'analysis',
      data: {
        keyword_opportunities: [],
        content_gaps: [],
        performance_issues: [],
        cannibalization_risks: [],
        summary: 'Analysis could not be completed due to an error.',
        error: err instanceof Error ? err.message : String(err),
      },
      createdAt: new Date(),
    }

    return {
      observations: [...state.observations, fallbackObs],
    }
  }
}
