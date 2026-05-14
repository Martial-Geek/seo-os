import db from '@/db'
import { memoryEntries } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lightbulb } from 'lucide-react'

type ImpactLevel = 'low' | 'medium' | 'high'

function impactBadge(impact: ImpactLevel) {
  const classes: Record<ImpactLevel, string> = {
    high: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  const cls = classes[impact] ?? classes.medium
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {impact} impact
    </span>
  )
}

interface SuggestionValue {
  title?: string
  description?: string
  rationale?: string
  estimated_impact?: ImpactLevel
  category?: string
  created_at?: string
}

export default async function SuggestionsPage() {
  let suggestions: (typeof memoryEntries.$inferSelect)[] = []

  try {
    suggestions = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.category, 'strategic_insight'))
      .orderBy(desc(memoryEntries.createdAt))
  } catch {}

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Suggestions</h1>
        <span className="rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-sm font-medium text-yellow-400">
          {suggestions.length}
        </span>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Lightbulb className="mb-4 h-12 w-12 text-yellow-400/40" />
          <p className="text-lg font-medium text-muted-foreground">No suggestions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start an agent run to generate strategic insights.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((entry) => {
            const val = (entry.value ?? {}) as SuggestionValue
            const impact = (val.estimated_impact ?? 'medium') as ImpactLevel
            const createdAt = val.created_at
              ? new Date(val.created_at)
              : new Date(entry.createdAt)
            const rationale = val.rationale ?? ''

            return (
              <Card key={entry.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {val.title ?? entry.key}
                    </CardTitle>
                    {impactBadge(impact)}
                  </div>
                  {val.category && (
                    <span className="text-xs text-muted-foreground">{val.category}</span>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  {val.description && (
                    <p className="text-sm text-muted-foreground">{val.description}</p>
                  )}
                  {rationale && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{rationale}</p>
                  )}
                  <p className="mt-auto pt-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(createdAt, { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
