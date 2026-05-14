import db from '@/db'
import { conversations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ConversationChat } from '@/components/conversations/conversation-chat'
import { ConversationMessage } from '@/types'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let convo: typeof conversations.$inferSelect | undefined

  try {
    const result = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1)
    convo = result[0]
  } catch {}

  if (!convo) notFound()

  const messages = Array.isArray(convo.messages)
    ? (convo.messages as ConversationMessage[])
    : []

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Link
          href="/conversations"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Conversations
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-sm text-muted-foreground">{id.slice(0, 8)}</span>
        {convo.runId && (
          <>
            <span className="text-muted-foreground">/</span>
            <Link
              href={`/runs/${convo.runId}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Run {convo.runId.slice(0, 8)}
            </Link>
          </>
        )}
      </div>
      <ConversationChat conversationId={id} initialMessages={messages} />
    </div>
  )
}
