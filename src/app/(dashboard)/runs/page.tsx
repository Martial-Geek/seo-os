import db from '@/db'
import { agentRuns } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewRunButton } from '@/components/runs/new-run-button'

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

function getDuration(run: typeof agentRuns.$inferSelect): string {
  if (!run.startedAt) return '—'
  const end = run.completedAt ? new Date(run.completedAt) : new Date()
  const diffMs = end.getTime() - new Date(run.startedAt).getTime()
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return `${mins}m ${rem}s`
}

export default async function RunsPage() {
  let runs: (typeof agentRuns.$inferSelect)[] = []

  try {
    runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt))
  } catch {}

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Runs</h1>
          <p className="text-sm text-muted-foreground">
            {runs.length} run{runs.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <NewRunButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No runs yet. Click "New Run" to get started.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-4 px-2 pb-2 text-xs font-medium text-muted-foreground">
                <span>Run ID</span>
                <span>Status</span>
                <span>Trigger</span>
                <span>Started</span>
                <span>Duration</span>
              </div>
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="grid grid-cols-5 gap-4 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {run.id.slice(0, 8)}…
                  </span>
                  <span>{statusBadge(run.status as RunStatus)}</span>
                  <span className="text-muted-foreground">{run.triggerType}</span>
                  <span className="text-muted-foreground">
                    {run.startedAt
                      ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })
                      : formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </span>
                  <span className="text-muted-foreground">{getDuration(run)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
