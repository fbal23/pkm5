import { tool } from 'ai';
import { z } from 'zod';
import { WorkflowExecutor } from '@/services/agents/workflowExecutor';
import { RequestContext } from '@/services/context/requestContext';

export const delegateToWiseRAHTool = tool({
  description: 'Delegate complex workflows to workflow executor',
  inputSchema: z.object({
    task: z.string().describe('Complex workflow description: what needs to be planned and executed'),
    context: z.array(z.string()).max(8).default([]).describe('Optional context: node IDs, URLs, or key information the planner needs'),
    expectedOutcome: z.string().optional().describe('Optional: what final result or format you expect in the summary'),
    workflowKey: z.string().optional().describe('Optional: workflow key if invoked via executeWorkflow'),
    workflowNodeId: z.number().optional().describe('Optional: target node ID for workflow'),
  }),
  execute: async ({ task, context = [], expectedOutcome, workflowKey, workflowNodeId }) => {
    const requestContext = RequestContext.get();
    console.log('[delegateToWiseRAH] Current traceId:', requestContext.traceId);

    const sessionId = `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const execution = await WorkflowExecutor.execute({
      sessionId,
      task,
      context,
      expectedOutcome,
      traceId: requestContext.traceId,
      parentChatId: requestContext.parentChatId,
      workflowKey,
      workflowNodeId,
    });

    // Return a simple string that Claude can directly use in conversation
    const summary = execution?.summary || 'Workflow completed but no summary returned.';
    return `Workflow (session ${sessionId.split('_').pop()}) completed:\n\n${summary}`;
  },
});
