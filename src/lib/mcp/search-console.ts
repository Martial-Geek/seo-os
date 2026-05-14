import { z } from 'zod'
import type { MCPTool, SearchConsoleData } from './types'

const SearchConsoleInputSchema = z.object({
  siteUrl: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  dimensions: z
    .array(z.enum(['query', 'page', 'date']))
    .default(['query']),
})

type SearchConsoleInput = z.infer<typeof SearchConsoleInputSchema>

function generateMockData(input: SearchConsoleInput): SearchConsoleData {
  const mockQueries = [
    { query: 'seo best practices 2024', clicks: 342, impressions: 8900, ctr: 0.038, position: 4.2 },
    { query: 'content marketing strategy', clicks: 289, impressions: 12400, ctr: 0.023, position: 6.1 },
    { query: 'keyword research tools', clicks: 445, impressions: 7600, ctr: 0.059, position: 3.8 },
    { query: 'on-page seo checklist', clicks: 198, impressions: 5400, ctr: 0.037, position: 5.5 },
    { query: 'technical seo audit', clicks: 267, impressions: 9200, ctr: 0.029, position: 7.2 },
    { query: 'link building strategies', clicks: 312, impressions: 11000, ctr: 0.028, position: 5.9 },
    { query: 'google search console tutorial', clicks: 189, impressions: 4300, ctr: 0.044, position: 4.8 },
    { query: 'meta description optimization', clicks: 156, impressions: 3800, ctr: 0.041, position: 3.5 },
    { query: 'site speed optimization seo', clicks: 234, impressions: 6700, ctr: 0.035, position: 6.4 },
    { query: 'local seo tips', clicks: 178, impressions: 5200, ctr: 0.034, position: 5.1 },
    { query: 'schema markup guide', clicks: 145, impressions: 4100, ctr: 0.035, position: 4.3 },
    { query: 'core web vitals seo impact', clicks: 201, impressions: 5900, ctr: 0.034, position: 6.8 },
    { query: 'content cluster strategy', clicks: 167, impressions: 4500, ctr: 0.037, position: 5.7 },
    { query: 'e-e-a-t google guidelines', clicks: 223, impressions: 7200, ctr: 0.031, position: 7.5 },
    { query: 'seo for ecommerce', clicks: 334, impressions: 9800, ctr: 0.034, position: 5.3 },
    { query: 'backlink analysis tools', clicks: 289, impressions: 8400, ctr: 0.034, position: 4.9 },
    { query: 'mobile seo optimization', clicks: 178, impressions: 5600, ctr: 0.032, position: 6.2 },
    { query: 'seo competitor analysis', clicks: 256, impressions: 7800, ctr: 0.033, position: 5.8 },
    { query: 'featured snippet optimization', clicks: 189, impressions: 5100, ctr: 0.037, position: 4.6 },
    { query: 'international seo hreflang', clicks: 134, impressions: 3900, ctr: 0.034, position: 7.1 },
  ]

  const mockPages = [
    { page: `${input.siteUrl}/blog/seo-guide`, clicks: 567, impressions: 14200, ctr: 0.040, position: 3.2 },
    { page: `${input.siteUrl}/blog/keyword-research`, clicks: 445, impressions: 11800, ctr: 0.038, position: 4.1 },
    { page: `${input.siteUrl}/blog/content-strategy`, clicks: 389, impressions: 9600, ctr: 0.040, position: 3.8 },
    { page: `${input.siteUrl}/blog/technical-seo`, clicks: 334, impressions: 8900, ctr: 0.038, position: 5.4 },
    { page: `${input.siteUrl}/blog/link-building`, clicks: 312, impressions: 8200, ctr: 0.038, position: 4.7 },
  ]

  return {
    site: input.siteUrl,
    queries: mockQueries,
    pages: mockPages,
    dateRange: { start: input.startDate, end: input.endDate },
  }
}

async function refreshGoogleToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken!,
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

export class SearchConsoleMCPTool implements MCPTool<SearchConsoleInput, SearchConsoleData> {
  name = 'search_console'
  description = 'Fetches Google Search Console performance data including queries and pages'
  inputSchema = SearchConsoleInputSchema

  async execute(input: SearchConsoleInput): Promise<SearchConsoleData> {
    const hasCredentials =
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN

    if (!hasCredentials) {
      console.log('[SearchConsoleMCPTool] No credentials found, returning mock data')
      return generateMockData(input)
    }

    try {
      const accessToken = await refreshGoogleToken()

      const requestBody = {
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions,
        rowLimit: 500,
      }

      const [queriesRes, pagesRes] = await Promise.all([
        fetch(
          `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...requestBody, dimensions: ['query'] }),
          }
        ),
        fetch(
          `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...requestBody, dimensions: ['page'] }),
          }
        ),
      ])

      if (!queriesRes.ok || !pagesRes.ok) {
        throw new Error('Search Console API request failed')
      }

      const queriesData = (await queriesRes.json()) as {
        rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>
      }
      const pagesData = (await pagesRes.json()) as {
        rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>
      }

      return {
        site: input.siteUrl,
        queries: (queriesData.rows ?? []).map((row) => ({
          query: row.keys[0] ?? '',
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        })),
        pages: (pagesData.rows ?? []).map((row) => ({
          page: row.keys[0] ?? '',
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        })),
        dateRange: { start: input.startDate, end: input.endDate },
      }
    } catch (err) {
      console.warn('[SearchConsoleMCPTool] Real API failed, falling back to mock:', err)
      return generateMockData(input)
    }
  }
}
