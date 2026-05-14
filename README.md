# SEO OS — AI Content Operations System

An AI-powered SEO and content operations platform. Analyzes site SEO data, generates strategic recommendations, proposes typed executable operations, and supports human-in-the-loop approval workflows.

## Stack

- **Next.js 16** App Router + React Server Components
- **LangGraph JS** — multi-node agent graph
- **Anthropic Claude Sonnet** — reasoning, planning, content generation
- **PostgreSQL + Drizzle ORM** — persistent memory and action history
- **Tailwind v4 + shadcn/ui** — modern dark dashboard

## Quick Start

### 1. Install

```bash
pnpm install
```

### 2. Environment

```bash
cp .env.example .env.local
# Fill in DATABASE_URL and ANTHROPIC_API_KEY at minimum
```

### 3. Database

```bash
createdb seo_os
pnpm db:push
pnpm db:seed
```

### 4. Run

```bash
pnpm dev
# Open http://localhost:3000
```

## Project Structure

```
src/
├── agents/graphs/       # LangGraph StateGraph
├── agents/nodes/        # collector, memory, analysis, strategist, planner, approval, execution, logging
├── app/(dashboard)/     # Dashboard pages (RSC)
├── app/actions/         # Server Actions
├── app/api/             # API routes
├── components/          # UI components
├── db/                  # Drizzle schema + seed
├── lib/mcp/             # Search Console, Analytics, Sanity integrations
├── lib/memory/          # Long-term memory service
├── lib/tools/           # Execution handlers per ActionType
├── services/            # AgentService, ConversationService
└── types/               # TypeScript types + Zod schemas
```

## Agent Graph

```
collector → memory → analysis → [strategist → planner → approval → execution] → logging
```

Conditional routing: skips execution if no opportunities found or no actions approved.

## Executable Operations

All require Zod-validated payloads. High-risk actions require explicit approval.

| Action | Risk |
|--------|------|
| CREATE_BLOG | Low |
| UPDATE_METADATA | Low |
| ADD_INTERNAL_LINKS | Low |
| GENERATE_OUTLINE | Low |
| UPDATE_BLOG | Medium |
| CREATE_TOPIC_CLUSTER | Medium |
| MERGE_CONTENT | High |
| DELETE_CONTENT | High |

## MCP Integrations

All fall back to mock data if env vars not set:

- **Search Console**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `SEARCH_CONSOLE_SITE_URL`
- **Analytics**: `GA_PROPERTY_ID`, `GA_CREDENTIALS_JSON`
- **Sanity**: `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_TOKEN`

### Google OAuth scopes (refresh token)

`GOOGLE_REFRESH_TOKEN` is issued for the scopes you requested at consent time. If Search Console returns **403 insufficient authentication scopes**, the token does not include Search Console.

- **Search Console (this app)**: `https://www.googleapis.com/auth/webmasters.readonly`
- **Google Analytics Data API** (if you use the same refresh token for Analytics): `https://www.googleapis.com/auth/analytics.readonly`

Re-run your OAuth flow (e.g. OAuth 2.0 Playground or a small script) with the full scope list you need, then replace `GOOGLE_REFRESH_TOKEN` in `.env`. Tokens only carry scopes granted during authorization; adding a scope in Google Cloud Console alone is not enough.

## Commands

```bash
pnpm dev           # Dev server
pnpm build         # Production build
pnpm db:push       # Push schema to DB
pnpm db:seed       # Seed sample data
pnpm db:studio     # Drizzle Studio
pnpm type-check    # TypeScript check
```

## Scheduling

```bash
# Every 2 days — call with cron secret
curl -X GET https://yourapp.com/api/cron/run -H "x-cron-secret: $CRON_SECRET"
```
