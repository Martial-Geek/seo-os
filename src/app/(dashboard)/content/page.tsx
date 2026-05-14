import db from '@/db'
import { contentSnapshots } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, FileText } from 'lucide-react'
import Link from 'next/link'
import { SyncSanityButton } from '@/components/content/sync-sanity-button'

export default async function ContentPage() {
  let snapshots: (typeof contentSnapshots.$inferSelect)[] = []

  try {
    snapshots = await db
      .select()
      .from(contentSnapshots)
      .orderBy(desc(contentSnapshots.lastSyncedAt))
  } catch {}

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content</h1>
          <p className="text-sm text-muted-foreground">
            {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} synced
          </p>
        </div>
        <SyncSanityButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-4 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No content synced yet. Click "Sync from Sanity" to import content.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-4 px-2 pb-2 text-xs font-medium text-muted-foreground">
                <span className="col-span-2">Title</span>
                <span>Source</span>
                <span>Last Synced</span>
                <span>Hash</span>
              </div>
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="grid grid-cols-5 gap-4 rounded-md px-2 py-2.5 text-sm hover:bg-accent/50"
                >
                  <div className="col-span-2 min-w-0">
                    <p className="truncate font-medium" title={snap.title ?? undefined}>
                      {snap.title ?? snap.externalId}
                    </p>
                    {snap.slug && (
                      <p className="truncate text-xs text-muted-foreground">{snap.slug}</p>
                    )}
                  </div>
                  <span>
                    <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-400">
                      {snap.source}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(snap.lastSyncedAt), { addSuffix: true })}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {snap.contentHash ? snap.contentHash.slice(0, 8) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
