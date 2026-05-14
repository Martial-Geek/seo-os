import db from '@/db'
import { memoryEntries } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeleteMemoryButton } from '@/components/memory/delete-memory-button'

type MemoryCategory =
  | 'blog_topic'
  | 'seo_observation'
  | 'strategic_insight'
  | 'rejected_suggestion'
  | 'action_history'

const categoryLabels: Record<MemoryCategory, string> = {
  blog_topic: 'Blog Topics',
  seo_observation: 'SEO Observations',
  strategic_insight: 'Strategic Insights',
  action_history: 'Action History',
  rejected_suggestion: 'Rejected',
}

const categories: MemoryCategory[] = [
  'blog_topic',
  'seo_observation',
  'strategic_insight',
  'action_history',
  'rejected_suggestion',
]

interface MemoryTableProps {
  entries: (typeof memoryEntries.$inferSelect)[]
}

function MemoryTable({ entries }: MemoryTableProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No entries in this category.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-2 pb-2 text-xs font-medium text-muted-foreground">
        <span>Key</span>
        <span>Relevance</span>
        <span>Last Accessed</span>
        <span>Expires</span>
        <span></span>
      </div>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 rounded-md px-2 py-2 text-sm hover:bg-accent/50"
        >
          <span className="truncate font-mono text-xs" title={entry.key}>
            {entry.key.length > 60 ? entry.key.slice(0, 60) + '…' : entry.key}
          </span>
          <span className="text-right tabular-nums text-muted-foreground">
            {parseFloat(entry.relevanceScore ?? '1').toFixed(2)}
          </span>
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(entry.lastAccessedAt), { addSuffix: true })}
          </span>
          <span className="text-muted-foreground">
            {entry.expiresAt
              ? formatDistanceToNow(new Date(entry.expiresAt), { addSuffix: true })
              : 'Never'}
          </span>
          <DeleteMemoryButton id={entry.id} />
        </div>
      ))}
    </div>
  )
}

export default async function MemoryPage() {
  let allEntries: (typeof memoryEntries.$inferSelect)[] = []

  try {
    allEntries = await db
      .select()
      .from(memoryEntries)
      .orderBy(desc(memoryEntries.lastAccessedAt))
  } catch {}

  const byCategory = categories.reduce<
    Record<MemoryCategory, (typeof memoryEntries.$inferSelect)[]>
  >(
    (acc, cat) => {
      acc[cat] = allEntries.filter((e) => e.category === cat)
      return acc
    },
    {
      blog_topic: [],
      seo_observation: [],
      strategic_insight: [],
      action_history: [],
      rejected_suggestion: [],
    }
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Memory</h1>
        <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-sm font-medium text-purple-400">
          {allEntries.length} entries
        </span>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All ({allEntries.length})</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {categoryLabels[cat]} ({byCategory[cat].length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <MemoryTable entries={allEntries} />
        </TabsContent>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-4">
            <MemoryTable entries={byCategory[cat]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
