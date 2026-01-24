"use client";

import { ChevronLeft, ChevronRight, FileText, MessageSquare, Workflow, FolderOpen, Map, LayoutList } from 'lucide-react';

type RailPosition = 'left' | 'right';
type PaneType = 'nodes' | 'node' | 'chat' | 'workflows' | 'dimensions' | 'map' | 'views';

interface CollapsedRailProps {
  position: RailPosition;
  paneType: PaneType;
  onExpand: () => void;
  shortcut?: string;
}

const PANE_ICONS: Record<PaneType, React.ReactNode> = {
  nodes: <FileText size={18} />,
  node: <FileText size={18} />,
  chat: <MessageSquare size={18} />,
  workflows: <Workflow size={18} />,
  dimensions: <FolderOpen size={18} />,
  map: <Map size={18} />,
  views: <LayoutList size={18} />,
};

const PANE_LABELS: Record<PaneType, string> = {
  nodes: 'Nodes',
  node: 'Focus',
  chat: 'Chat',
  workflows: 'Workflows',
  dimensions: 'Dimensions',
  map: 'Map',
  views: 'Feed',
};

export default function CollapsedRail({ position, paneType, onExpand, shortcut }: CollapsedRailProps) {
  const isLeft = position === 'left';
  const ChevronIcon = isLeft ? ChevronRight : ChevronLeft;

  return (
    <div
      onClick={onExpand}
      style={{
        width: '40px',
        height: '100%',
        flexShrink: 0,
        borderLeft: isLeft ? 'none' : '1px solid #1f1f1f',
        borderRight: isLeft ? '1px solid #1f1f1f' : 'none',
        background: '#0c0c0c',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '12px',
        gap: '8px',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#141414';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#0c0c0c';
      }}
      title={`Expand ${PANE_LABELS[paneType]}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {/* Icon representing the collapsed panel */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          background: '#1a1a1a',
          border: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          transition: 'all 0.15s ease',
        }}
      >
        {PANE_ICONS[paneType]}
      </div>

      {/* Chevron indicator */}
      <div
        style={{
          color: '#666',
          marginTop: '4px',
        }}
      >
        <ChevronIcon size={14} />
      </div>

      {/* Vertical label */}
      <div
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: isLeft ? 'rotate(180deg)' : 'none',
          fontSize: '10px',
          fontWeight: 500,
          color: '#777',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginTop: '8px',
        }}
      >
        {PANE_LABELS[paneType]}
      </div>
    </div>
  );
}
