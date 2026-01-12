import { streamText, ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider';
import { AgentDelegationService } from '@/services/agents/delegation';
import { WORKFLOW_EXECUTOR_SYSTEM_PROMPT } from '@/config/prompts/workflow-executor';
import { getToolsByNames } from '@/tools/infrastructure/registry';
import { WorkflowRegistry } from '@/services/workflows/registry';
import { ChatLoggingMiddleware } from '@/services/chat/middleware';
import { calculateCost } from '@/services/analytics/pricing';
import { UsageData } from '@/types/analytics';
import { summarizeToolExecution } from '@/services/agents/toolResultUtils';
import { edgeService } from '@/services/database/edges';
import { delegationStreamBroadcaster } from '@/app/api/rah/delegations/stream/route';
import { RequestContext } from '@/services/context/requestContext';

export interface WorkflowExecutionInput {
  sessionId: string;
  task: string;
  context: string[];
  expectedOutcome?: string | null;
  traceId?: string;
  parentChatId?: number;
  workflowKey?: string;
  workflowNodeId?: number;
}

export class WorkflowExecutor {
  static async execute({ sessionId, task, context, expectedOutcome, traceId, parentChatId, workflowKey, workflowNodeId }: WorkflowExecutionInput) {
    console.log('🧙 [WorkflowExecutor] Starting execution', { sessionId, task: task.substring(0, 100) });
    try {
      const requestContext = RequestContext.get();
      const workflowApiKey =
        requestContext.apiKeys?.openai ||
        process.env.RAH_WISE_RAH_OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY;

      if (!workflowApiKey) {
        throw new Error('OPENAI_API_KEY is not set for workflow execution.');
      }

      AgentDelegationService.markInProgress(sessionId);
      console.log('✅ [WorkflowExecutor] Delegation marked in progress');

      // Get workflow definition if available
      const workflow = workflowKey ? await WorkflowRegistry.getWorkflowByKey(workflowKey) : null;
      const maxIterationsLimit = workflow?.maxIterations ?? 10;

      // Build the user prompt - just the task (which includes workflow instructions)
      const promptSections = [
        task,
        context.length ? `Context:\n- ${context.join('\n- ')}` : undefined,
        expectedOutcome ? `Expected outcome: ${expectedOutcome}` : undefined,
      ].filter(Boolean);

      const openaiProvider = createOpenAI({ apiKey: workflowApiKey });
      console.log('🔧 [WorkflowExecutor] OpenAI provider created');

      // Use workflow-specified tools if available, otherwise fall back to safe default set
      // IMPORTANT: Workflows should NEVER have access to delegateToMiniRAH - they are one-shot executors
      const workflowTools = workflow?.tools;
      const SAFE_WORKFLOW_DEFAULT_TOOLS = [
        'getNodesById', 'queryNodes', 'queryDimensionNodes', 'searchContentEmbeddings',
        'webSearch', 'updateNode', 'createEdge'
      ];
      const tools = workflowTools?.length
        ? getToolsByNames(workflowTools)
        : getToolsByNames(SAFE_WORKFLOW_DEFAULT_TOOLS);

      console.log('🛠️ [WorkflowExecutor] Tools for workflow:', Object.keys(tools));

      const toolsUsedInSession: string[] = [];
      const delegatedEdgeKeys = new Set<string>();

      // Workflow progress is now streamed directly to delegation tabs via delegationStreamBroadcaster
      const wrappedTools = Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => {
          const wrapped = {
            ...tool,
            async execute(params: any, context: any) {
              if (!toolsUsedInSession.includes(name)) {
                toolsUsedInSession.push(name);
              }
              if (name === 'delegateToMiniRAH') {
                const extractEdgeKey = () => {
                  if (!params) return null;
                  const tryFromTask = () => {
                    if (typeof params.task !== 'string') return null;
                    const matches = [...params.task.matchAll(/\[NODE:(\d+)/g)];
                    if (matches.length >= 2) {
                      const fromId = Number(matches[0][1]);
                      const toId = Number(matches[1][1]);
                      if (Number.isFinite(fromId) && Number.isFinite(toId)) {
                        return `${fromId}->${toId}`;
                      }
                    }
                    return null;
                  };

                  const tryFromContext = () => {
                    if (!Array.isArray(params.context)) return null;
                    let fromId: number | null = null;
                    let toId: number | null = null;
                    for (const entry of params.context) {
                      if (typeof entry === 'string') {
                        const fromMatch = entry.match(/from_node_id\D+(\d+)/i);
                        const toMatch = entry.match(/to_node_id\D+(\d+)/i);
                        if (fromMatch && Number.isFinite(Number(fromMatch[1]))) {
                          fromId = Number(fromMatch[1]);
                        }
                        if (toMatch && Number.isFinite(Number(toMatch[1]))) {
                          toId = Number(toMatch[1]);
                        }
                      }
                    }
                    if (Number.isFinite(fromId as number) && Number.isFinite(toId as number)) {
                      return `${fromId}->${toId}`;
                    }
                    return null;
                  };

                  return tryFromTask() || tryFromContext();
                };

                const edgeKey = extractEdgeKey();
                if (edgeKey) {
                  if (delegatedEdgeKeys.has(edgeKey)) {
                    const [from, to] = edgeKey.split('->');
                    const message = `Skipped duplicate edge delegation for nodes ${from}→${to}.`;
                    workerSummaries.push(message);
                    return message;
                  }
                  delegatedEdgeKeys.add(edgeKey);
                  const [from, to] = edgeKey.split('->').map(Number);
                  if (Number.isFinite(from) && Number.isFinite(to)) {
                    const exists = await edgeService.edgeExists(from, to);
                    if (exists) {
                      const message = `Edge ${from}→${to} already exists; delegation skipped.`;
                      workerSummaries.push(message);
                      return message;
                    }
                  }
                }
              }

              return await tool.execute(params, context);
            }
          };
          return [name, wrapped];
        })
      );

      console.log('📝 [WorkflowExecutor] Starting execution loop...');

      const messages: ModelMessage[] = [
        { role: 'system', content: WORKFLOW_EXECUTOR_SYSTEM_PROMPT },
        { role: 'user', content: promptSections.join('\n\n') }
      ];

      let finalText = '';
      const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      const maxIterations = maxIterationsLimit;

      const seenToolResults = new Map<string, { output: LanguageModelV2ToolResultOutput; summary: string }>();
      const workerSummaries: string[] = [];

      const ensureString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

      const sanitizeForBroadcast = (value: unknown) => {
        if (value === undefined) return undefined;
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (error) {
          console.warn('[WorkflowExecutor] Failed to serialize delegation payload', error);
          if (typeof value === 'string') return value;
          return undefined;
        }
      };

      const emitDelegationEvent = (payload: Record<string, unknown>) => {
        delegationStreamBroadcaster.broadcast(sessionId, payload);
      };

      const emitToolStart = (toolCallId: string, toolName: string, input: unknown) => {
        emitDelegationEvent({
          type: 'tool-input-start',
          toolCallId,
          toolName,
          input: sanitizeForBroadcast(input),
        });
      };

      const emitToolCompletion = (
        toolCallId: string,
        toolName: string,
        rawResult: unknown,
        summary: string,
        status: 'complete' | 'error' = 'complete',
        errorMessage?: string
      ) => {
        emitDelegationEvent({
          type: 'tool-output-available',
          toolCallId,
          toolName,
          result: sanitizeForBroadcast(rawResult),
          summary,
          status,
          error: errorMessage,
        });
      };

      const buildToolOutput = (toolName: string, summary: string, rawResult: any): LanguageModelV2ToolResultOutput => {
        const trimmedSummary = summary.trim();

        if (rawResult && typeof rawResult === 'object' && rawResult.success === false) {
          const message = trimmedSummary || ensureString(rawResult.error) || `${toolName} failed.`;
          return { type: 'error-text', value: message };
        }

        if (typeof rawResult === 'string') {
          const value = rawResult.trim() || trimmedSummary || `${toolName} completed.`;
          return { type: 'text', value };
        }

        if (trimmedSummary) {
          return { type: 'text', value: trimmedSummary };
        }

        return { type: 'text', value: `${toolName} completed.` };
      };

      const requestFinalSummary = async (instruction: string) => {
        messages.push({
          role: 'user',
          content: instruction,
        });

        const finalStreamResult = await streamText({
          model: openaiProvider('gpt-5-mini'),
          messages,
          tools: {},
          maxOutputTokens: 500,
        });

        // Collect the complete response
        const finalChunks: string[] = [];
        for await (const chunk of finalStreamResult.textStream) {
          finalChunks.push(chunk);
        }

        const finalResponse = {
          text: finalChunks.join(''),
          usage: await finalStreamResult.usage,
        };

        totalUsage.inputTokens += finalResponse.usage?.inputTokens || 0;
        totalUsage.outputTokens += finalResponse.usage?.outputTokens || 0;
        totalUsage.totalTokens += finalResponse.usage?.totalTokens || 0;

        return finalResponse.text ?? '';
      };

      const normaliseForSignature = (toolName: string, input: any) => {
        if (!input || typeof input !== 'object') {
          return input;
        }

        if (toolName === 'webSearch' && 'query' in input) {
          const query = ensureString(input.query).toLowerCase().replace(/\s+/g, ' ').trim();
          return { ...input, query };
        }

        if (toolName === 'searchContentEmbeddings' && 'query' in input) {
          const query = ensureString(input.query).toLowerCase().replace(/\s+/g, ' ').trim();
          return { ...input, query };
        }

        return input;
      };

      for (let i = 0; i < maxIterations; i++) {
        console.log(`🔄 [WorkflowExecutor] Iteration ${i + 1}/${maxIterations}`);

        // Touch delegation every iteration to prevent cleanup from killing it
        AgentDelegationService.touchDelegation(sessionId);

        const streamResult = await streamText({
          model: openaiProvider('gpt-5-mini'),
          messages,
          tools: wrappedTools,
        });

        // Collect the complete response
        const chunks: string[] = [];
        for await (const chunk of streamResult.textStream) {
          chunks.push(chunk);
        }

        const response = {
          text: chunks.join(''),
          finishReason: await streamResult.finishReason,
          usage: await streamResult.usage,
          toolCalls: await streamResult.toolCalls,
        };

        totalUsage.inputTokens += response.usage?.inputTokens || 0;
        totalUsage.outputTokens += response.usage?.outputTokens || 0;
        totalUsage.totalTokens += response.usage?.totalTokens || 0;

        console.log(`📊 [WorkflowExecutor] Step ${i + 1} finishReason:`, response.finishReason);

        // Stream text response to delegation chat
        if (response.text && response.text.trim()) {
          emitDelegationEvent({
            type: 'text-delta',
            delta: response.text,
          });
        }

        if (response.finishReason !== 'tool-calls') {
          finalText = response.text;
          console.log('✅ [WorkflowExecutor] Got final text');
          break;
        }

        const toolCalls = response.toolCalls || [];
        console.log(`🔧 [WorkflowExecutor] Executing ${toolCalls.length} tool calls`);

        // Broadcast new assistant message for next iteration
        if (toolCalls.length > 0) {
          emitDelegationEvent({ type: 'assistant-message' });
        }

        messages.push({
          role: 'assistant',
          content: toolCalls.map(call => ({
            type: 'tool-call' as const,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: (call as any).input ?? (call as any).args,
          })),
        });

        const toolResults: Array<{
          type: 'tool-result';
          toolCallId: string;
          toolName: string;
          output: LanguageModelV2ToolResultOutput;
        }> = [];

        for (const call of toolCalls) {
          let callInputRaw = (call as any).input ?? (call as any).args;

          const signatureInput = normaliseForSignature(call.toolName, callInputRaw);
          const signature = JSON.stringify({ tool: call.toolName, input: signatureInput });

          // Broadcast tool call to delegation stream
          emitToolStart(call.toolCallId, call.toolName, callInputRaw);

          // Skip duplicate tool calls (except think which can be called multiple times)
          if (call.toolName !== 'think' && seenToolResults.has(signature)) {
            const cached = seenToolResults.get(signature)!;
            toolResults.push({
              type: 'tool-result',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              output: cached.output,
            });

            // Broadcast cached result
            emitToolCompletion(call.toolCallId, call.toolName, cached.summary || 'Cached result', cached.summary || 'Cached result');
            continue;
          }

          const tool = wrappedTools[call.toolName];
          if (!tool) {
            const warning = `Tool ${call.toolName} is not available for this workflow.`;
            toolResults.push({
              type: 'tool-result',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              output: { type: 'error-text', value: warning },
            });
            emitToolCompletion(call.toolCallId, call.toolName, { success: false }, warning, 'error', warning);

            continue;
          }

          try {
            const rawResult = await tool.execute(callInputRaw, {});
            const summary = summarizeToolExecution(call.toolName, callInputRaw, rawResult);
            const output = buildToolOutput(call.toolName, summary, rawResult);

            toolResults.push({
              type: 'tool-result',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              output,
            });
            emitToolCompletion(call.toolCallId, call.toolName, rawResult, summary, 'complete');

            // Cache result (except think which can be called multiple times)
            if (call.toolName !== 'think') {
              seenToolResults.set(signature, { output, summary });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Tool execution failed';
            toolResults.push({
              type: 'tool-result',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              output: { type: 'error-text', value: message },
            });
            emitToolCompletion(call.toolCallId, call.toolName, { success: false }, message, 'error', message);
          }
        }

        messages.push({
          role: 'tool',
          content: toolResults,
        });
      }

      // If we hit max iterations without a final response, request one
      if (!finalText) {
        console.warn('⚠️ [WorkflowExecutor] Max iterations hit with no summary. Requesting final response without tools.');
        finalText = await requestFinalSummary('Provide a brief summary of what was accomplished. Do not call any tools.');
        console.log('✅ [WorkflowExecutor] Final summary obtained after tool cutoff.');
      }

      const usage = totalUsage;
      let summary = typeof finalText === 'string' ? finalText.trim() : '';

     if (summary.length > 2000) {
        console.log('⚠️ [WorkflowExecutor] Summary too long, requesting concise version.');
        summary = (await requestFinalSummary('Condense the findings into ≤300 tokens using the Task/Actions/Result/Nodes/Follow-up format. Focus on the most salient insights and reference key nodes. Do not call any tools.')).trim();
      }
      if (summary.length > 1000) {
        summary = `${summary.slice(0, 997)}…`;
      }
      console.log('📄 [WorkflowExecutor] Summary after trim:', summary);
      console.log('📏 [WorkflowExecutor] Summary length:', summary.length);

      if (!summary) {
        emitDelegationEvent({
          type: 'assistant-message',
        });
        emitDelegationEvent({
          type: 'text-delta',
          delta: 'Workflow executor attempted to summarise but the response was empty. Check tool logs above for context.',
        });
        throw new Error('Workflow executor returned empty summary');
      }

      console.log('[WorkflowExecutor] summary:', summary);

      // Emit final summary to the stream so it appears in the UI
      emitDelegationEvent({ type: 'assistant-message' });
      emitDelegationEvent({
        type: 'text-delta',
        delta: summary,
      });

      // Calculate cost and log to chats table
      if (usage) {
        const inputTokens = (usage as any).promptTokens || usage.inputTokens || 0;
        const outputTokens = (usage as any).completionTokens || usage.outputTokens || 0;
        const totalTokens = inputTokens + outputTokens;

        const costResult = calculateCost({
          inputTokens,
          outputTokens,
          modelId: 'gpt-5-mini',
        });

        const usageData: UsageData = {
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCostUsd: costResult.totalCostUsd,
          modelUsed: 'gpt-5-mini',
          provider: 'openai',
          toolsUsed: toolsUsedInSession.length > 0 ? toolsUsedInSession : undefined,
          toolCallsCount: toolsUsedInSession.length > 0 ? toolsUsedInSession.length : undefined,
          traceId,
          parentChatId,
          workflowKey,
          workflowNodeId,
        };

        const delegation = AgentDelegationService.getDelegation(sessionId);
        const delegationId = delegation?.id;

        await ChatLoggingMiddleware.logChatInteraction(
          task,
          summary,
          {
            helperName: 'workflow-agent',
            agentType: 'planner',
            delegationId: delegationId ?? null,
            sessionId,
            usageData,
            traceId,
            parentChatId,
            workflowKey,
            workflowNodeId,
            systemMessage: WORKFLOW_EXECUTOR_SYSTEM_PROMPT,
          },
          []
        );

        console.log(`💰 [WorkflowExecutor] Cost: $${costResult.totalCostUsd.toFixed(6)} (${totalTokens} tokens)`);
      }

      console.log('✅ [WorkflowExecutor] Completing delegation with summary');
      return AgentDelegationService.completeDelegation(sessionId, summary);
    } catch (error) {
      console.error('❌ [WorkflowExecutor] Error during execution:', error);
      console.error('❌ [WorkflowExecutor] Error stack:', error instanceof Error ? error.stack : 'No stack');
      const message = error instanceof Error ? error.message : 'Unknown delegation error';

      // Broadcast error to delegation stream
      delegationStreamBroadcaster.broadcast(sessionId, {
        type: 'assistant-message',
      });
      delegationStreamBroadcaster.broadcast(sessionId, {
        type: 'text-delta',
        delta: `Workflow executor failed: ${message}`,
      });

      AgentDelegationService.completeDelegation(sessionId, `Workflow executor failed: ${message}`, 'failed');
      throw error;
    }
  }
}
