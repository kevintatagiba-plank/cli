import { ComputerTool } from './computer';
import { Action } from './types/computer';
import type { ActionParams, ToolResult } from './types/computer';

export class ToolCollection {
  private tools: Map<string, ComputerTool>;

  constructor(...tools: ComputerTool[]) {
    this.tools = new Map(tools.map(tool => [tool.name, tool]));
  }

  toParams(): ActionParams[] {
    return Array.from(this.tools.values()).map(tool => tool.toParams());
  }

  async run(name: string, toolInput: ActionParams): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    if (!Object.values(Action).includes(toolInput.action)) {
      throw new Error(`Invalid action ${toolInput.action} for tool ${name}`);
    }

    return await tool.call(toolInput);
  }
}
