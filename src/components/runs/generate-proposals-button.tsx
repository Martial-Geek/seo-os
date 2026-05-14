'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'

type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export function GenerateProposalsButton({
  runId,
  status,
  hasObservations,
}: {
  runId: string
  status: RunStatus
  hasObservations: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!hasObservations || status === 'running') {
    return null
  }

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/runs/${runId}/proposals`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to start proposals')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Generate proposals
          </>
        )}
      </Button>
      <p className="max-w-xs text-right text-xs text-muted-foreground">
        Runs strategist on saved observations (adds insights + proposed actions).
      </p>
      {error && <p className="max-w-xs text-right text-xs text-red-400">{error}</p>}
    </div>
  )
}
