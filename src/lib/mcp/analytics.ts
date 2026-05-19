import { z } from 'zod'
import type { MCPTool, AnalyticsData } from './types'

const AnalyticsInputSchema = z.object({
  propertyId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  metrics: z.array(z.string()).default(['sessions', 'pageviews', 'bounceRate', 'avgSessionDuration']),
})

type AnalyticsInput = z.infer<typeof AnalyticsInputSchema>

function generateMockData(input: AnalyticsInput): AnalyticsData {
  const endDate = new Date(input.endDate)
  const startDate = new Date(input.startDate)
  const daysDiff = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  )
  const multiplier = daysDiff / 30

  return {
    sessions: Math.round(5000 * multiplier),
    pageviews: Math.round(12000 * multiplier),
    bounceRate: 0.58,
    avgSessionDuration: 187,
    topPages: [
      { path: '/blog/seo-guide', pageviews: Math.round(1840 * multiplier), avgTime: 245 },
      { path: '/blog/keyword-research', pageviews: Math.round(1520 * multiplier), avgTime: 312 },
      { path: '/blog/content-strategy', pageviews: Math.round(1340 * multiplier), avgTime: 278 },
      { path: '/blog/technical-seo', pageviews: Math.round(1120 * multiplier), avgTime: 334 },
      { path: '/blog/link-building', pageviews: Math.round(980 * multiplier), avgTime: 256 },
      { path: '/blog/on-page-seo', pageviews: Math.round(890 * multiplier), avgTime: 223 },
      { path: '/services/seo-audit', pageviews: Math.round(760 * multiplier), avgTime: 189 },
      { path: '/blog/local-seo', pageviews: Math.round(680 * multiplier), avgTime: 201 },
      { path: '/blog/ecommerce-seo', pageviews: Math.round(620 * multiplier), avgTime: 267 },
      { path: '/blog/core-web-vitals', pageviews: Math.round(540 * multiplier), avgTime: 298 },
    ],
    trafficSources: [
      { source: 'google / organic', sessions: Math.round(3200 * multiplier) },
      { source: 'direct / none', sessions: Math.round(800 * multiplier) },
      { source: 'google / cpc', sessions: Math.round(400 * multiplier) },
      { source: 'twitter / referral', sessions: Math.round(280 * multiplier) },
      { source: 'linkedin / referral', sessions: Math.round(180 * multiplier) },
      { source: 'newsletter / email', sessions: Math.round(140 * multiplier) },
    ],
    dateRange: { start: input.startDate, end: input.endDate },
  }
}

async function refreshGoogleToken(): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

export class AnalyticsMCPTool implements MCPTool<AnalyticsInput, AnalyticsData> {
  name = 'analytics'
  description = 'Fetches Google Analytics Data API v1 traffic and engagement metrics'
  inputSchema = AnalyticsInputSchema

  async execute(input: AnalyticsInput): Promise<AnalyticsData> {
    const missing = (
      ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GA_PROPERTY_ID'] as const
    ).filter((key) => !process.env[key])

    if (missing.length > 0) {
      throw new Error(`Missing required Google Analytics env vars: ${missing.join(', ')}`)
    }

    try {
      const accessToken = await refreshGoogleToken()
      const propertyId = input.propertyId || process.env.GA_PROPERTY_ID!

      const requestBody = {
        dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
        dimensions: [{ name: 'pagePath' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }

      const [summaryRes, pagesRes] = await Promise.all([
        fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
              metrics: [
                { name: 'sessions' },
                { name: 'screenPageViews' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' },
              ],
            }),
          }
        ),
        fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        ),
      ])

      if (!summaryRes.ok || !pagesRes.ok) {
        const failedRes = !summaryRes.ok ? summaryRes : pagesRes
        const label = !summaryRes.ok ? 'summary' : 'pages'
        const body = await failedRes.text()
        throw new Error(`Analytics API ${label} request failed (${failedRes.status}): ${body}`)
      }

      type GAMetricValue = { value: string }
      type GARow = { dimensionValues?: Array<{ value: string }>; metricValues?: GAMetricValue[] }
      type GAReport = { rows?: GARow[]; totals?: GARow[] }

      const summaryData = (await summaryRes.json()) as GAReport
      const pagesData = (await pagesRes.json()) as GAReport

      const totals = summaryData.totals?.[0]?.metricValues ?? summaryData.rows?.[0]?.metricValues ?? []

      const topPages = (pagesData.rows ?? []).map((row) => ({
        path: row.dimensionValues?.[0]?.value ?? '/',
        pageviews: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
        avgTime: parseFloat(row.metricValues?.[3]?.value ?? '0'),
      }))

      // Get traffic sources
      const sourcesRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
            metrics: [{ name: 'sessions' }],
            dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 6,
          }),
        }
      )

      const sourcesData = sourcesRes.ok ? ((await sourcesRes.json()) as GAReport) : { rows: [] }

      const trafficSources = (sourcesData.rows ?? []).map((row) => ({
        source: `${row.dimensionValues?.[0]?.value ?? 'unknown'} / ${row.dimensionValues?.[1]?.value ?? 'none'}`,
        sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      }))

      return {
        sessions: parseInt(totals[0]?.value ?? '0', 10),
        pageviews: parseInt(totals[1]?.value ?? '0', 10),
        bounceRate: parseFloat(totals[2]?.value ?? '0'),
        avgSessionDuration: parseFloat(totals[3]?.value ?? '0'),
        topPages,
        trafficSources,
        dateRange: { start: input.startDate, end: input.endDate },
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err))
    }
  }
}
