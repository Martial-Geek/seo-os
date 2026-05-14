import db from '@/db'
import { proposedActions, agentRuns } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { RunActionCard } from '@/components/runs/run-action-card'

export default async function ApprovalsPage() {
  let pending: (typeof proposedActions.$inferSelect)[] = []

  try {
    pending = await db
      .select()
      .from(proposedActions)
      .where(eq(proposedActions.status, 'pending'))
      .orderBy(desc(proposedActions.createdAt))
  } catch {}

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        {pending.length > 0 && (
          <span className="rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-sm font-medium text-yellow-400">
            {pending.length} pending
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle className="mb-4 h-12 w-12 text-green-400/50" />
          <p className="text-lg font-medium text-muted-foreground">All clear!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No pending approvals — the AI agent is standing by.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((action) => (
            <div key={action.id} className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  From run{' '}
                  <Link
                    href={`/runs/${action.runId}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {action.runId.slice(0, 8)}
                  </Link>
                </span>
                <span>·</span>
                <span>
                  {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                </span>
              </div>
              <RunActionCard action={action} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
