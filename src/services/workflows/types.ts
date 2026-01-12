export interface WorkflowDefinition {
  id: number;
  key: string;
  displayName: string;
  description: string;
  instructions: string;
  enabled: boolean;
  requiresFocusedNode: boolean;
  primaryActor: 'oracle' | 'main';
  expectedOutcome?: string;
  /** Tools this workflow is allowed to use. If not specified, uses default set. */
  tools?: string[];
  /** Maximum iterations for this workflow. Defaults to 10. */
  maxIterations?: number;
}
