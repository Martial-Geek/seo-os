import { toolRegistry } from './registry'
import { SearchConsoleMCPTool } from './search-console'
import { AnalyticsMCPTool } from './analytics'
import { SanityMCPTool } from './sanity'

// Register all MCP tools
toolRegistry.register(new SearchConsoleMCPTool())
toolRegistry.register(new AnalyticsMCPTool())
toolRegistry.register(new SanityMCPTool())

export { toolRegistry }
export { SearchConsoleMCPTool } from './search-console'
export { AnalyticsMCPTool } from './analytics'
export { SanityMCPTool } from './sanity'
export { ToolRegistry } from './registry'
export * from './types'
