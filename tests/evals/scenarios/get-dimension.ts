import { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'get-dimension',
  name: 'Get single dimension',
  description: 'Fetch detail for a known dimension.',
  tools: ['getDimension'],
  input: {
    message: 'Get details for the dimension "ai".',
  },
  expect: {
    toolsCalledSoft: ['getDimension'],
    responseContainsSoft: ['ai'],
  },
};
