import { z } from 'zod'
import type { MCPTool, SanityContent } from './types'

const SanityInputSchema = z.object({
  projectId: z.string().optional(),
  dataset: z.string().default('production'),
  query: z.string().optional(),
})

type SanityInput = z.infer<typeof SanityInputSchema>

const DEFAULT_GROQ_QUERY =
  '*[_type == "post"] | order(_updatedAt desc) [0..49] { _id, title, slug, metaTitle, metaDescription, publishedAt, _updatedAt, "categories": categories[]->title }'

function generateMockPosts(): SanityContent[] {
  return [
    {
      _id: 'post-001',
      title: 'The Complete Guide to On-Page SEO in 2024',
      slug: { current: 'complete-guide-on-page-seo-2024' },
      metaTitle: 'On-Page SEO Guide 2024 | Best Practices & Checklist',
      metaDescription: 'Master on-page SEO with our comprehensive 2024 guide. Learn keyword optimization, content structure, and technical elements.',
      publishedAt: '2024-01-15T10:00:00Z',
      _updatedAt: '2024-03-20T14:30:00Z',
      categories: ['SEO', 'Content Marketing'],
    },
    {
      _id: 'post-002',
      title: 'Keyword Research: The Ultimate Step-by-Step Guide',
      slug: { current: 'keyword-research-step-by-step-guide' },
      metaTitle: 'Keyword Research Guide - Find the Right Keywords',
      metaDescription: 'Learn how to do keyword research like a pro. Discover tools, techniques, and strategies to find profitable keywords.',
      publishedAt: '2024-02-01T09:00:00Z',
      _updatedAt: '2024-04-10T11:00:00Z',
      categories: ['SEO', 'Keyword Research'],
    },
    {
      _id: 'post-003',
      title: 'Technical SEO Audit: A Complete Checklist',
      slug: { current: 'technical-seo-audit-checklist' },
      metaTitle: 'Technical SEO Audit Checklist 2024',
      metaDescription: 'Run a full technical SEO audit with our step-by-step checklist. Fix crawlability, indexation, and performance issues.',
      publishedAt: '2024-02-15T08:00:00Z',
      _updatedAt: '2024-05-05T16:00:00Z',
      categories: ['Technical SEO'],
    },
    {
      _id: 'post-004',
      title: 'Link Building Strategies That Actually Work in 2024',
      slug: { current: 'link-building-strategies-2024' },
      metaTitle: 'Effective Link Building Strategies | SEO Guide',
      metaDescription: 'Discover proven link building strategies to boost your domain authority and organic rankings in 2024.',
      publishedAt: '2024-03-01T12:00:00Z',
      _updatedAt: '2024-05-15T10:30:00Z',
      categories: ['SEO', 'Link Building'],
    },
    {
      _id: 'post-005',
      title: 'Content Marketing Strategy for Organic Growth',
      slug: { current: 'content-marketing-strategy-organic-growth' },
      metaTitle: 'Content Marketing Strategy for SEO | Complete Guide',
      metaDescription: 'Build a content marketing strategy that drives organic traffic. Learn topic clusters, content calendars, and distribution.',
      publishedAt: '2024-03-15T11:00:00Z',
      _updatedAt: '2024-06-01T09:45:00Z',
      categories: ['Content Marketing', 'SEO'],
    },
    {
      _id: 'post-006',
      title: 'Core Web Vitals: What They Are and How to Improve Them',
      slug: { current: 'core-web-vitals-guide' },
      metaTitle: 'Core Web Vitals Guide - Improve LCP, FID, CLS',
      metaDescription: 'Understand Core Web Vitals and learn actionable tips to improve LCP, FID, and CLS for better SEO performance.',
      publishedAt: '2024-04-01T10:00:00Z',
      _updatedAt: '2024-06-10T14:00:00Z',
      categories: ['Technical SEO', 'Performance'],
    },
    {
      _id: 'post-007',
      title: 'Local SEO: How to Rank in Your City',
      slug: { current: 'local-seo-rank-in-your-city' },
      metaTitle: 'Local SEO Guide - Rank Higher in Local Searches',
      metaDescription: 'Boost your local search visibility with our complete local SEO guide. Google Business Profile, citations, and more.',
      publishedAt: '2024-04-15T09:30:00Z',
      _updatedAt: '2024-06-20T11:00:00Z',
      categories: ['Local SEO'],
    },
    {
      _id: 'post-008',
      title: 'E-E-A-T: How Google Evaluates Content Quality',
      slug: { current: 'eeat-google-content-quality' },
      metaTitle: 'E-E-A-T Explained | Google Content Quality Guide',
      metaDescription: 'Learn what E-E-A-T means and how to demonstrate Experience, Expertise, Authoritativeness, and Trustworthiness.',
      publishedAt: '2024-05-01T08:00:00Z',
      _updatedAt: '2024-07-01T15:30:00Z',
      categories: ['SEO', 'Content Marketing'],
    },
    {
      _id: 'post-009',
      title: 'Schema Markup: The Complete Implementation Guide',
      slug: { current: 'schema-markup-implementation-guide' },
      metaTitle: 'Schema Markup Guide - Structured Data for SEO',
      metaDescription: 'Implement schema markup to earn rich snippets and improve click-through rates. Full guide with examples.',
      publishedAt: '2024-05-15T11:30:00Z',
      _updatedAt: '2024-07-10T10:00:00Z',
      categories: ['Technical SEO'],
    },
    {
      _id: 'post-010',
      title: 'SEO for E-commerce: How to Drive Product Traffic',
      slug: { current: 'seo-ecommerce-product-traffic' },
      metaTitle: 'E-commerce SEO Guide | Rank Product Pages Higher',
      metaDescription: 'Optimize your e-commerce store for search engines. Product page SEO, category pages, and site architecture tips.',
      publishedAt: '2024-06-01T10:00:00Z',
      _updatedAt: '2024-07-20T13:00:00Z',
      categories: ['E-commerce SEO', 'SEO'],
    },
  ]
}

