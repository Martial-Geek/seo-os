import { db } from '@/db'
import { observations } from '@/db/schema'
import { toolRegistry } from '@/lib/mcp'
import type { AgentState, AgentObservation } from '@/types'
import type { SearchConsoleData, AnalyticsData, SanityContent } from '@/lib/mcp/types'
import { randomUUID } from 'crypto'

function getDateRange(): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    startDate: start.toISOString().split('T')[0]!,
    endDate: end.toISOString().split('T')[0]!,
  }
}

export async function collectorNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const runId = state.current_run_id
  if (!runId) {
    console.warn('[collectorNode] No run_id in state, skipping collection')
    return {}
  }

  const { startDate, endDate } = getDateRange()
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL ?? 'https://example.com'
  const propertyId = process.env.GA_PROPERTY_ID

  console.log(`[collectorNode] Collecting data for run ${runId}`)

  const newObservations: AgentObservation[] = []

  // Search Console first: when OAuth is configured, failures abort the run (no LLM / downstream work).
  const scData = await toolRegistry.execute<
    { siteUrl: string; startDate: string; endDate: string; dimensions: string[] },
    SearchConsoleData
  >('search_console', { siteUrl, startDate, endDate, dimensions: ['query'] })

  {
    const obs: AgentObservation = {
      id: randomUUID(),
      source: 'search_console',
      type: 'search_performance',
      data: scData as unknown as Record<string, unknown>,
      createdAt: new Date(),
    }
    newObservations.push(obs)

    await db.insert(observations).values({
      runId,
      source: 'search_console',
      type: 'search_performance',
      data: scData as unknown as Record<string, unknown>,
    })

    console.log(`[collectorNode] Collected ${scData.queries.length} queries from Search Console`)
  }

  const [analyticsResult, sanityResult] = await Promise.allSettled([
    toolRegistry.execute<
      { propertyId: string; startDate: string; endDate: string; metrics: string[] },
      AnalyticsData
    >('analytics', {
      propertyId,
      startDate,
      endDate,
      metrics: ['sessions', 'pageviews', 'bounceRate', 'avgSessionDuration'],
    }),

    toolRegistry.execute<
      { projectId?: string; dataset?: string; query?: string },
      SanityContent[]
    >('sanity', {}),
  ])

  // Process Analytics data
  if (analyticsResult.status === 'fulfilled') {
    const gaData = analyticsResult.value
    const obs: AgentObservation = {
      id: randomUUID(),
      source: 'analytics',
      type: 'traffic_metrics',
      data: gaData as unknown as Record<string, unknown>,
      createdAt: new Date(),
    }
    newObservations.push(obs)

    await db.insert(observations).values({
      runId,
      source: 'analytics',
      type: 'traffic_metrics',
      data: gaData as unknown as Record<string, unknown>,
    })

    console.log(`[collectorNode] Collected analytics: ${gaData.sessions} sessions, ${gaData.pageviews} pageviews`)
  } else {
    throw analyticsResult.reason
  }

  // Process Sanity content
  if (sanityResult.status === 'fulfilled') {
    const sanityData = sanityResult.value
    const obs: AgentObservation = {
      id: randomUUID(),
      source: 'sanity',
      type: 'content_inventory',
      data: { posts: sanityData, count: sanityData.length } as unknown as Record<string, unknown>,
      createdAt: new Date(),
    }
    newObservations.push(obs)

    await db.insert(observations).values({
      runId,
      source: 'sanity',
      type: 'content_inventory',
      data: { posts: sanityData, count: sanityData.length } as unknown as Record<string, unknown>,
    })

    console.log(`[collectorNode] Collected ${sanityData.length} posts from Sanity`)
  } else {
    console.error('[collectorNode] Sanity collection failed:', sanityResult.reason)
  }

  return {
    observations: newObservations,
  }
}
