import { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'delegate-mini',
  name: 'Delegate to Mini RAH',
  description: 'Ask the system to delegate a short task to mini helper.',
  tools: ['delegateToMiniRAH'],
  input: {
    message: 'Delegate to mini RAH: summarize my notes on plaintext productivity in 3 bullets.',
    mode: 'hard',
  },
  expect: {
    toolsCalledSoft: ['delegateToMiniRAH'],
  },
};
