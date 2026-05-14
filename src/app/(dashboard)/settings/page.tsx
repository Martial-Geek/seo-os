import db from '@/db'
import {
  agentRuns,
  proposedActions,
  memoryEntries,
  contentSnapshots,
  conversations,
  observations,
  executedActions,
  approvals,
} from '@/db/schema'
import { count } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Database, Zap, CheckCircle, XCircle } from 'lucide-react'

interface TableCount {
  name: string
  value: number
}

function IntegrationStatus({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1.5">
        {connected ? (
          <>
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-green-400">Connected</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-xs text-red-400">Not configured</span>
          </>
        )}
      </div>
    </div>
  )
}

export default async function SettingsPage() {
  const tableCounts: TableCount[] = []

  const tableConfigs = [
    { name: 'Agent Runs', table: agentRuns },
    { name: 'Observations', table: observations },
    { name: 'Proposed Actions', table: proposedActions },
    { name: 'Executed Actions', table: executedActions },
    { name: 'Approvals', table: approvals },
    { name: 'Memory Entries', table: memoryEntries },
    { name: 'Content Snapshots', table: contentSnapshots },
    { name: 'Conversations', table: conversations },
  ]

  for (const { name, table } of tableConfigs) {
    try {
      const [result] = await db.select({ value: count() }).from(table)
      tableCounts.push({ name, value: result?.value ?? 0 })
    } catch {
      tableCounts.push({ name, value: 0 })
    }
  }

  const env = {
    schedule: process.env.AGENT_RUN_CRON ?? '0 */6 * * *',
    autoApproveLow: process.env.AUTO_APPROVE_LOW_RISK === 'true',
    maxConcurrent: process.env.MAX_CONCURRENT_RUNS ?? '1',
    hasSearchConsole:
      !!(process.env.GOOGLE_SEARCH_CONSOLE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    hasAnalytics: !!(process.env.GA4_PROPERTY_ID || process.env.GA4_CREDENTIALS_JSON),
    hasSanity: !!(process.env.SANITY_PROJECT_ID && process.env.SANITY_TOKEN),
    hasDb: !!process.env.DATABASE_URL,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">System configuration and integration status</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Agent Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-yellow-400" />
              Agent Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Run Schedule (CRON)</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                {env.schedule}
              </code>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Auto-approve Low Risk</span>
              <span
                className={`text-xs font-medium ${env.autoApproveLow ? 'text-green-400' : 'text-muted-foreground'}`}
              >
                {env.autoApproveLow ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Max Concurrent Runs</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                {env.maxConcurrent}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-blue-400" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <IntegrationStatus label="Database (PostgreSQL)" connected={env.hasDb} />
            <IntegrationStatus label="Anthropic API" connected={env.hasAnthropicKey} />
            <IntegrationStatus label="Google Search Console" connected={env.hasSearchConsole} />
            <IntegrationStatus label="Google Analytics 4" connected={env.hasAnalytics} />
            <IntegrationStatus label="Sanity CMS" connected={env.hasSanity} />
          </CardContent>
        </Card>

        {/* DB Stats */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-purple-400" />
              Database Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tableCounts.map(({ name, value }) => (
                <div
                  key={name}
                  className="rounded-md border border-border bg-muted/40 px-3 py-2.5"
                >
                  <p className="text-lg font-bold tabular-nums">{value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
