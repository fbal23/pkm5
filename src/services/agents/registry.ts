import { getDefaultToolNamesForRole } from '@/tools/infrastructure/registry';
import { RAH_MAIN_SYSTEM_PROMPT } from '@/config/prompts/rah-main';
import { RAH_EASY_SYSTEM_PROMPT } from '@/config/prompts/rah-easy';
import { WORKFLOW_EXECUTOR_SYSTEM_PROMPT } from '@/config/prompts/workflow-executor';
import type { AgentDefinition } from './types';

/**
 * Code-first agent registry (opinionated, not database-driven)
 * Agents are defined in code and cannot be modified by users
 */
export class AgentRegistry {
  // Deterministic agent definitions baked into code
  private static readonly AGENTS: Record<string, AgentDefinition> = {
    'ra-h': {
      id: 1,
      key: 'ra-h',
      displayName: 'ra-h (hard)',
      description: 'Opinionated orchestrator agent',
      model: 'anthropic/claude-sonnet-4.5',
      role: 'orchestrator',
      systemPrompt: RAH_MAIN_SYSTEM_PROMPT,
      availableTools: getDefaultToolNamesForRole('orchestrator'),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memory: null,
      prompts: undefined
    },
    'ra-h-easy': {
      id: 4,
      key: 'ra-h-easy',
      displayName: 'ra-h (easy)',
      description: 'Fast, low-latency orchestrator',
      model: 'openai/gpt-5-mini',
      role: 'orchestrator',
      systemPrompt: RAH_EASY_SYSTEM_PROMPT,
      availableTools: getDefaultToolNamesForRole('orchestrator'),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memory: null,
      prompts: undefined
    },
    'workflow': {
      id: 3,
      key: 'workflow',
      displayName: 'workflow agent',
      description: 'Workflow executor (uses same model as easy mode)',
      model: 'openai/gpt-5-mini',
      role: 'planner',
      systemPrompt: WORKFLOW_EXECUTOR_SYSTEM_PROMPT,
      availableTools: getDefaultToolNamesForRole('planner'),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memory: null,
      prompts: undefined
    },
    // Alias for backwards compatibility
    'wise-rah': {
      id: 3,
      key: 'workflow',
      displayName: 'workflow agent',
      description: 'Workflow executor (uses same model as easy mode)',
      model: 'openai/gpt-5-mini',
      role: 'planner',
      systemPrompt: WORKFLOW_EXECUTOR_SYSTEM_PROMPT,
      availableTools: getDefaultToolNamesForRole('planner'),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memory: null,
      prompts: undefined
    }
  };

  static async getAgentByKey(key: string): Promise<AgentDefinition | null> {
    return this.AGENTS[key] || null;
  }

  static async getAgentById(id: number): Promise<AgentDefinition | null> {
    return Object.values(this.AGENTS).find(a => a.id === id) || null;
  }

  static async getEnabledAgents(): Promise<AgentDefinition[]> {
    return Object.values(this.AGENTS).filter(a => a.enabled);
  }

  static async orchestrator(): Promise<AgentDefinition> {
    return this.AGENTS['ra-h'];
  }

  static async orchestratorForMode(mode: 'easy' | 'hard' = 'easy'): Promise<AgentDefinition> {
    if (mode === 'hard') {
      return this.AGENTS['ra-h'];
    }
    return this.AGENTS['ra-h-easy'];
  }

  static async planner(): Promise<AgentDefinition> {
    return this.AGENTS['workflow'];
  }
}
