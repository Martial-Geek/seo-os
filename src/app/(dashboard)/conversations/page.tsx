import db from '@/db'
import { conversations } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewConversationButton } from '@/components/conversations/new-conversation-button'
import { MessageSquare } from 'lucide-react'
import { ConversationMessage } from '@/types'

export default async function ConversationsPage() {
  let convos: (typeof conversations.$inferSelect)[] = []

  try {
    convos = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
  } catch {}

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-sm text-muted-foreground">
            {convos.length} conversation{convos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <NewConversationButton />
      </div>

      {convos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium text-muted-foreground">No conversations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a conversation to chat with the AI agent.
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="grid grid-cols-4 gap-4 px-2 pb-2 text-xs font-medium text-muted-foreground">
              <span>ID</span>
              <span>Messages</span>
              <span>Linked Run</span>
              <span>Updated</span>
            </div>
            {convos.map((convo) => {
              const msgs = Array.isArray(convo.messages)
                ? (convo.messages as ConversationMessage[])
                : []
              return (
                <Link
                  key={convo.id}
                  href={`/conversations/${convo.id}`}
                  className="grid grid-cols-4 gap-4 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {convo.id.slice(0, 8)}…
                  </span>
                  <span className="text-muted-foreground">{msgs.length}</span>
                  <span className="text-muted-foreground">
                    {convo.runId ? (
                      <span className="font-mono text-xs">{convo.runId.slice(0, 8)}</span>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(convo.updatedAt), { addSuffix: true })}
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
