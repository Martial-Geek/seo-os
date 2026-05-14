import { ActionType } from '@/types'
import type { ToolContext, ToolResult, ToolHandler } from './types'
import { CreateBlogHandler } from './handlers/create-blog'
import { UpdateMetadataHandler } from './handlers/update-metadata'
import { GenerateOutlineHandler } from './handlers/generate-outline'
import { AddInternalLinksHandler } from './handlers/add-internal-links'

// Map ActionType -> ToolHandler
const handlerMap: Partial<Record<ActionType, ToolHandler<unknown>>> = {
  [ActionType.CREATE_BLOG]: new CreateBlogHandler() as ToolHandler<unknown>,
  [ActionType.UPDATE_METADATA]: new UpdateMetadataHandler() as ToolHandler<unknown>,
  [ActionType.GENERATE_OUTLINE]: new GenerateOutlineHandler() as ToolHandler<unknown>,
  [ActionType.ADD_INTERNAL_LINKS]: new AddInternalLinksHandler() as ToolHandler<unknown>,
}

export async function executeAction(
  actionType: ActionType,
  payload: unknown,
  context: ToolContext
): Promise<ToolResult> {
  const handler = handlerMap[actionType]

  if (!handler) {
    return {
      success: false,
      error: `No handler registered for action type: ${actionType}`,
    }
  }

  try {
    const validated = handler.validate(payload)
    return await handler.execute(validated, context)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[executeAction] Error executing ${actionType}:`, message)
    return { success: false, error: message }
  }
}

export { handlerMap }
export type { ToolHandler, ToolContext, ToolResult }
