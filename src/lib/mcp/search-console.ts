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

/** Host from a URL-prefix style site URL (for Domain-property hint text). */
function siteUrlHostname(siteUrl: string): string | null {
  if (siteUrl.startsWith('sc-domain:')) return null
  try {
    const u = siteUrl.includes('://') ? siteUrl : `https://${siteUrl}`
    const host = new URL(u).hostname
    return host || null
  } catch {
    return null
  }
}

/**
 * 403 responses mean different things; avoid blaming OAuth scopes when the issue is
 * property URL shape (sc-domain: vs https://) or Search Console user access.
 */
function searchConsole403Hint(errorBodies: string, siteUrl: string): string {
  const t = errorBodies.toLowerCase()
  if (
    t.includes('access_token_scope_insufficient') ||
    t.includes('insufficient authentication scopes')
  ) {
    return ' Hint: add OAuth scope https://www.googleapis.com/auth/webmasters.readonly, re-consent, and update GOOGLE_REFRESH_TOKEN.'
  }
  if (t.includes('does not have sufficient permission for site')) {
    const host = siteUrlHostname(siteUrl)
    const domainPropertyTip =
      host && (siteUrl.startsWith('http://') || siteUrl.startsWith('https://'))
        ? ` If Search Console shows a Domain property for "${host}", set SEARCH_CONSOLE_SITE_URL=sc-domain:${host} (the API site URL must match the property type).`
        : ''
    return ` Hint: the signed-in Google account must have access (Owner or Full user) to this exact property string in the API.${domainPropertyTip} See https://support.google.com/webmasters/answer/2451999`
  }
  return ' Hint: verify SEARCH_CONSOLE_SITE_URL matches Search Console (Domain property: sc-domain:example.com; URL-prefix: https://example.com/ often with trailing slash).'
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
        const qBody = queriesRes.ok ? '' : await queriesRes.text()
        const pBody = pagesRes.ok ? '' : await pagesRes.text()
        const parts: string[] = []
        if (!queriesRes.ok) {
          parts.push(
            `queries ${queriesRes.status} ${queriesRes.statusText}: ${qBody.slice(0, 600)}`
          )
        }
        if (!pagesRes.ok) {
          parts.push(`pages ${pagesRes.status} ${pagesRes.statusText}: ${pBody.slice(0, 600)}`)
        }
        const combined = parts.join(' | ')
        const hint403 =
          queriesRes.status === 403 || pagesRes.status === 403
            ? searchConsole403Hint(combined, input.siteUrl)
            : ''
        throw new Error(`Search Console API request failed — ${combined}${hint403}`)
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
      console.error('[SearchConsoleMCPTool] Search Console API error:', err)
      if (err instanceof Error) throw err
      throw new Error(String(err))
    }
  }
}
