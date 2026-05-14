import Anthropic from '@anthropic-ai/sdk'
import db from '@/db'
import { conversations } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { ConversationMessage } from '@/types'
import { sql } from 'drizzle-orm'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationRecord {
  id: string
  runId: string | null
  messages: ConversationMessage[]
  createdAt: Date
  updatedAt: Date
}

interface ConversationSummary {
  id: string
  runId: string | null
  messageCount: number
  createdAt: Date
}

// ─── Service ──────────────────────────────────────────────────────────────────

const SEO_SYSTEM_PROMPT = `You are an expert SEO strategist and content operations specialist with deep knowledge of:
- Technical SEO (Core Web Vitals, structured data, crawlability)
- Content strategy (topic clusters, pillar pages, internal linking)
- Keyword research and search intent analysis
- Content performance analysis and optimization
- On-page and off-page SEO best practices
- Google Search Console and Analytics interpretation

You help users understand their SEO data, review proposed content actions, and develop strategic recommendations.
When reviewing agent-proposed actions, critically assess their impact and alignment with SEO best practices.
Be concise, data-driven, and actionable in your responses.`

class ConversationService {
  private anthropic: Anthropic

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  /**
   * Creates a new conversation, optionally linked to an agent run.
   */
  async createConversation(runId?: string): Promise<ConversationRecord> {
    const [record] = await db
      .insert(conversations)
      .values({
        runId: runId ?? null,
        messages: sql`'[]'::jsonb`,
      })
      .returning()

    return {
      id: record.id,
      runId: record.runId ?? null,
      messages: [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  /**
   * Fetches a conversation by ID.
   */
  async getConversation(
    id: string
  ): Promise<{ id: string; messages: ConversationMessage[]; runId: string | null } | null> {
    const record = await db.query.conversations.findFirst({
      where: eq(conversations.id, id),
    })

    if (!record) return null

    const messages = Array.isArray(record.messages)
      ? (record.messages as ConversationMessage[])
      : []

    return {
      id: record.id,
      runId: record.runId ?? null,
      messages,
    }
  }

  /**
   * Appends a new message to an existing conversation.
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const record = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    })

    if (!record) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }

    const existingMessages: ConversationMessage[] = Array.isArray(record.messages)
      ? (record.messages as ConversationMessage[])
      : []

    const newMessage: ConversationMessage = {
      role,
      content,
      timestamp: new Date(),
    }

    const updatedMessages = [...existingMessages, newMessage]

    await db
      .update(conversations)
      .set({
        messages: JSON.stringify(updatedMessages) as unknown as typeof conversations.$inferSelect.messages,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
  }

  /**
   * Streams a chat response from Claude and persists both the user message
   * and assistant response to the database.
   */
  async streamChat(
    conversationId: string,
    userMessage: string
  ): Promise<ReadableStream<Uint8Array>> {
    // Persist the user message first
    await this.addMessage(conversationId, 'user', userMessage)

    // Fetch updated conversation history
    const conversation = await this.getConversation(conversationId)
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }

    // Build Anthropic message history (exclude the message we just added, will be sent separately)
    const historyMessages = conversation.messages.slice(0, -1)
    const anthropicMessages: Anthropic.Messages.MessageParam[] = [
      ...historyMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    const anthropic = this.anthropic
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = ''

        try {
          const anthropicStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: SEO_SYSTEM_PROMPT,
            messages: anthropicMessages,
          })

          for await (const chunk of anthropicStream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text))
              fullText += chunk.delta.text
            }
          }

          // Persist the assistant response
          await self.addMessage(conversationId, 'assistant', fullText)
        } catch (err) {
          controller.error(err)
          return
        }

        controller.close()
      },
    })

    return stream
  }

  /**
   * Returns a list of recent conversations with message counts.
   */
  async getRecentConversations(limit = 20): Promise<ConversationSummary[]> {
    const records = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(limit)

    return records.map((record) => {
      const messages = Array.isArray(record.messages)
        ? (record.messages as ConversationMessage[])
        : []

      return {
        id: record.id,
        runId: record.runId ?? null,
        messageCount: messages.length,
        createdAt: record.createdAt,
      }
    })
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const conversationService = new ConversationService()
export default conversationService
