import { db } from '@/db'
import { MemoryService } from '@/lib/memory/memory-service'
import type { AgentState, MemoryContext, ActionHistoryEntry, ActionType } from '@/types'

export async function memoryNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const runId = state.current_run_id
  console.log(`[memoryNode] Loading memory context for run ${runId}`)

  const memoryService = new MemoryService(db)

  // Load all memory categories in parallel
  const [
    topicsEntries,
    rejectedEntries,
    insightEntries,
    historyEntries,
  ] = await Promise.all([
    memoryService.getMemoryContext(['blog_topic']),
    memoryService.getMemoryContext(['rejected_suggestion']),
    memoryService.getMemoryContext(['strategic_insight']),
    memoryService.getMemoryContext(['action_history']),
  ])

  // Extract recent topics
  const recentTopics = topicsEntries
    .slice(0, 20)
    .map((entry) => {
      const val = entry.value as Record<string, unknown>
      return typeof val['topic'] === 'string' ? val['topic'] : entry.key
    })

  // Extract rejected suggestions
  const rejectedSuggestions = rejectedEntries
    .slice(0, 30)
    .map((entry) => entry.key)

  // Extract strategic insights
  const strategicInsights = insightEntries
    .slice(0, 10)
    .map((entry) => {
      const val = entry.value as Record<string, unknown>
      if (typeof val['title'] === 'string') return val['title']
      if (typeof val['summary'] === 'string') return val['summary']
      return entry.key
    })

  // Extract action history
  const actionHistory: ActionHistoryEntry[] = historyEntries
    .slice(0, 20)
    .map((entry) => {
      const val = entry.value as Record<string, unknown>
      return {
        actionType: (val['actionType'] as ActionType) ?? 'CREATE_BLOG',
        executedAt: val['recordedAt'] ? new Date(val['recordedAt'] as string) : new Date(),
        outcome: 'success' as const,
        summary: typeof val['summary'] === 'string' ? val['summary'] : String(val['summary'] ?? ''),
      }
    })

  const memoryContext: MemoryContext = {
    recent_topics: recentTopics,
    rejected_suggestions: rejectedSuggestions,
    strategic_insights: strategicInsights,
    action_history: actionHistory,
  }

  console.log(
    `[memoryNode] Loaded: ${recentTopics.length} topics, ${rejectedSuggestions.length} rejected, ${strategicInsights.length} insights, ${actionHistory.length} history entries`
  )

  return {
    memory_context: memoryContext,
  }
}
