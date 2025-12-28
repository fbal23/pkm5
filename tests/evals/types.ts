export type ScenarioExpectations = {
  toolsCalled?: string[];
  toolsCalledSoft?: string[];
  responseContains?: string[];
  responseContainsSoft?: string[];
  responseNotContains?: string[];
  maxLatencyMs?: number;
};

export type ScenarioInput = {
  message: string;
  focusedNodeId?: number;
  focusedNodeQuery?: {
    titleContains?: string;
    titleEquals?: string;
  };
  mode?: 'easy' | 'hard';
};

export type Scenario = {
  id: string;
  name: string;
  input: ScenarioInput;
  expect?: ScenarioExpectations;
  description?: string;
  tools?: string[];
  enabled?: boolean;
  notes?: string;
};
