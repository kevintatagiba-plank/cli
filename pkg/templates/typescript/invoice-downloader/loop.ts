import { Anthropic } from '@anthropic-ai/sdk';
import { DateTime } from 'luxon';
import type { Kernel } from '@onkernel/sdk';
import { ToolCollection } from './tools/collection';
import { ComputerTool } from './tools/computer';
import { Action } from './tools/types/computer';
import type { ActionParams } from './tools/types/computer';
import type { BetaMessageParam, BetaTextBlock, BetaContentBlock } from './types/beta';
import { injectPromptCaching, maybeFilterToNMostRecentImages, PROMPT_CACHING_BETA_FLAG, responseToParams } from './utils/message-processing';
import { makeApiToolResult } from './utils/tool-results';

const SYSTEM_PROMPT = `<SYSTEM_CAPABILITY>
* You are an AI assistant controlling a browser to help download invoices from a billing portal.
* You can see the screen via screenshots and interact using mouse clicks, keyboard input, and scrolling.
* CHROMIUM IS ALREADY OPEN. The url bar is not visible but it is there.
* To navigate to a URL, use ctrl+l to focus the url bar, then type the URL and press Enter.
* When viewing a page, scroll down if needed to see all content.
* The current date is ${DateTime.now().toFormat('EEEE, MMMM d, yyyy')}.
* After each action, take a screenshot to verify the result before proceeding.
</SYSTEM_CAPABILITY>

<INVOICE_DOWNLOAD_TASK>
Your task is to:
1. Navigate to the billing portal URL provided
2. Log in with the credentials provided
3. Find and navigate to the invoices section
4. Locate the specific invoice (by ID or date)
5. Download the invoice PDF
6. Report back with confirmation of the download

Be methodical - verify each step succeeded before moving to the next.
If you encounter errors or unexpected states, describe what you see and try alternative approaches.
</INVOICE_DOWNLOAD_TASK>`;

interface ToolUseInput extends Record<string, unknown> {
  action: Action;
}

export async function invoiceDownloadLoop({
  portalUrl,
  username,
  password,
  invoiceIdentifier,
  identifierType,
  apiKey,
  kernel,
  sessionId,
  maxTokens = 4096,
  thinkingBudget = 1024,
}: {
  portalUrl: string;
  username: string;
  password: string;
  invoiceIdentifier: string;
  identifierType: 'id' | 'date';
  apiKey: string;
  kernel: Kernel;
  sessionId: string;
  maxTokens?: number;
  thinkingBudget?: number;
}): Promise<{ success: boolean; message: string }> {
  
  const toolCollection = new ToolCollection(new ComputerTool(kernel, sessionId));
  
  const taskDescription = identifierType === 'id'
    ? `Download the invoice with ID "${invoiceIdentifier}"`
    : `Download the invoice from date "${invoiceIdentifier}"`;

  const userPrompt = `Please help me download an invoice from a billing portal.

Portal URL: ${portalUrl}
Username: ${username}
Password: ${password}

Task: ${taskDescription}

Steps:
1. Navigate to ${portalUrl}
2. Log in using the credentials above
3. Find the invoices section
4. Search for and select the invoice (${identifierType === 'id' ? `ID: ${invoiceIdentifier}` : `Date: ${invoiceIdentifier}`})
5. Download the invoice PDF
6. Confirm the download was successful

Start by taking a screenshot to see the current state, then navigate to the portal.`;

  const messages: BetaMessageParam[] = [{
    role: 'user',
    content: userPrompt,
  }];

  const system: BetaTextBlock = {
    type: 'text',
    text: SYSTEM_PROMPT,
  };

  const client = new Anthropic({ apiKey, maxRetries: 4 });
  const betas = ['computer-use-2025-01-24', PROMPT_CACHING_BETA_FLAG];

  while (true) {
    injectPromptCaching(messages);
    (system as BetaTextBlock).cache_control = { type: 'ephemeral' };

    const response = await client.beta.messages.create({
      max_tokens: maxTokens,
      messages,
      model: 'claude-sonnet-4-5-20250929',
      system: [system],
      tools: toolCollection.toParams(),
      betas,
      thinking: { type: 'enabled', budget_tokens: thinkingBudget },
    });

    const responseParams = responseToParams(response);

    console.log('=== LLM RESPONSE ===');
    console.log('Stop reason:', response.stop_reason);
    const loggableContent = responseParams.map(block => {
      if (block.type === 'tool_use') {
        return { type: 'tool_use', name: block.name, input: block.input };
      }
      return block;
    });
    console.log(JSON.stringify(loggableContent, null, 2));

    messages.push({ role: 'assistant', content: responseParams });

    if (response.stop_reason === 'end_turn') {
      const lastTextBlock = responseParams.find((b): b is BetaTextBlock => b.type === 'text');
      const finalMessage = lastTextBlock?.text || 'Task completed';
      
      const success = finalMessage.toLowerCase().includes('success') || 
                     finalMessage.toLowerCase().includes('downloaded') ||
                     finalMessage.toLowerCase().includes('complete');
      
      return { success, message: finalMessage };
    }

    const toolResultContent = [];

    for (const contentBlock of responseParams) {
      if (contentBlock.type === 'tool_use' && contentBlock.name && contentBlock.input) {
        const input = contentBlock.input as ToolUseInput;
        if ('action' in input && typeof input.action === 'string') {
          const toolInput: ActionParams = {
            action: input.action as Action,
            ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'action'))
          };

          try {
            const result = await toolCollection.run(contentBlock.name, toolInput);
            const toolResult = makeApiToolResult(result, contentBlock.id!);
            toolResultContent.push(toolResult);
          } catch (error) {
            console.error('Tool execution error:', error);
            throw error;
          }
        }
      }
    }

    if (toolResultContent.length > 0) {
      messages.push({ role: 'user', content: toolResultContent });
    } else if (response.stop_reason !== 'tool_use') {
      return { success: false, message: 'Loop ended without completion' };
    }
  }
}
