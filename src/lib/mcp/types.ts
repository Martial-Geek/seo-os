import type { ZodType } from 'zod'

// ─── Core MCP Tool Interface ──────────────────────────────────────────────────

export interface MCPTool<TInput, TOutput> {
  name: string
  description: string
  inputSchema: ZodType<TInput>
  execute(input: TInput): Promise<TOutput>
}

export type MCPToolRegistry = Map<string, MCPTool<unknown, unknown>>

// ─── Search Console ───────────────────────────────────────────────────────────

export interface SearchConsoleQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsolePage {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchConsoleData {
  site: string
  queries: SearchConsoleQuery[]
  pages: SearchConsolePage[]
  dateRange: {
    start: string
    end: string
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface TopPage {
  path: string
  pageviews: number
  avgTime: number
}

export interface TrafficSource {
  source: string
  sessions: number
}

export interface AnalyticsData {
  sessions: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
  topPages: TopPage[]
  trafficSources: TrafficSource[]
  dateRange: {
    start: string
    end: string
  }
}

// ─── Sanity ───────────────────────────────────────────────────────────────────

export interface SanityContent {
  _id: string
  title: string
  slug: { current: string }
  body?: unknown
  metaTitle?: string
  metaDescription?: string
  publishedAt?: string
  _updatedAt: string
  categories?: string[]
}
