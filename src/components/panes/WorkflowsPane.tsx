"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import RAHChat from '@/components/agents/RAHChat';
import PaneHeader from './PaneHeader';
import { WorkflowsPaneProps, PaneType } from './types';
import type { AgentDelegation } from '@/services/agents/delegation';
import { parseAndRenderContent } from '@/components/helpers/NodeLabelRenderer';
import type { ChatMessage } from '@/components/agents/hooks/useSSEChat';

type ViewMode = 'list' | 'detail' | 'summary';

export default function WorkflowsPane({
  slot,
  isActive,
  onPaneAction,
  onCollapse,
  onSwapPanes,
  delegations,
  onNodeClick,
  openTabsData = [],
  activeTabId = null,
  activeDimension,
}: WorkflowsPaneProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDelegationId, setSelectedDelegationId] = useState<string | null>(null);
  const [delegationMessages, setDelegationMessages] = useState<Record<string, ChatMessage[]>>({});

  const selectedDelegation = delegations.find(d => d.sessionId === selectedDelegationId);

  const getDelegationMessages = useCallback((sessionId: string) => {
    return delegationMessages[sessionId] || [];
  }, [delegationMessages]);

  const setDelegationMessagesFor = useCallback((sessionId: string) => {
    return (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setDelegationMessages(prev => ({
        ...prev,
        [sessionId]: updater(prev[sessionId] || [])
      }));
    };
  }, []);

  const handleSelectDelegation = (sessionId: string) => {
    const delegation = delegations.find(d => d.sessionId === sessionId);
    setSelectedDelegationId(sessionId);

    // Show summary view for completed/failed with no messages
    if (delegation &&
        (delegation.status === 'completed' || delegation.status === 'failed') &&
        getDelegationMessages(sessionId).length === 0) {
      setViewMode('summary');
    } else {
      setViewMode('detail');
    }
  };

  const handleDeleteDelegation = async (sessionId: string) => {
    try {
      await fetch(`/api/rah/delegations/${sessionId}`, { method: 'DELETE' });
    } catch (error) {
      console.error(`Failed to delete delegation ${sessionId}:`, error);
    }
    // The parent will handle removing from delegations list via SSE
  };

  const handleBack = () => {
    setSelectedDelegationId(null);
    setViewMode('list');
  };

  const handleTypeChange = (type: PaneType) => {
    onPaneAction?.({ type: 'switch-pane-type', paneType: type });
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      overflow: 'hidden',
    }}>
      <PaneHeader slot={slot} onCollapse={onCollapse} onSwapPanes={onSwapPanes} />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {viewMode === 'list' && (
          <WorkflowsListView
            delegations={delegations}
            onSelectDelegation={handleSelectDelegation}
            onDeleteDelegation={handleDeleteDelegation}
            onNodeClick={onNodeClick}
          />
        )}

        {viewMode === 'summary' && selectedDelegation && (
          <DelegationSummaryView
            delegation={selectedDelegation}
            onBack={handleBack}
            onNodeClick={onNodeClick}
          />
        )}

        {viewMode === 'detail' && selectedDelegation && (
          <DelegationDetailView
            delegation={selectedDelegation}
            openTabsData={openTabsData}
            activeTabId={activeTabId}
            activeDimension={activeDimension}
            onNodeClick={onNodeClick}
            delegations={delegations}
            messages={getDelegationMessages(selectedDelegation.sessionId)}
            setMessages={setDelegationMessagesFor(selectedDelegation.sessionId)}
            onBack={handleBack}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Workflows list view
function WorkflowsListView({
  delegations,
  onSelectDelegation,
  onDeleteDelegation,
  onNodeClick
}: {
  delegations: AgentDelegation[];
  onSelectDelegation: (sessionId: string) => void;
  onDeleteDelegation: (sessionId: string) => void;
  onNodeClick?: (nodeId: number) => void;
}) {
  const activeDelegations = delegations.filter(d => d.status === 'queued' || d.status === 'in_progress');
  const completedDelegations = delegations.filter(d => d.status === 'completed' || d.status === 'failed');

  const getStatusInfo = (delegation: AgentDelegation) => {
    const isWiseRAH = delegation.agentType === 'wise-rah';
    let color = '#6b6b6b';
    let label = 'Queued';

    if (delegation.status === 'in_progress') {
      color = isWiseRAH ? '#8b5cf6' : '#22c55e';
      label = 'Running';
    } else if (delegation.status === 'completed') {
      color = '#22c55e';
      label = 'Done';
    } else if (delegation.status === 'failed') {
      color = '#ff6b6b';
      label = 'Failed';
    }

    return { color, label };
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{
          color: '#e5e5e5',
          fontSize: '13px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          Workflows
        </span>
        {activeDelegations.length > 0 && (
          <span style={{
            color: '#22c55e',
            fontSize: '11px',
            fontWeight: 500
          }}>
            {activeDelegations.length} running
          </span>
        )}
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px'
      }}>
        {delegations.length === 0 ? (
          <div style={{
            color: '#666',
            fontSize: '12px',
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            No workflows yet. Use Quick Capture or ask RA-H to run a workflow.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeDelegations.map((delegation) => {
              const { color, label } = getStatusInfo(delegation);
              return (
                <WorkflowCard
                  key={delegation.sessionId}
                  delegation={delegation}
                  statusColor={color}
                  statusLabel={label}
                  onSelect={() => onSelectDelegation(delegation.sessionId)}
                  onDelete={() => onDeleteDelegation(delegation.sessionId)}
                  onNodeClick={onNodeClick}
                />
              );
            })}

            {activeDelegations.length > 0 && completedDelegations.length > 0 && (
              <div style={{
                height: '1px',
                background: '#1f1f1f',
                margin: '8px 0'
              }} />
            )}

            {completedDelegations.map((delegation) => {
              const { color, label } = getStatusInfo(delegation);
              return (
                <WorkflowCard
                  key={delegation.sessionId}
                  delegation={delegation}
                  statusColor={color}
                  statusLabel={label}
                  onSelect={() => onSelectDelegation(delegation.sessionId)}
                  onDelete={() => onDeleteDelegation(delegation.sessionId)}
                  onNodeClick={onNodeClick}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Individual workflow card
function WorkflowCard({
  delegation,
  statusColor,
  statusLabel,
  onSelect,
  onDelete,
  onNodeClick
}: {
  delegation: AgentDelegation;
  statusColor: string;
  statusLabel: string;
  onSelect: () => void;
  onDelete: () => void;
  onNodeClick?: (nodeId: number) => void;
}) {
  const isActive = delegation.status === 'in_progress' || delegation.status === 'queued';

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 16px',
        background: '#151515',
        border: '1px solid #1f1f1f',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#1a1a1a';
        e.currentTarget.style.borderColor = '#2a2a2a';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#151515';
        e.currentTarget.style.borderColor = '#1f1f1f';
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: statusColor,
          animation: isActive ? 'pulse 2s infinite' : 'none'
        }} />
        <span style={{
          color: statusColor,
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {statusLabel}
        </span>
        <span style={{
          color: '#555',
          fontSize: '11px',
          marginLeft: 'auto'
        }}>
          {new Date(delegation.createdAt).toLocaleTimeString()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#444',
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: '14px',
            lineHeight: 1
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ff6b6b'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#444'}
        >
          ×
        </button>
      </div>

      <div style={{
        color: '#e5e5e5',
        fontSize: '12px',
        lineHeight: '1.4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical'
      }}>
        {delegation.task}
      </div>

      {delegation.summary && delegation.status === 'completed' && (
        <div style={{
          color: '#666',
          fontSize: '11px',
          marginTop: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {parseAndRenderContent(delegation.summary, onNodeClick)}
        </div>
      )}
    </div>
  );
}

// Summary view for completed delegations
function DelegationSummaryView({
  delegation,
  onBack,
  onNodeClick
}: {
  delegation: AgentDelegation;
  onBack?: () => void;
  onNodeClick?: (nodeId: number) => void;
}) {
  const isSuccess = delegation.status === 'completed';
  const statusColor = isSuccess ? '#22c55e' : '#ff6b6b';
  const statusLabel = isSuccess ? 'Completed' : 'Failed';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      padding: '24px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #1a1a1a'
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px'
            }}
          >
            ←
          </button>
        )}
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: statusColor
        }} />
        <span style={{
          color: statusColor,
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          {statusLabel}
        </span>
        <span style={{
          color: '#666',
          fontSize: '11px',
          marginLeft: 'auto'
        }}>
          {new Date(delegation.updatedAt).toLocaleString()}
        </span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{
          color: '#666',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '8px'
        }}>
          Task
        </div>
        <div style={{
          color: '#e5e5e5',
          fontSize: '13px',
          lineHeight: '1.5'
        }}>
          {delegation.task}
        </div>
      </div>

      {delegation.summary && (
        <div style={{ flex: 1 }}>
          <div style={{
            color: '#666',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px'
          }}>
            Result
          </div>
          <div style={{
            color: isSuccess ? '#a8a8a8' : '#fca5a5',
            fontSize: '13px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap'
          }}>
            {parseAndRenderContent(delegation.summary || '', onNodeClick)}
          </div>
        </div>
      )}

      {!delegation.summary && (
        <div style={{
          color: '#666',
          fontSize: '12px',
          fontStyle: 'italic'
        }}>
          No details available
        </div>
      )}
    </div>
  );
}

// Detail view with chat
function DelegationDetailView({
  delegation,
  openTabsData,
  activeTabId,
  activeDimension,
  onNodeClick,
  delegations,
  messages,
  setMessages,
  onBack
}: {
  delegation: AgentDelegation;
  openTabsData: any[];
  activeTabId: number | null;
  activeDimension?: string | null;
  onNodeClick?: (nodeId: number) => void;
  delegations: AgentDelegation[];
  messages: ChatMessage[];
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onBack: () => void;
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'transparent'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#a8a8a8'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
        >
          ← Workflows
        </button>
        <span style={{ color: '#555', fontSize: '11px' }}>|</span>
        <span style={{
          color: delegation.status === 'in_progress' ? '#22c55e' : '#666',
          fontSize: '11px',
          textTransform: 'uppercase'
        }}>
          {delegation.status === 'in_progress' ? 'Running' : delegation.status}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <RAHChat
          openTabsData={openTabsData}
          activeTabId={activeTabId}
          activeDimension={activeDimension}
          onNodeClick={onNodeClick}
          delegations={delegations}
          messages={messages}
          setMessages={setMessages}
          mode="easy"
          delegationMode={true}
          delegationSessionId={delegation.sessionId}
        />
      </div>
    </div>
  );
}
