/* eslint-disable @typescript-eslint/no-explicit-any */
import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import type {
  AgentObservation,
  AgentProposedAction,
  StrategicSuggestion,
  MemoryContext,
  ConversationMessage,
  RunMetadata,
} from '@/types'
import { collectorNode } from '../nodes/collector'
import { memoryNode } from '../nodes/memory'
import { analysisNode } from '../nodes/analysis'
import { strategistNode } from '../nodes/strategist'
import { plannerNode } from '../nodes/planner'
import { approvalNode } from '../nodes/approval'
import { executionNode } from '../nodes/execution'
import { loggingNode } from '../nodes/logging'

// ─── State Annotation ─────────────────────────────────────────────────────────

const AgentStateAnnotation = Annotation.Root({
  observations: Annotation<AgentObservation[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  proposed_actions: Annotation<AgentProposedAction[]>({
    reducer: (_a, b) => b,
    default: () => [],
  }),
  strategic_suggestions: Annotation<StrategicSuggestion[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  memory_context: Annotation<MemoryContext>({
    reducer: (_a, b) => b,
    default: () => ({
      recent_topics: [],
      rejected_suggestions: [],
      strategic_insights: [],
      action_history: [],
    }),
  }),
  conversation_history: Annotation<ConversationMessage[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  current_run_id: Annotation<string | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  run_metadata: Annotation<RunMetadata>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({
      trigger_type: 'manual' as const,
      started_at: null,
      completed_at: null,
      observations_count: 0,
      actions_proposed: 0,
      actions_executed: 0,
    }),
  }),
  should_stop: Annotation<boolean>({
    reducer: (_a, b) => b,
    default: () => false,
  }),
  execution_results: Annotation<unknown[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
})

export type SEOGraphState = typeof AgentStateAnnotation.State

// ─── Conditional Routing Functions ────────────────────────────────────────────

function shouldContinueAfterAnalysis(
  state: SEOGraphState
): 'strategist' | 'logging' {
  const analysisObs = state.observations.find((o) => o.type === 'analysis')

  if (!analysisObs) {
    console.log('[seo-graph] No analysis observation found, routing to logging')
    return 'logging'
  }

  const data = analysisObs.data as {
    keyword_opportunities?: unknown[]
    content_gaps?: unknown[]
    performance_issues?: unknown[]
    error?: string
  }

  const hasOpportunities =
    (data.keyword_opportunities?.length ?? 0) > 0 ||
    (data.content_gaps?.length ?? 0) > 0 ||
    (data.performance_issues?.length ?? 0) > 0

  if (!hasOpportunities) {
    console.log('[seo-graph] No meaningful opportunities found, routing to logging')
    return 'logging'
  }

  console.log('[seo-graph] Meaningful opportunities found, routing to strategist')
  return 'strategist'
}

function shouldExecute(
  state: SEOGraphState
): 'execution' | 'logging' {
  const approvedActions = state.proposed_actions.filter(
    (a) => a.status === 'approved'
  )

  if (approvedActions.length === 0) {
    console.log('[seo-graph] No approved actions, routing to logging')
    return 'logging'
  }

  console.log(
    `[seo-graph] ${approvedActions.length} approved actions, routing to execution`
  )
  return 'execution'
}

// ─── Graph Factory ─────────────────────────────────────────────────────────────

export function createSEOGraph() {
  // Use 'any' casts for the builder chain because LangGraph's TS types become
  // very restrictive after the first addNode call (each call narrows the node
  // name union), making it impossible to chain calls without type assertions.
  const builder = new StateGraph(AgentStateAnnotation) as any

  builder.addNode('collector', collectorNode)
  builder.addNode('memory', memoryNode)
  builder.addNode('analysis', analysisNode)
  builder.addNode('strategist', strategistNode)
  builder.addNode('planner', plannerNode)
  builder.addNode('approval', approvalNode)
  builder.addNode('execution', executionNode)
  builder.addNode('logging', loggingNode)

  builder.addEdge(START, 'collector')
  builder.addEdge('collector', 'memory')
  builder.addEdge('memory', 'analysis')

  builder.addConditionalEdges('analysis', shouldContinueAfterAnalysis, {
    strategist: 'strategist',
    logging: 'logging',
  })

  builder.addEdge('strategist', 'planner')
  builder.addEdge('planner', 'approval')

  builder.addConditionalEdges('approval', shouldExecute, {
    execution: 'execution',
    logging: 'logging',
  })

  builder.addEdge('execution', 'logging')
  builder.addEdge('logging', END)

  return builder.compile()
}

// ─── Run Helper ───────────────────────────────────────────────────────────────

export async function runSEOAgent(
  runId: string,
  initialState?: Partial<SEOGraphState>
): Promise<SEOGraphState> {
  const graph = createSEOGraph()

  const startState: Partial<SEOGraphState> = {
    current_run_id: runId,
    observations: [],
    proposed_actions: [],
    strategic_suggestions: [],
    conversation_history: [],
    execution_results: [],
    should_stop: false,
    run_metadata: {
      trigger_type: 'manual',
      started_at: new Date(),
      completed_at: null,
      observations_count: 0,
      actions_proposed: 0,
      actions_executed: 0,
    },
    ...initialState,
  }

  console.log(`[runSEOAgent] Starting SEO agent run: ${runId}`)

  const finalState = await graph.invoke(startState)

  console.log(`[runSEOAgent] Completed SEO agent run: ${runId}`)

  return finalState as SEOGraphState
}
