import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { randomUUID } from 'crypto'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })

async function seed() {
  console.log('🌱 Seeding database...')

  // Admin user
  const userId = randomUUID()
  await db
    .insert(schema.users)
    .values({
      id: userId,
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    })
    .onConflictDoNothing()
  console.log('✓ Created admin user')

  // Sample completed run
  const runId = randomUUID()
  await db.insert(schema.agentRuns).values({
    id: runId,
    status: 'completed',
    triggerType: 'manual',
    startedAt: new Date(Date.now() - 1000 * 60 * 5),
    completedAt: new Date(),
    metadata: { trigger: 'seed', notes: 'Sample completed run' },
  })
  console.log('✓ Created sample agent run')

  // Sample observations
  await db.insert(schema.observations).values([
    {
      id: randomUUID(),
      runId,
      source: 'search_console',
      type: 'keyword_data',
      data: {
        top_queries: [
          { query: 'seo tools for startups', clicks: 142, impressions: 2800, ctr: 0.051, position: 8.2 },
          { query: 'content strategy 2024', clicks: 89, impressions: 1900, ctr: 0.047, position: 11.4 },
          { query: 'keyword research guide', clicks: 201, impressions: 3100, ctr: 0.065, position: 6.8 },
        ],
      },
    },
    {
      id: randomUUID(),
      runId,
      source: 'analytics',
      type: 'traffic_data',
      data: {
        sessions: 4821,
        pageviews: 11340,
        bounce_rate: 0.62,
        top_pages: [
          { path: '/blog/seo-guide', pageviews: 1240 },
          { path: '/blog/content-strategy', pageviews: 890 },
        ],
      },
    },
    {
      id: randomUUID(),
      runId,
      source: 'sanity',
      type: 'content_inventory',
      data: {
        total_posts: 47,
        recent_posts: [
          { title: 'Complete SEO Guide for 2024', slug: 'seo-guide-2024', publishedAt: '2024-01-15' },
          { title: 'Content Marketing Fundamentals', slug: 'content-marketing', publishedAt: '2024-01-08' },
        ],
      },
    },
  ])
  console.log('✓ Created sample observations')

  // Sample proposed actions
  const action1Id = randomUUID()
  const action2Id = randomUUID()
  const action3Id = randomUUID()

  await db.insert(schema.proposedActions).values([
    {
      id: action1Id,
      runId,
      actionType: 'CREATE_BLOG',
      payload: {
        title: 'The Complete Guide to Technical SEO in 2024',
        slug: 'technical-seo-guide-2024',
        target_keywords: ['technical seo', 'seo audit', 'site speed optimization'],
        meta_description: 'Master technical SEO with our comprehensive guide covering Core Web Vitals, crawlability, and site architecture.',
        word_count_target: 3500,
        internal_links: [],
        outline: '1. Introduction\n2. Core Web Vitals\n3. Crawlability\n4. Site Architecture\n5. Schema Markup',
      },
      riskLevel: 'low',
      status: 'pending',
      requiresApproval: false,
      reasoning: 'High search volume keyword with low competition. Gap in existing content inventory.',
    },
    {
      id: action2Id,
      runId,
      actionType: 'UPDATE_METADATA',
      payload: {
        external_id: 'abc123',
        title: 'Complete SEO Guide for 2024 — Proven Strategies That Work',
        meta_description: 'Discover proven SEO strategies for 2024. Covers keyword research, on-page optimization, link building, and technical SEO.',
      },
      riskLevel: 'low',
      status: 'approved',
      requiresApproval: false,
      reasoning: 'Current meta description is too short and missing target keywords. CTR is below average at 3.2%.',
    },
    {
      id: action3Id,
      runId,
      actionType: 'MERGE_CONTENT',
      payload: {
        source_ids: ['post-old-1', 'post-old-2'],
        target_title: 'Content Strategy: The Definitive Guide',
        target_slug: 'content-strategy-definitive-guide',
        reason: 'Two overlapping posts are cannibalizing each other on "content strategy" keywords.',
      },
      riskLevel: 'high',
      status: 'pending',
      requiresApproval: true,
      reasoning: 'Keyword cannibalization detected. Posts compete for the same queries with similar CTR.',
    },
  ])
  console.log('✓ Created sample proposed actions')

  // Sample executed action
  await db.insert(schema.executedActions).values({
    id: randomUUID(),
    proposedActionId: action2Id,
    runId,
    result: { success: true, message: 'Metadata updated successfully', externalId: 'abc123' },
    executedAt: new Date(),
    executedBy: 'system',
  })
  console.log('✓ Created sample executed action')

  // Sample memory entries
  await db.insert(schema.memoryEntries).values([
    {
      id: randomUUID(),
      category: 'blog_topic',
      key: 'topic:technical-seo-guide-2024',
      value: { title: 'Technical SEO Guide 2024', seen_at: new Date().toISOString(), status: 'proposed' },
      relevanceScore: '0.9',
      lastAccessedAt: new Date(),
    },
    {
      id: randomUUID(),
      category: 'seo_observation',
      key: 'obs:keyword-gap-enterprise-seo',
      value: { insight: 'Missing coverage on enterprise SEO topics despite growing search volume', keywords: ['enterprise seo', 'seo at scale'], priority: 'high' },
      relevanceScore: '0.85',
      lastAccessedAt: new Date(),
    },
    {
      id: randomUUID(),
      category: 'strategic_insight',
      key: 'insight:topical-authority-gap',
      value: {
        title: 'Build Topical Authority in Technical SEO',
        description: 'Current content lacks depth in technical SEO topics. Competitors have 3x more content coverage.',
        rationale: 'Topical authority is a key ranking factor. Creating a content cluster around technical SEO can boost rankings for 50+ related queries.',
        estimated_impact: 'high',
        category: 'content_strategy',
      },
      relevanceScore: '0.95',
      lastAccessedAt: new Date(),
    },
    {
      id: randomUUID(),
      category: 'rejected_suggestion',
      key: 'rejected:delete-old-content-batch',
      value: { reason: 'Too aggressive. Prefer consolidation over deletion.', rejected_at: new Date().toISOString() },
      relevanceScore: '0.5',
      lastAccessedAt: new Date(),
    },
  ])
  console.log('✓ Created sample memory entries')

  // Sample content snapshots
  await db.insert(schema.contentSnapshots).values([
    {
      id: randomUUID(),
      externalId: 'abc123',
      source: 'sanity',
      title: 'Complete SEO Guide for 2024',
      slug: 'seo-guide-2024',
      contentHash: 'a1b2c3d4e5f6',
      metadata: { wordCount: 2800, categories: ['SEO', 'Marketing'], status: 'published' },
      lastSyncedAt: new Date(),
    },
    {
      id: randomUUID(),
      externalId: 'def456',
      source: 'sanity',
      title: 'Content Marketing Fundamentals',
      slug: 'content-marketing-fundamentals',
      contentHash: 'f6e5d4c3b2a1',
      metadata: { wordCount: 1900, categories: ['Content', 'Marketing'], status: 'published' },
      lastSyncedAt: new Date(),
    },
  ])
  console.log('✓ Created sample content snapshots')

  // Sample conversation
  const convId = randomUUID()
  await db.insert(schema.conversations).values({
    id: convId,
    runId,
    messages: [
      { role: 'user', content: 'Why are you recommending we merge those two posts?', timestamp: new Date(Date.now() - 60000) },
      { role: 'assistant', content: 'Great question. Both posts — "Content Strategy Basics" and "Getting Started with Content Strategy" — are targeting nearly identical keyword clusters. Google Search Console shows them competing directly for queries like "content strategy guide" and "how to create content strategy". This is called keyword cannibalization, and it means neither post ranks as well as a single consolidated piece would. By merging them into one authoritative guide, you consolidate link equity, reduce confusion for search engines, and create a resource that can rank in position 1-3 rather than both pages fighting for positions 8-15.', timestamp: new Date(Date.now() - 30000) },
    ],
  })
  console.log('✓ Created sample conversation')

  console.log('\n✅ Seed complete!')
  await pool.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
