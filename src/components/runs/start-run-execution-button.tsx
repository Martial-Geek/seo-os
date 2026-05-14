'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Play } from 'lucide-react'

type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export function StartRunExecutionButton({
  runId,
  status,
}: {
  runId: string
  status: RunStatus
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status !== 'pending' && status !== 'failed') {
    return null
  }

  const label = status === 'failed' ? 'Retry run' : 'Start execution'

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/runs/${runId}/execute`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to start execution')
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
      <Button type="button" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </>
        )}
      </Button>
      {error && <p className="max-w-xs text-right text-xs text-red-400">{error}</p>}
    </div>
  )
}
