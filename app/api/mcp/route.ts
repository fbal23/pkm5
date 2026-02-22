/**
 * PKM5 Remote MCP Endpoint
 *
 * A stateless MCP server for Vercel/serverless deployments.
 * Exposes pkm5_* tools for external agents to query (and optionally modify) the knowledge graph.
 *
 * Environment variables:
 *   MCP_ALLOW_WRITES=true  - Enable write tools (add_node, create_edge, etc.)
 *
 * Usage:
 *   claude mcp add --transport http my-pkm5 https://my-deployment.vercel.app/api/mcp
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import { nodeService, edgeService } from '@/services/database';
import { getSQLiteClient } from '@/services/database/sqlite-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOW_WRITES = process.env.MCP_ALLOW_WRITES === 'true';

const SERVER_INFO = {
  name: 'pkm5-mcp',
  version: '1.0.0',
};

function buildInstructions(): string {
  const lines = [
    'PKM5 Knowledge Graph - a local-first research workspace.',
    'Use pkm5_search_nodes to find content by keyword.',
    'Use pkm5_get_nodes to load full node content by ID.',
    'Use pkm5_query_edges to explore connections between nodes.',
    'Use pkm5_list_dimensions to see content categories.',
  ];

  if (ALLOW_WRITES) {
    lines.push('Write operations are enabled. Use pkm5_add_node to create new nodes.');
  } else {
    lines.push('This is a read-only endpoint.');
  }

  return lines.join(' ');
}

/**
 * Create a fresh MCP server instance with pkm5_* tools
 */
