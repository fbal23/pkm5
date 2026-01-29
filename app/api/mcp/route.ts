/**
 * Latent Space Hub - Remote MCP Endpoint
 *
 * A stateless, read-only MCP server for Vercel serverless.
 * Exposes ls_* tools for external agents to query the knowledge graph.
 *
 * Usage:
 *   claude mcp add --transport http latent-space https://latentspace.ra-h.app/api/mcp
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import { nodeService, edgeService } from '@/services/database';
import { getSQLiteClient } from '@/services/database/sqlite-client';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 second timeout for tool calls

// Server info
const SERVER_INFO = {
  name: 'latent-space-hub',
  version: '1.0.0',
};

const INSTRUCTIONS = [
  'This is the Latent Space Knowledge Hub - a searchable graph of Latent Space content.',
  'Use ls_search_nodes to find content by keyword (newsletters, podcasts, talks, etc.).',
  'Use ls_get_nodes to load full node content by ID.',
  'Use ls_query_edges to explore connections between content.',
  'Use ls_list_dimensions to see content categories (AI News, Podcast, People, etc.).',
  'This is a read-only API - you cannot modify the knowledge graph.',
].join(' ');

/**
 * Create a fresh MCP server instance with read-only ls_* tools
 */
function createLSServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: INSTRUCTIONS,
    capabilities: { tools: {} },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ls_search_nodes - Full-text search across all content
  // ─────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'ls_search_nodes',
    {
      title: 'Search Latent Space content',
      description: 'Search the Latent Space knowledge graph by keyword. Returns matching nodes (newsletters, podcasts, talks, people, topics, etc.).',
      inputSchema: {
        query: z.string().min(1).max(400).describe('Search query (keywords)'),
        limit: z.number().min(1).max(50).optional().describe('Max results (default 20)'),
        dimensions: z.array(z.string()).max(5).optional().describe('Filter by dimensions (e.g., ["Podcast", "AI News"])'),
      },
    },
    async ({ query, limit = 20, dimensions }) => {
      const filters: any = {
        search: query.trim(),
        limit: Math.min(Math.max(limit, 1), 50),
      };

      if (dimensions && dimensions.length > 0) {
        filters.dimensions = dimensions;
      }

      const nodes = await nodeService.getNodes(filters);

      const summary = nodes.length === 0
        ? `No results found for "${query}".`
        : `Found ${nodes.length} result(s) for "${query}".`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: {
          count: nodes.length,
          nodes: nodes.map((node: any) => ({
            id: node.id,
            title: node.title,
            description: node.description ?? null,
            link: node.link ?? null,
            dimensions: node.dimensions || [],
            updated_at: node.updated_at,
          })),
        },
      };
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ls_get_nodes - Load full node content by ID
  // ─────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'ls_get_nodes',
    {
      title: 'Get Latent Space nodes by ID',
      description: 'Load full content of specific nodes by their IDs. Use this after searching to get complete details.',
      inputSchema: {
        nodeIds: z.array(z.number().int().positive()).min(1).max(10).describe('Node IDs to load (max 10)'),
      },
    },
    async ({ nodeIds }) => {
      const uniqueIds = Array.from(new Set(nodeIds.filter(id => Number.isFinite(id) && id > 0)));

      if (uniqueIds.length === 0) {
        return {
          content: [{ type: 'text', text: 'No valid node IDs provided.' }],
          structuredContent: { count: 0, nodes: [] },
        };
      }

      const nodes: any[] = [];
      for (const id of uniqueIds) {
        try {
          const node = await nodeService.getNodeById(id);
          if (node) {
            nodes.push({
              id: node.id,
              title: node.title,
              description: node.description ?? null,
              content: node.content ?? null,
              link: node.link ?? null,
              dimensions: node.dimensions || [],
              metadata: node.metadata || {},
              created_at: node.created_at,
              updated_at: node.updated_at,
            });
          }
        } catch (e) {
          // Skip missing nodes
        }
      }

      return {
        content: [{ type: 'text', text: `Loaded ${nodes.length} of ${uniqueIds.length} nodes.` }],
        structuredContent: { count: nodes.length, nodes },
      };
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ls_query_edges - Find connections between content
  // ─────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'ls_query_edges',
    {
      title: 'Query Latent Space connections',
      description: 'Find connections (edges) between nodes. Use nodeId to get all connections for a specific node.',
      inputSchema: {
        nodeId: z.number().int().positive().optional().describe('Find edges connected to this node'),
        limit: z.number().min(1).max(100).optional().describe('Max edges to return (default 50)'),
      },
    },
    async ({ nodeId, limit = 50 }) => {
      let edges: any[];

      if (nodeId) {
        // Get edges for a specific node using getNodeConnections
        const connections = await edgeService.getNodeConnections(nodeId);
        edges = connections.slice(0, limit).map(c => c.edge);
      } else {
        // Get all edges (limited)
        edges = await edgeService.getEdges();
        edges = edges.slice(0, limit);
      }

      // Parse context if it's a string (SQLite returns JSON as string)
      const parseContext = (ctx: any) => {
        if (typeof ctx === 'string') {
          try { return JSON.parse(ctx); } catch { return {}; }
        }
        return ctx || {};
      };

      return {
        content: [{ type: 'text', text: `Found ${edges.length} connection(s).` }],
        structuredContent: {
          count: edges.length,
          edges: edges.map((e: any) => {
            const ctx = parseContext(e.context);
            return {
              id: e.id,
              from_node_id: e.from_node_id,
              to_node_id: e.to_node_id,
              explanation: ctx.explanation ?? null,
              type: ctx.type ?? null,
              created_at: e.created_at,
            };
          }),
        },
      };
    }
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ls_list_dimensions - List all content categories
  // ─────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'ls_list_dimensions',
    {
      title: 'List Latent Space dimensions',
      description: 'List all content categories (dimensions) in the knowledge graph, with node counts. Dimensions include: AI News, Podcast, People, Companies, Topics, etc.',
      inputSchema: {},
    },
    async () => {
      const sqlite = getSQLiteClient();

      const result = sqlite.query(`
        WITH dimension_counts AS (
          SELECT nd.dimension, COUNT(*) AS count
          FROM node_dimensions nd
          GROUP BY nd.dimension
        )
        SELECT
          d.name AS dimension,
          d.description,
          COALESCE(dc.count, 0) AS count
        FROM dimensions d
        LEFT JOIN dimension_counts dc ON dc.dimension = d.name
        ORDER BY dc.count DESC, d.name ASC
      `);

      const dimensions = result.rows.map((row: any) => ({
        name: row.dimension,
        description: row.description ?? null,
        count: Number(row.count),
      }));

      const totalNodes = dimensions.reduce((sum, d) => sum + d.count, 0);

      return {
        content: [{ type: 'text', text: `${dimensions.length} dimensions, ${totalNodes} total nodes.` }],
        structuredContent: {
          count: dimensions.length,
          totalNodes,
          dimensions,
        },
      };
    }
  );

  return server;
}

/**
 * Handle MCP POST requests (tool calls)
 */
export async function POST(req: NextRequest) {
  try {
    // Create fresh instances for stateless serverless execution
    const server = createLSServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode - critical for serverless
    });

    await server.connect(transport);

    // Handle the request - WebStandardStreamableHTTPServerTransport accepts web Request
    const response = await transport.handleRequest(req);

    // Cleanup
    await transport.close();
    await server.close();

    return response;
  } catch (error) {
    console.error('MCP request error:', error);

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal MCP error',
        },
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

/**
 * Handle preflight CORS requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
    },
  });
}

/**
 * GET returns server info (not required for MCP, but useful for debugging)
 */
export async function GET() {
  return NextResponse.json(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      description: 'Latent Space Knowledge Hub - Read-only MCP server',
      tools: ['ls_search_nodes', 'ls_get_nodes', 'ls_query_edges', 'ls_list_dimensions'],
      usage: 'claude mcp add --transport http latent-space https://latentspace.ra-h.app/api/mcp',
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
