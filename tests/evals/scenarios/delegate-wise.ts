import { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'delegate-wise',
  name: 'Delegate to Wise RAH',
  description: 'Ask the system to delegate a research comparison task.',
  tools: ['delegateToWiseRAH'],
  input: {
    message: 'Delegate to wise RAH: compare SQLite vs markdown storage for PKM in 5 bullets.',
    mode: 'hard',
  },
  expect: {
    toolsCalledSoft: ['delegateToWiseRAH'],
  },
};
