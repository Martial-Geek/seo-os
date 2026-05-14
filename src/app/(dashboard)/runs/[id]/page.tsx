import db from '@/db'
import { agentRuns, observations, proposedActions, executedActions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { RunActionCard } from '@/components/runs/run-action-card'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

function statusBadge(status: RunStatus) {
  const classes: Record<RunStatus, string> = {
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[status] ?? classes.pending}`}
    >
      {status}
    </span>
  )
}

function sourceBadge(source: string) {
  const colors: Record<string, string> = {
    search_console: 'bg-blue-500/20 text-blue-400',
    analytics: 'bg-purple-500/20 text-purple-400',
    sanity: 'bg-orange-500/20 text-orange-400',
    memory: 'bg-teal-500/20 text-teal-400',
  }
  const cls = colors[source] ?? 'bg-gray-500/20 text-gray-400'
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {source}
    </span>
  )
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let run: typeof agentRuns.$inferSelect | undefined
  let runObservations: (typeof observations.$inferSelect)[] = []
  let runProposedActions: (typeof proposedActions.$inferSelect)[] = []
  let runExecutedActions: (typeof executedActions.$inferSelect)[] = []

  try {
    const result = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1)
    run = result[0]
  } catch {}

  if (!run) notFound()

  try {
    runObservations = await db
      .select()
      .from(observations)
      .where(eq(observations.runId, id))
      .orderBy(desc(observations.createdAt))
  } catch {}

  try {
    runProposedActions = await db
      .select()
      .from(proposedActions)
      .where(eq(proposedActions.runId, id))
      .orderBy(desc(proposedActions.createdAt))
  } catch {}

  try {
    runExecutedActions = await db
      .select()
      .from(executedActions)
      .where(eq(executedActions.runId, id))
      .orderBy(desc(executedActions.executedAt))
  } catch {}

  const pendingCount = runProposedActions.filter((a) => a.status === 'pending').length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight font-mono">
              Run {run.id.slice(0, 8)}
            </h1>
            {statusBadge(run.status as RunStatus)}
            <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {run.triggerType}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {run.startedAt
              ? `Started ${formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}`
              : `Created ${formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}`}
            {run.completedAt &&
              ` · Completed ${formatDistanceToNow(new Date(run.completedAt), { addSuffix: true })}`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/conversations">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            View Conversations
          </Link>
        </Button>
      </div>

      {run.error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          <strong>Error:</strong> {run.error}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="observations">
        <TabsList>
          <TabsTrigger value="observations">
            Observations ({runObservations.length})
          </TabsTrigger>
          <TabsTrigger value="proposed">
            Proposed Actions ({runProposedActions.length})
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-400">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="executed">
            Executed ({runExecutedActions.length})
          </TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
        </TabsList>

        {/* Observations */}
        <TabsContent value="observations" className="space-y-3 mt-4">
          {runObservations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No observations recorded for this run.
            </p>
          ) : (
            runObservations.map((obs) => (
              <ObservationCard key={obs.id} obs={obs} />
            ))
          )}
        </TabsContent>

        {/* Proposed Actions */}
        <TabsContent value="proposed" className="space-y-3 mt-4">
          {runProposedActions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No actions proposed in this run.
            </p>
          ) : (
            runProposedActions.map((action) => (
              <RunActionCard key={action.id} action={action} />
            ))
          )}
        </TabsContent>

        {/* Executed Actions */}
        <TabsContent value="executed" className="space-y-3 mt-4">
          {runExecutedActions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No actions executed in this run.
            </p>
          ) : (
            runExecutedActions.map((exec) => (
              <ExecutedActionCard key={exec.id} exec={exec} />
            ))
          )}
        </TabsContent>

        {/* Conversation */}
        <TabsContent value="conversation" className="mt-4">
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Start a conversation to discuss insights from this run.
              </p>
              <Button asChild size="sm">
                <Link href="/conversations">Open Conversations</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ObservationCard({ obs }: { obs: typeof observations.$inferSelect }) {
  const [isExpanded, setIsExpanded] = [false, () => {}]

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono">
            {obs.type}
          </span>
          <span className="rounded bg-blue-500/20 text-blue-400 px-2 py-0.5 text-xs font-medium">
            {obs.source}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(obs.createdAt), { addSuffix: true })}
          </span>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            View data
          </summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-3">
            {JSON.stringify(obs.data, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}

function ExecutedActionCard({ exec }: { exec: typeof executedActions.$inferSelect }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            Action: {exec.proposedActionId.slice(0, 8)}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(exec.executedAt), { addSuffix: true })}
          </span>
          {exec.executedBy && (
            <span className="text-xs text-muted-foreground">by {exec.executedBy}</span>
          )}
        </div>
        {exec.result != null && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View result
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-3">
              {JSON.stringify(exec.result as Record<string, unknown>, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
