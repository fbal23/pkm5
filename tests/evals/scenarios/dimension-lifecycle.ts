import { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'dimension-lifecycle',
  name: 'Dimension lifecycle (create/update/lock/unlock)',
  description: 'Create a dimension, update its description, lock it, then unlock it.',
  tools: ['createDimension', 'updateDimension', 'lockDimension', 'unlockDimension'],
  input: {
    message: 'Create a dimension named "eval-dim" with description "temporary eval dimension", then update the description to "eval dimension updated", then lock it, then unlock it.',
  },
  expect: {
    toolsCalledSoft: ['createDimension', 'updateDimension', 'lockDimension', 'unlockDimension'],
    responseContainsSoft: ['eval-dim'],
  },
};