function createPKM5Server(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: buildInstructions(),
    capabilities: { tools: {} },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // READ TOOLS (always enabled)
  // ─────────────────────────────────────────────────────────────────────────────

  // pkm5_search_nodes - Full-text search
  server.registerTool(
    'pkm5_search_nodes',
    {
      title: 'Search PKM5 nodes',
      description: 'Search the knowledge graph by keyword. Returns matching nodes with title, description, dimensions.',
      inputSchema: {
        query: z.string().min(1).max(400).describe('Search query (keywords)'),
        limit: z.number().min(1).max(50).optional().describe('Max results (default 20)'),
        dimensions: z.array(z.string()).max(5).optional().describe('Filter by dimensions'),
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

  // pkm5_get_nodes - Load full node content by ID
  server.registerTool(
    'pkm5_get_nodes',
    {
      title: 'Get PKM5 nodes by ID',
      description: 'Load full content of specific nodes by their IDs.',
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
              notes: node.notes ?? null,
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

  // pkm5_query_edges - Find connections
  server.registerTool(
    'pkm5_query_edges',
    {
      title: 'Query PKM5 edges',
      description: 'Find connections (edges) between nodes. Use nodeId to get all connections for a specific node.',
      inputSchema: {
        nodeId: z.number().int().positive().optional().describe('Find edges connected to this node'),
        limit: z.number().min(1).max(100).optional().describe('Max edges to return (default 50)'),
      },
    },
    async ({ nodeId, limit = 50 }) => {
      let edges: any[];

      if (nodeId) {
        const connections = await edgeService.getNodeConnections(nodeId);
        edges = connections.slice(0, limit).map(c => c.edge);
      } else {
        edges = await edgeService.getEdges();
        edges = edges.slice(0, limit);
      }

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

  // pkm5_list_dimensions - List all dimensions
  server.registerTool(
    'pkm5_list_dimensions',
    {
      title: 'List PKM5 dimensions',
      description: 'List all dimensions (categories/tags) in the knowledge graph with node counts.',
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
          d.is_priority AS isPriority,
          COALESCE(dc.count, 0) AS count
        FROM dimensions d
        LEFT JOIN dimension_counts dc ON dc.dimension = d.name
        ORDER BY dc.count DESC, d.name ASC
      `);

      const dimensions = result.rows.map((row: any) => ({
        name: row.dimension,
        description: row.description ?? null,
        isPriority: Boolean(row.isPriority),
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

  // ─────────────────────────────────────────────────────────────────────────────
  // WRITE TOOLS (only when MCP_ALLOW_WRITES=true)
  // ─────────────────────────────────────────────────────────────────────────────

  if (ALLOW_WRITES) {
    // pkm5_add_node
    server.registerTool(
      'pkm5_add_node',
      {
        title: 'Add PKM5 node',
        description: 'Create a new node in the knowledge graph.',
        inputSchema: {
          title: z.string().min(1).max(160).describe('Node title'),
          content: z.string().max(20000).optional().describe('Node content/notes'),
          link: z.string().url().optional().describe('Source URL'),
          description: z.string().max(2000).optional().describe('Short description'),
          dimensions: z.array(z.string()).min(1).max(5).describe('Categories/tags (at least 1)'),
          metadata: z.record(z.any()).optional().describe('Additional metadata'),
        },
      },
      async ({ title, content, link, description, dimensions, metadata }) => {
        // Call the nodes API internally
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            content: content?.trim(),
            link: link?.trim(),
            description: description?.trim(),
            dimensions,
            metadata: metadata || {},
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to create node');
        }

        const node = result.data;
        return {
          content: [{ type: 'text', text: `Created node #${node.id}: ${node.title}` }],
          structuredContent: {
            success: true,
            nodeId: node.id,
            title: node.title,
            dimensions: node.dimensions || dimensions,
          },
        };
      }
    );

    // pkm5_update_node
    server.registerTool(
      'pkm5_update_node',
      {
        title: 'Update PKM5 node',
        description: 'Update an existing node. Content is APPENDED, dimensions are replaced.',
        inputSchema: {
          id: z.number().int().positive().describe('Node ID to update'),
          updates: z.object({
            title: z.string().optional().describe('New title'),
            content: z.string().optional().describe('Content to APPEND'),
            link: z.string().optional().describe('New link'),
            dimensions: z.array(z.string()).optional().describe('New dimensions (replaces existing)'),
          }).describe('Fields to update'),
        },
      },
      async ({ id, updates }) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/nodes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const result = await response.json();
        if (!result.success && !result.node) {
          throw new Error(result.error || 'Failed to update node');
        }

        return {
          content: [{ type: 'text', text: `Updated node #${id}` }],
          structuredContent: { success: true, nodeId: id },
        };
      }
    );

    // pkm5_create_edge
    server.registerTool(
      'pkm5_create_edge',
      {
        title: 'Create PKM5 edge',
        description: 'Create a connection between two nodes.',
        inputSchema: {
          fromNodeId: z.number().int().positive().describe('Source node ID'),
          toNodeId: z.number().int().positive().describe('Target node ID'),
          explanation: z.string().min(1).describe('Why does this connection exist?'),
        },
      },
      async ({ fromNodeId, toNodeId, explanation }) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/edges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_node_id: fromNodeId,
            to_node_id: toNodeId,
            explanation: explanation.trim(),
            source: 'helper_name',
            created_via: 'mcp',
          }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to create edge');
        }

        const edge = result.data;
        return {
          content: [{ type: 'text', text: `Created edge from #${fromNodeId} to #${toNodeId}` }],
          structuredContent: { success: true, edgeId: edge?.id },
        };
      }
    );

    // pkm5_update_edge
    server.registerTool(
      'pkm5_update_edge',
      {
        title: 'Update PKM5 edge',
        description: 'Update an existing edge explanation.',
        inputSchema: {
          id: z.number().int().positive().describe('Edge ID to update'),
          explanation: z.string().min(1).describe('New explanation'),
        },
      },
      async ({ id, explanation }) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/edges/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: { explanation: explanation.trim(), created_via: 'mcp' },
          }),
        });

        const result = await response.json();
        if (!result.success && !result.edge) {
          throw new Error(result.error || 'Failed to update edge');
        }

        return {
          content: [{ type: 'text', text: `Updated edge #${id}` }],
          structuredContent: { success: true, edgeId: id },
        };
      }
    );

    // pkm5_create_dimension
    server.registerTool(
      'pkm5_create_dimension',
      {
        title: 'Create PKM5 dimension',
        description: 'Create a new dimension (category/tag) for organizing nodes.',
        inputSchema: {
          name: z.string().min(1).describe('Dimension name'),
          description: z.string().max(500).optional().describe('Description'),
          isPriority: z.boolean().optional().describe('Lock for auto-assignment'),
        },
      },
      async ({ name, description, isPriority }) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/dimensions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, isPriority }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to create dimension');
        }

        return {
          content: [{ type: 'text', text: `Created dimension: ${name}` }],
          structuredContent: { success: true, dimension: name },
        };
      }
    );

    // pkm5_update_dimension
    server.registerTool(
      'pkm5_update_dimension',
      {
        title: 'Update PKM5 dimension',
        description: 'Update dimension properties (rename, description, priority).',
        inputSchema: {
          name: z.string().min(1).describe('Current dimension name'),
          newName: z.string().optional().describe('New name (for renaming)'),
          description: z.string().max(500).optional().describe('New description'),
          isPriority: z.boolean().optional().describe('Lock/unlock dimension'),
        },
      },
      async ({ name, newName, description, isPriority }) => {
        const payload: any = {};
        if (newName) {
          payload.currentName = name;
          payload.newName = newName;
        } else {
          payload.name = name;
        }
        if (description !== undefined) payload.description = description;
        if (isPriority !== undefined) payload.isPriority = isPriority;

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/dimensions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to update dimension');
        }

        return {
          content: [{ type: 'text', text: `Updated dimension: ${newName || name}` }],
          structuredContent: { success: true, dimension: newName || name },
        };
      }
    );

    // pkm5_delete_dimension
    server.registerTool(
      'pkm5_delete_dimension',
      {
        title: 'Delete PKM5 dimension',
        description: 'Delete a dimension and remove it from all nodes.',
        inputSchema: {
          name: z.string().min(1).describe('Dimension name to delete'),
        },
      },
      async ({ name }) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/dimensions?name=${encodeURIComponent(name)}`, {
          method: 'DELETE',
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete dimension');
        }

        return {
          content: [{ type: 'text', text: `Deleted dimension: ${name}` }],
          structuredContent: { success: true, dimension: name },
        };
      }
    );
  }

  return server;
}

/**
 * Handle MCP POST requests (tool calls)
 */
export async function POST(req: NextRequest) {
  try {
    const server = createPKM5Server();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(req);

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
 * GET returns server info
 */
export async function GET() {
  const tools = ['pkm5_search_nodes', 'pkm5_get_nodes', 'pkm5_query_edges', 'pkm5_list_dimensions'];

  if (ALLOW_WRITES) {
    tools.push(
      'pkm5_add_node', 'pkm5_update_node',
      'pkm5_create_edge', 'pkm5_update_edge',
      'pkm5_create_dimension', 'pkm5_update_dimension', 'pkm5_delete_dimension'
    );
  }

  return NextResponse.json(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      description: 'PKM5 Knowledge Graph - Remote MCP Server',
      writesEnabled: ALLOW_WRITES,
      tools,
      usage: 'claude mcp add --transport http my-pkm5 https://your-deployment.vercel.app/api/mcp',
    },
    {
      headers: { 'Access-Control-Allow-Origin': '*' },
    }
  );
}
