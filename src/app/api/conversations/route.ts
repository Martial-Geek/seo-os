import { NextRequest, NextResponse } from 'next/server'
import { conversationService } from '@/services/conversation-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
    )

    const conversations = await conversationService.getRecentConversations(limit)

    return NextResponse.json({ conversations, total: conversations.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const runId: string | undefined = body.runId

    const conversation = await conversationService.createConversation(runId)

    return NextResponse.json(conversation, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
