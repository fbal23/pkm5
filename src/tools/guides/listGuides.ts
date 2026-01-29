import { tool } from 'ai';
import { z } from 'zod';
import { listGuides } from '@/services/guides/guideService';

export const listGuidesTool = tool({
  description: 'List all available guides with their names and descriptions.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const guides = listGuides();
      return {
        success: true,
        data: guides,
        message: `Found ${guides.length} guides`,
      };
    } catch (error) {
      console.error('[listGuides] error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list guides',
        data: [],
      };
    }
  },
});
