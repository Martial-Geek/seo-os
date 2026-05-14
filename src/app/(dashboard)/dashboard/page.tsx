import db from '@/db'
import { agentRuns, proposedActions, memoryEntries, contentSnapshots } from '@/db/schema'
import { desc, eq, count } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Play, CheckCircle, Brain, FileText } from 'lucide-react'

type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

function statusBadge(status: RunStatus) {
  const variants: Record<RunStatus, string> = {
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[status] ?? variants.pending}`}
    >
      {status}
    </span>
  )
}

export default async function DashboardPage() {
  let totalRuns = 0
  let pendingApprovals = 0
  let totalMemory = 0
  let totalSnapshots = 0
  let recentRuns: (typeof agentRuns.$inferSelect)[] = []

  try {
    const [runsResult] = await db.select({ value: count() }).from(agentRuns)
    totalRuns = runsResult?.value ?? 0
  } catch {}

  try {
    const [approvalsResult] = await db
      .select({ value: count() })
      .from(proposedActions)
      .where(eq(proposedActions.status, 'pending'))
    pendingApprovals = approvalsResult?.value ?? 0
  } catch {}

  try {
    const [memoryResult] = await db.select({ value: count() }).from(memoryEntries)
    totalMemory = memoryResult?.value ?? 0
  } catch {}

  try {
    const [snapshotsResult] = await db.select({ value: count() }).from(contentSnapshots)
    totalSnapshots = snapshotsResult?.value ?? 0
  } catch {}

  try {
    recentRuns = await db
      .select()
      .from(agentRuns)
      .orderBy(desc(agentRuns.createdAt))
      .limit(5)
  } catch {}

  const stats = [
    {
      title: 'Total Runs',
      value: totalRuns,
      icon: Play,
      href: '/runs',
      color: 'text-blue-400',
    },
    {
      title: 'Pending Approvals',
      value: pendingApprovals,
      icon: CheckCircle,
      href: '/approvals',
      color: 'text-yellow-400',
    },
    {
      title: 'Memory Entries',
      value: totalMemory,
      icon: Brain,
      href: '/memory',
      color: 'text-purple-400',
    },
    {
      title: 'Content Snapshots',
      value: totalSnapshots,
      icon: FileText,
      href: '/content',
      color: 'text-green-400',
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">AI Content Operations Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ title, value, icon: Icon, href, color }) => (
          <Link key={title} href={href}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value.toLocaleString()}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Runs</CardTitle>
          <Link href="/runs" className="text-xs text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No runs yet. Start an agent run to begin.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 pb-2 text-xs font-medium text-muted-foreground">
                <span>Run ID</span>
                <span>Status</span>
                <span>Trigger</span>
                <span>Started</span>
              </div>
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="grid grid-cols-4 gap-4 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {run.id.slice(0, 8)}
                  </span>
                  <span>{statusBadge(run.status as RunStatus)}</span>
                  <span className="text-muted-foreground">{run.triggerType}</span>
                  <span className="text-muted-foreground">
                    {run.startedAt
                      ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })
                      : formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