export class SanityMCPTool implements MCPTool<SanityInput, SanityContent[]> {
  name = 'sanity'
  description = 'Fetches content from Sanity CMS using GROQ queries'
  inputSchema = SanityInputSchema

  async execute(input: SanityInput): Promise<SanityContent[]> {
    const projectId = input.projectId || process.env.SANITY_PROJECT_ID
    const apiToken = process.env.SANITY_API_TOKEN

    if (!projectId) {
      console.log('[SanityMCPTool] No project ID found, returning mock data')
      return generateMockPosts()
    }

    try {
      const dataset = input.dataset || 'production'
      const groqQuery = input.query || DEFAULT_GROQ_QUERY
      const encodedQuery = encodeURIComponent(groqQuery)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`
      }

      const response = await fetch(
        `https://${projectId}.api.sanity.io/v2021-10-21/data/query/${dataset}?query=${encodedQuery}`,
        { headers }
      )

      if (!response.ok) {
        throw new Error(`Sanity API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { result: SanityContent[] }
      return data.result ?? []
    } catch (err) {
      console.warn('[SanityMCPTool] Real API failed, falling back to mock:', err)
      return generateMockPosts()
    }
  }

  async createDocument(
    doc: Record<string, unknown>,
    projectId?: string,
    dataset = 'production'
  ): Promise<{ _id: string }> {
    const pid = projectId || process.env.SANITY_PROJECT_ID
    const apiToken = process.env.SANITY_API_TOKEN

    if (!pid || !apiToken) {
      const mockId = `draft.${Date.now()}`
      console.log(`[SanityMCPTool] [DRY RUN] Would create document: ${JSON.stringify(doc).substring(0, 100)}...`)
      return { _id: mockId }
    }

    const response = await fetch(
      `https://${pid}.api.sanity.io/v2021-10-21/data/mutate/${dataset}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mutations: [{ create: doc }],
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Sanity create failed: ${response.status} ${response.statusText}`)
    }

    const result = (await response.json()) as { results: Array<{ id: string }> }
    return { _id: result.results[0]?.id ?? `created-${Date.now()}` }
  }

  async patchDocument(
    documentId: string,
    patch: Record<string, unknown>,
    projectId?: string,
    dataset = 'production'
  ): Promise<void> {
    const pid = projectId || process.env.SANITY_PROJECT_ID
    const apiToken = process.env.SANITY_API_TOKEN

    if (!pid || !apiToken) {
      console.log(`[SanityMCPTool] [DRY RUN] Would patch document ${documentId}:`, patch)
      return
    }

    const response = await fetch(
      `https://${pid}.api.sanity.io/v2021-10-21/data/mutate/${dataset}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mutations: [{ patch: { id: documentId, set: patch } }],
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Sanity patch failed: ${response.status} ${response.statusText}`)
    }
  }
}
