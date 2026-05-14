'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProposedAction } from '@/db/schema'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type RiskLevel = 'low' | 'medium' | 'high'
type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'skipped'

function riskBadge(level: RiskLevel) {
  const classes: Record<RiskLevel, string> = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[level] ?? classes.medium}`}
    >
      {level} risk
    </span>
  )
}

function statusBadge(status: ActionStatus) {
  const classes: Record<ActionStatus, string> = {
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    executed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    skipped: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[status] ?? classes.pending}`}
    >
      {status}
    </span>
  )
}

interface Props {
  action: ProposedAction
}

export function RunActionCard({ action }: Props) {
  const [status, setStatus] = useState<ActionStatus>(action.status as ActionStatus)
  const [expanded, setExpanded] = useState(false)
  const [payloadExpanded, setPayloadExpanded] = useState(false)
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setLoading('approve')
    setError(null)
    try {
      const res = await fetch(`/api/actions/${action.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decidedBy: 'admin' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to approve')
      }
      setStatus('approved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    setLoading('reject')
    setError(null)
    try {
      const res = await fetch(`/api/actions/${action.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decidedBy: 'admin', notes: 'Rejected via dashboard' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to reject')
      }
      setStatus('rejected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  const reasoning = action.reasoning ?? ''
  const isLongReasoning = reasoning.length > 200

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
            {action.actionType}
          </code>
          {riskBadge(action.riskLevel as RiskLevel)}
          {statusBadge(status)}
        </div>

        {/* Reasoning */}
        {reasoning && (
          <div className="text-sm text-muted-foreground">
            {isLongReasoning && !expanded ? (
              <>
                <span>{reasoning.slice(0, 200)}… </span>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setExpanded(true)}
                >
                  Read more
                </button>
              </>
            ) : (
              <>
                <span>{reasoning}</span>
                {isLongReasoning && (
                  <button
                    className="ml-1 text-xs text-primary hover:underline"
                    onClick={() => setExpanded(false)}
                  >
                    Show less
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Payload toggle */}
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setPayloadExpanded((v) => !v)}
        >
          {payloadExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {payloadExpanded ? 'Hide' : 'Show'} payload
        </button>

        {payloadExpanded && (
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(action.payload, null, 2)}
          </pre>
        )}

        {/* Error */}
        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {/* Actions */}
        {status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
              onClick={handleApprove}
              disabled={loading !== null}
            >
              {loading === 'approve' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={handleReject}
              disabled={loading !== null}
            >
              {loading === 'reject' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
