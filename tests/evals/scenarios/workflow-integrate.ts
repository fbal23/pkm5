import { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'workflow-integrate',
  name: 'Integrate workflow on focused node',
  description: 'Execute integrate workflow on a real node.',
  tools: ['executeWorkflow'],
  input: {
    message: 'Integrate this.',
    focusedNodeQuery: { titleContains: 'Markdown vs database backends for PKM' },
    mode: 'hard',
  },
  expect: {
    toolsCalledSoft: ['executeWorkflow'],
    responseContainsSoft: ['integrate', 'updated'],
  },
};
