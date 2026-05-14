import { NextRequest } from 'next/server'
import { conversationService } from '@/services/conversation-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const message: string = body.message

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'message field is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const stream = await conversationService.streamChat(id, message)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
