import { tool } from 'ai';
import { z } from 'zod';
import { writeGuide } from '@/services/guides/guideService';
import { eventBroadcaster } from '@/services/events';

export const writeGuideTool = tool({
  description: 'Write or update a guide. Content should be full markdown with YAML frontmatter (name, description).',
  inputSchema: z.object({
    name: z.string().describe('The name of the guide to write'),
    content: z.string().describe('Full markdown content including YAML frontmatter'),
  }),
  execute: async ({ name, content }) => {
    try {
      writeGuide(name, content);
      eventBroadcaster.broadcast({ type: 'GUIDE_UPDATED', data: { name } });
      return {
        success: true,
        data: { name },
        message: `Guide "${name}" saved`,
      };
    } catch (error) {
      console.error('[writeGuide] error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write guide',
        data: null,
      };
    }
  },
});
