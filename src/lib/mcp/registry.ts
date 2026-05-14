import type { MCPTool } from './types'

export class ToolRegistry {
  private readonly tools: Map<string, MCPTool<unknown, unknown>> = new Map()

  register(tool: MCPTool<unknown, unknown>): void {
    this.tools.set(tool.name, tool)
  }

  get<T extends MCPTool<unknown, unknown>>(name: string): T {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool "${name}" not found in registry`)
    }
    return tool as T
  }

  getAll(): MCPTool<unknown, unknown>[] {
    return Array.from(this.tools.values())
  }

  async execute<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
    const tool = this.get<MCPTool<TInput, TOutput>>(name)
    const validated = tool.inputSchema.parse(input)
    return tool.execute(validated)
  }
}

export const toolRegistry = new ToolRegistry()
