import { tool } from 'ai';
import { z } from 'zod';
import { readGuide } from '@/services/guides/guideService';

export const readGuideTool = tool({
  description: 'Read a guide by name. Returns the full markdown content with instructions.',
  inputSchema: z.object({
    name: z.string().describe('The name of the guide to read'),
  }),
  execute: async ({ name }) => {
    try {
      const guide = readGuide(name);
      if (!guide) {
        return {
          success: false,
          error: `Guide "${name}" not found`,
          data: null,
        };
      }
      return {
        success: true,
        data: guide,
        message: `Loaded guide: ${guide.name}`,
      };
    } catch (error) {
      console.error('[readGuide] error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read guide',
        data: null,
      };
    }
  },
});
