import { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'query-dimensions',
  name: 'Query dimensions',
  description: 'List available dimensions and basic info.',
  tools: ['queryDimensions'],
  input: {
    message: 'List my top dimensions and briefly describe what they represent.',
  },
  expect: {
    toolsCalledSoft: ['queryDimensions'],
    responseContainsSoft: ['dimension'],
  },
};
