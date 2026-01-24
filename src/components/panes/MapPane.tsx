"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from 'react';
import type { Edge, Node as DbNode } from '@/types/database';
import PaneHeader from './PaneHeader';
import type { MapPaneProps } from './types';
import { ChevronDown } from 'lucide-react';

interface GraphNode extends DbNode {
  edge_count?: number;
  x: number;
  y: number;
  radius: number;
  isExpanded?: boolean; // Node was dynamically loaded as a connection
}

interface DimensionInfo {
  dimension: string;
  count: number;
  isPriority: boolean;
  description: string | null;
}

const NODE_LIMIT = 200;
const LABEL_THRESHOLD = 15;

export default function MapPane({
  slot,
  isActive,
  onPaneAction,
  onCollapse,
  onSwapPanes,
  onNodeClick,
  activeTabId,
}: MapPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [baseNodes, setBaseNodes] = useState<DbNode[]>([]); // Nodes from dimension filter
  const [expandedNodes, setExpandedNodes] = useState<DbNode[]>([]); // Connected nodes loaded dynamically
  const [edges, setEdges] = useState<Edge[]>([]);
  const [lockedDimensions, setLockedDimensions] = useState<DimensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DbNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  // Dimension filter state
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [dimensionDropdownOpen, setDimensionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Combine base nodes + expanded nodes
  const allNodes = useMemo(() => {
    const baseNodeIds = new Set(baseNodes.map(n => n.id));
    // Add expanded nodes that aren't already in base nodes
    const uniqueExpanded = expandedNodes.filter(n => !baseNodeIds.has(n.id));
    return [...baseNodes, ...uniqueExpanded];
  }, [baseNodes, expandedNodes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as HTMLElement)) {
        setDimensionDropdownOpen(false);
      }
    };

    if (dimensionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dimensionDropdownOpen]);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry?.contentRect) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Fetch base data (dimension-filtered nodes)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Build nodes URL with optional dimension filter
        const nodesUrl = selectedDimension
          ? `/api/nodes?limit=${NODE_LIMIT}&sortBy=edges&dimensions=${encodeURIComponent(selectedDimension)}`
          : `/api/nodes?limit=${NODE_LIMIT}&sortBy=edges`;

        const [nodesRes, edgesRes, dimsRes] = await Promise.all([
          fetch(nodesUrl),
          fetch('/api/edges'),
          fetch('/api/dimensions/popular'),
        ]);

        if (!nodesRes.ok || !edgesRes.ok) {
          throw new Error('Failed to load data');
        }

        const nodesPayload = await nodesRes.json();
        const edgesPayload = await edgesRes.json();

        setBaseNodes(nodesPayload.data || []);
        setEdges(edgesPayload.data || []);
        setExpandedNodes([]); // Clear expanded nodes when filter changes
        setSelectedNode(null); // Clear selection when filter changes

        // Get locked (priority) dimensions
        if (dimsRes.ok) {
          const dimsPayload = await dimsRes.json();
          if (dimsPayload.success && dimsPayload.data) {
            const locked = (dimsPayload.data as DimensionInfo[])
              .filter((d) => d.isPriority);
            setLockedDimensions(locked);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDimension]);

  // Fetch edges and connected nodes when a node is selected
  const fetchConnectedNodes = useCallback(async (nodeId: number) => {
    try {
      // First, fetch edges for this specific node (in case we don't have them)
      const edgesRes = await fetch(`/api/nodes/${nodeId}/edges`);
      let nodeEdges: Edge[] = [];

      if (edgesRes.ok) {
        const edgesData = await edgesRes.json();
        nodeEdges = edgesData.data || [];

        // Add new edges to our edges state
        if (nodeEdges.length > 0) {
          setEdges(prev => {
            const existingEdgeIds = new Set(prev.map(e => e.id));
            const newEdges = nodeEdges.filter(e => !existingEdgeIds.has(e.id));
            if (newEdges.length > 0) {
              return [...prev, ...newEdges];
            }
            return prev;
          });
        }
      }

      // Get connected node IDs from both existing edges and newly fetched edges
      const connectedIds = new Set<number>();

      // From existing edges
      edges.forEach(edge => {
        if (edge.from_node_id === nodeId) connectedIds.add(edge.to_node_id);
        if (edge.to_node_id === nodeId) connectedIds.add(edge.from_node_id);
      });

      // From newly fetched edges
      nodeEdges.forEach(edge => {
        if (edge.from_node_id === nodeId) connectedIds.add(edge.to_node_id);
        if (edge.to_node_id === nodeId) connectedIds.add(edge.from_node_id);
      });

      // Find which connected nodes we don't have yet
      const existingIds = new Set(allNodes.map(n => n.id));
      const missingIds = Array.from(connectedIds).filter(id => !existingIds.has(id));

      if (missingIds.length === 0) return;

      // Fetch missing nodes
      const fetchPromises = missingIds.slice(0, 50).map(async (id) => { // Limit to 50 to prevent overload
        try {
          const res = await fetch(`/api/nodes/${id}`);
          if (res.ok) {
            const data = await res.json();
            return data.node as DbNode;
          }
        } catch {
          // Ignore individual fetch errors
        }
        return null;
      });

      const fetchedNodes = (await Promise.all(fetchPromises)).filter((n): n is DbNode => n !== null);

      if (fetchedNodes.length > 0) {
        setExpandedNodes(prev => {
          const existingExpandedIds = new Set(prev.map(n => n.id));
          const newNodes = fetchedNodes.filter(n => !existingExpandedIds.has(n.id));
          return [...prev, ...newNodes];
        });
      }
    } catch (err) {
      console.error('Failed to fetch connected nodes:', err);
    }
  }, [edges, allNodes]);

  // When selection changes, fetch connected nodes
  useEffect(() => {
    if (selectedNode) {
      fetchConnectedNodes(selectedNode.id);
    }
  }, [selectedNode, fetchConnectedNodes]);

  // Sync with focused node from other panes (focused node awareness)
  useEffect(() => {
    if (!activeTabId) return;

    // Check if this node is already in our nodes
    const existingNode = allNodes.find(n => n.id === activeTabId);

    if (existingNode) {
      // Node is visible, just select it
      setSelectedNode(existingNode);
    } else {
      // Node not in current view - fetch it and add as expanded
      const fetchFocusedNode = async () => {
        try {
          const res = await fetch(`/api/nodes/${activeTabId}`);
          if (res.ok) {
            const data = await res.json();
            const node = data.node as DbNode;
            if (node) {
              // Add to expanded nodes
              setExpandedNodes(prev => {
                if (prev.some(n => n.id === node.id)) return prev;
                return [...prev, node];
              });
              // Select it
              setSelectedNode(node);
            }
          }
        } catch (err) {
          console.error('Failed to fetch focused node:', err);
        }
      };
      fetchFocusedNode();
    }
  }, [activeTabId, allNodes]);

  // Position nodes in a cluster layout
  const graphNodes = useMemo<GraphNode[]>(() => {
    if (allNodes.length === 0) return [];

    const { width, height } = containerSize;
    const centerX = width / 2;
    const centerY = height / 2;

    // Separate base nodes and expanded nodes
    const baseNodeIds = new Set(baseNodes.map(n => n.id));

    // Sort base nodes by edge count
    const sortedBase = [...baseNodes].sort((a, b) => (b.edge_count ?? 0) - (a.edge_count ?? 0));
    const maxEdges = Math.max(...sortedBase.map(n => n.edge_count ?? 0), 1);

    // Position base nodes using spiral layout
    const positioned: GraphNode[] = sortedBase.map((node, index) => {
      const edgeCount = node.edge_count ?? 0;
      const edgeRatio = edgeCount / maxEdges;

      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const angle = index * goldenAngle;

      const isLabeled = index < LABEL_THRESHOLD;
      const labelSpacing = isLabeled ? 60 : 0;
      const baseDistance = 80 + labelSpacing + (1 - edgeRatio) * Math.min(width, height) * 0.35;
      const distance = baseDistance + (index * 4);

      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      const minRadius = 3;
      const maxRadius = 18;
      const radius = minRadius + edgeRatio * (maxRadius - minRadius);

      return { ...node, x, y, radius, isExpanded: false };
    });

    // Track positioned node IDs for quick lookup
    const positionedMap = new Map<number, GraphNode>();
    positioned.forEach(n => positionedMap.set(n.id, n));

    // Position expanded nodes
    if (selectedNode) {
      // Find the selected node's position (could be in base or already expanded)
      let selectedGraphNode = positionedMap.get(selectedNode.id);

      // If selected node is an expanded node not yet positioned, position it first
      if (!selectedGraphNode && !baseNodeIds.has(selectedNode.id)) {
        // Position the selected expanded node at a reasonable location
        // Use the center or find a reference point
        const selectedExpanded: GraphNode = {
          ...selectedNode,
          x: centerX,
          y: centerY,
          radius: 10,
          isExpanded: true,
        };
        positioned.push(selectedExpanded);
        positionedMap.set(selectedNode.id, selectedExpanded);
        selectedGraphNode = selectedExpanded;
      }

      if (selectedGraphNode) {
        // Get all expanded nodes that need positioning (not in base and not already positioned)
        const expandedToPosition = expandedNodes.filter(n =>
          !baseNodeIds.has(n.id) && !positionedMap.has(n.id)
        );

        expandedToPosition.forEach((node, index) => {
          // Position in a circle around the selected node
          const angle = (index / Math.max(expandedToPosition.length, 1)) * Math.PI * 2;
          const distance = 120 + (index % 3) * 30; // Vary distance slightly

          const x = selectedGraphNode!.x + Math.cos(angle) * distance;
          const y = selectedGraphNode!.y + Math.sin(angle) * distance;

          const newNode: GraphNode = {
            ...node,
            x,
            y,
            radius: 8, // Fixed smaller radius for expanded nodes
            isExpanded: true,
          };
          positioned.push(newNode);
          positionedMap.set(node.id, newNode);
        });
      }
    }

    return positioned;
  }, [allNodes, baseNodes, expandedNodes, containerSize, selectedNode]);

  // Get edges between visible nodes
  const graphEdges = useMemo(() => {
    if (graphNodes.length === 0 || edges.length === 0) return [];

    const nodeMap = new Map<number, GraphNode>();
    graphNodes.forEach(node => nodeMap.set(node.id, node));

    return edges
      .map(edge => {
        const source = nodeMap.get(edge.from_node_id);
        const target = nodeMap.get(edge.to_node_id);
        if (!source || !target) return null;
        return { id: edge.id, source, target };
      })
      .filter(Boolean) as Array<{ id: number; source: GraphNode; target: GraphNode }>;
  }, [edges, graphNodes]);

  // Get connected node IDs for selected node
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<number>();
    const connected = new Set<number>();
    edges.forEach(edge => {
      if (edge.from_node_id === selectedNode.id) connected.add(edge.to_node_id);
      if (edge.to_node_id === selectedNode.id) connected.add(edge.from_node_id);
    });
    return connected;
  }, [selectedNode, edges]);

  // Set of locked dimension names for styling
  const lockedDimensionNames = useMemo(() =>
    new Set(lockedDimensions.map(d => d.dimension)),
    [lockedDimensions]
  );

  // Pan handling
  const handlePanStart = (event: React.PointerEvent<SVGRectElement>) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = transform.x;
    const originY = transform.y;

    const handleMove = (moveEvent: PointerEvent) => {
      setTransform(prev => ({
        ...prev,
        x: originX + (moveEvent.clientX - startX),
        y: originY + (moveEvent.clientY - startY),
      }));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'reset') {
      setTransform({ x: 0, y: 0, scale: 1 });
      return;
    }
    setTransform(prev => ({
      ...prev,
      scale: direction === 'in'
        ? Math.min(prev.scale + 0.2, 3)
        : Math.max(prev.scale - 0.2, 0.5),
    }));
  };

  // Handle node click - supports traversal
  const handleNodeClick = (node: GraphNode) => {
    const isCurrentlySelected = selectedNode?.id === node.id;

    if (isCurrentlySelected) {
      // Clicking selected node deselects it
      setSelectedNode(null);
    } else {
      // Select this node - will trigger fetch of its connections
      setSelectedNode(node);
    }
  };

  const handlePaneTypeChange = (type: typeof slot extends 'A' | 'B' ? import('./types').PaneType : never) => {
    onPaneAction?.({ type: 'switch-pane-type', paneType: type });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', overflow: 'hidden' }}>
      <PaneHeader slot={slot} onCollapse={onCollapse} onSwapPanes={onSwapPanes}>
        {/* Dimension filter dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDimensionDropdownOpen(!dimensionDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: selectedDimension ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: selectedDimension ? 'rgba(34, 197, 94, 0.3)' : '#2a2a2a',
              borderRadius: '6px',
              color: selectedDimension ? '#22c55e' : '#888',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{selectedDimension || 'All dimensions'}</span>
            <ChevronDown size={12} style={{
              transform: dimensionDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }} />
          </button>

          {dimensionDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '4px',
              minWidth: '180px',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {/* All dimensions option */}
              <button
                onClick={() => {
                  setSelectedDimension(null);
                  setDimensionDropdownOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 12px',
                  background: !selectedDimension ? '#2a2a2a' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: !selectedDimension ? '#fff' : '#888',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                  textAlign: 'left',
                }}
              >
                All dimensions
                {!selectedDimension && <span style={{ marginLeft: 'auto', color: '#22c55e' }}>✓</span>}
              </button>

              {lockedDimensions.map((dim) => (
                <button
                  key={dim.dimension}
                  onClick={() => {
                    setSelectedDimension(dim.dimension);
                    setDimensionDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '8px 12px',
                    background: selectedDimension === dim.dimension ? '#2a2a2a' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: selectedDimension === dim.dimension ? '#fff' : '#888',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDimension !== dim.dimension) {
                      e.currentTarget.style.background = '#222';
                      e.currentTarget.style.color = '#ccc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDimension !== dim.dimension) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#888';
                    }
                  }}
                >
                  {dim.dimension}
                  {selectedDimension === dim.dimension && <span style={{ marginLeft: 'auto', color: '#22c55e' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </PaneHeader>

      {/* Map content */}
      <div ref={containerRef} style={{ position: 'relative', flex: 1, background: '#080808' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            Loading map...
          </div>
        ) : error ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            {error}
          </div>
        ) : graphNodes.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
            No nodes to display
          </div>
        ) : (
          <>
            {/* Zoom controls */}
            <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 10 }}>
              <button onClick={() => handleZoom('in')} style={controlBtn} title="Zoom in">+</button>
              <button onClick={() => handleZoom('out')} style={controlBtn} title="Zoom out">−</button>
              <button onClick={() => handleZoom('reset')} style={controlBtn} title="Reset">⟳</button>
            </div>

            {/* Selected node info */}
            {selectedNode && (
              <div style={infoPanel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {selectedNode.title || 'Untitled'}
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  {connectedNodeIds.size} connected nodes
                </div>
                <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 8 }}>
                  Click a connected node to traverse
                </div>
                {selectedNode.dimensions && selectedNode.dimensions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {selectedNode.dimensions.slice(0, 5).map(dim => (
                      <span
                        key={dim}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                          background: lockedDimensionNames.has(dim) ? '#132018' : '#1a1a1a',
                          color: lockedDimensionNames.has(dim) ? '#86efac' : '#888',
                        }}
                      >
                        {dim}
                      </span>
                    ))}
                  </div>
                )}
                {/* Open node button */}
                <button
                  onClick={() => onNodeClick?.(selectedNode.id)}
                  style={{
                    marginTop: 4,
                    padding: '8px 12px',
                    background: '#22c55e',
                    color: '#052e16',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Open Node
                </button>
              </div>
            )}

            {/* SVG Graph */}
            <svg width="100%" height="100%" style={{ display: 'block' }}>
              <defs />
              <rect
                width="100%"
                height="100%"
                fill="transparent"
                style={{ cursor: 'grab' }}
                onPointerDown={handlePanStart}
              />
              <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                {/* Edges */}
                {graphEdges.map(edge => {
                  const isConnected = selectedNode && (
                    edge.source.id === selectedNode.id || edge.target.id === selectedNode.id
                  );
                  return (
                    <line
                      key={edge.id}
                      x1={edge.source.x}
                      y1={edge.source.y}
                      x2={edge.target.x}
                      y2={edge.target.y}
                      stroke={isConnected ? '#22c55e' : '#374151'}
                      strokeWidth={isConnected ? 1.5 : 0.75}
                      strokeOpacity={selectedNode ? (isConnected ? 0.9 : 0.15) : 0.6}
                    />
                  );
                })}

                {/* Nodes */}
                {graphNodes.map((node, index) => {
                  const isBaseNode = !node.isExpanded;
                  const isTop = isBaseNode && index < LABEL_THRESHOLD;
                  const isSelected = selectedNode?.id === node.id;
                  const isConnectedToSelected = connectedNodeIds.has(node.id);
                  const isDimmed = selectedNode && !isSelected && !isConnectedToSelected;

                  return (
                    <g
                      key={node.id}
                      onClick={() => handleNodeClick(node)}
                      style={{ cursor: 'pointer' }}
                      opacity={isDimmed ? 0.25 : 1}
                    >
                      {/* Highlight ring for connected nodes */}
                      {isConnectedToSelected && !isSelected && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.radius + 4}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                        />
                      )}
                      {/* Node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius}
                        fill={node.isExpanded ? '#f59e0b' : (isTop ? '#22c55e' : '#334155')}
                        fillOpacity={node.isExpanded ? 0.7 : (isTop ? 0.6 : 0.4)}
                        stroke={isSelected ? '#fff' : (node.isExpanded ? '#b45309' : (isTop ? '#166534' : '#1e293b'))}
                        strokeWidth={isSelected ? 2 : (isTop ? 1.5 : 0.5)}
                      />

                      {/* Label for top base nodes OR expanded nodes */}
                      {(isTop || node.isExpanded) && (
                        <>
                          <text
                            x={node.x}
                            y={node.y + node.radius + 14}
                            textAnchor="middle"
                            fill={node.isExpanded ? '#fbbf24' : '#e5e7eb'}
                            fontSize={node.isExpanded ? 10 : 11}
                            fontWeight={500}
                          >
                            {(node.title || 'Untitled').slice(0, 20)}
                            {(node.title?.length ?? 0) > 20 ? '…' : ''}
                          </text>

                          {!node.isExpanded && node.dimensions && node.dimensions.length > 0 && (() => {
                            const dims = node.dimensions.slice(0, 3).map(d => d.length > 10 ? d.slice(0, 9) + '…' : d).join('  ·  ');
                            const labelWidth = dims.length * 5 + 16;
                            return (
                              <g>
                                <rect
                                  x={node.x - labelWidth / 2}
                                  y={node.y + node.radius + 18}
                                  width={labelWidth}
                                  height={16}
                                  rx={8}
                                  fill="#141414"
                                  stroke="#262626"
                                  strokeWidth={0.5}
                                />
                                <text
                                  x={node.x}
                                  y={node.y + node.radius + 29}
                                  textAnchor="middle"
                                  fill="#a1a1aa"
                                  fontSize={9}
                                >
                                  {dims}
                                </text>
                              </g>
                            );
                          })()}

                          {/* Show dimension for expanded nodes */}
                          {node.isExpanded && node.dimensions && node.dimensions.length > 0 && (
                            <text
                              x={node.x}
                              y={node.y + node.radius + 24}
                              textAnchor="middle"
                              fill="#a1a1aa"
                              fontSize={9}
                            >
                              {node.dimensions[0]}
                            </text>
                          )}
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </>
        )}
      </div>
    </div>
  );
}

const controlBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid #262626',
  background: '#141414',
  color: '#888',
  fontSize: 16,
  cursor: 'pointer',
};

const infoPanel: CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: 16,
  width: 260,
  background: '#0a0a0a',
  border: '1px solid #1f1f1f',
  borderRadius: 8,
  padding: 14,
  zIndex: 10,
};
