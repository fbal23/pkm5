"use client";

import { useState } from 'react';
import type { AgentDelegation } from '@/services/agents/delegation';

interface QuickAddSubmitPayload {
  input: string;
  mode: 'link' | 'note' | 'chat';
  description?: string;
}

interface QuickAddInputProps {
  activeDelegations: AgentDelegation[];
  onSubmit: (payload: QuickAddSubmitPayload) => Promise<void>;
}

export default function QuickAddInput({ activeDelegations, onSubmit }: QuickAddInputProps) {
  const [input, setInput] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const maxConcurrent = 5;
  const activeCount = activeDelegations.filter(
    (d) => d.status === 'queued' || d.status === 'in_progress'
  ).length;
  const isSoftLimited = activeCount >= maxConcurrent;

  const handleSubmit = async () => {
    if (!input.trim() || isPosting || isSoftLimited) return;

    setIsPosting(true);
    try {
      // Mode is auto-detected server-side via quickAdd.ts detectInputType()
      await onSubmit({
        input: input.trim(),
        mode: 'link', // Default; actual type is inferred server-side
      });
      setInput('');
      setIsExpanded(false);
    } catch (error) {
      console.error('[QuickAddInput] Submit error:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setInput('');
    }
  };

  // Collapsed state - prominent "ADD STUFF" button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          color: '#22c55e',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          boxShadow: '0 0 12px rgba(34, 197, 94, 0.15)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
          e.currentTarget.style.borderColor = '#22c55e';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
          e.currentTarget.style.boxShadow = '0 0 12px rgba(34, 197, 94, 0.15)';
        }}
      >
        <span style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#22c55e',
          color: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700
        }}>+</span>
        Add Stuff
      </button>
    );
  }

  // Expanded state - full width overlay
  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      left: '20px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      background: '#0a0a0a',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      zIndex: 100,
      animation: 'fadeIn 150ms ease-out'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{
          color: '#22c55e',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#22c55e',
            color: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700
          }}>+</span>
          Add Stuff
        </span>

        {/* Close button */}
        <button
          onClick={() => {
            setIsExpanded(false);
            setInput('');
          }}
          style={{
            padding: '6px',
            background: 'transparent',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#999'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Input area - expanded */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a URL, note, or transcript — RA-H will figure out what it is."
          disabled={isPosting || isSoftLimited}
          autoFocus
          style={{
            width: '100%',
            minHeight: '140px',
            maxHeight: '300px',
            padding: '14px 16px',
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
            borderRadius: '10px',
            color: '#e5e5e5',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'none',
            lineHeight: '1.6',
            transition: 'border-color 0.15s ease'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#333';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#1f1f1f';
          }}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: '#525252' }}>
          ⌘↵ to submit · esc to close
        </span>
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isPosting || isSoftLimited}
          style={{
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            background: input.trim() && !isPosting ? '#22c55e' : '#262626',
            border: 'none',
            borderRadius: '50%',
            cursor: input.trim() && !isPosting ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: input.trim() && !isPosting ? '0 0 0 0 rgba(34, 197, 94, 0)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (input.trim() && !isPosting) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 0 0 0 rgba(34, 197, 94, 0)';
          }}
        >
          {isPosting ? (
            <span style={{
              width: '14px',
              height: '14px',
              border: '2px solid #0a0a0a',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#0a0a0a' : '#525252'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5"/>
              <path d="M5 12l7-7 7 7"/>
            </svg>
          )}
        </button>
      </div>

      {/* Active processing indicator */}
      {activeCount > 0 && (
        <div style={{
          padding: '10px 12px',
          background: '#0a1a0a',
          border: '1px solid #1a3a1a',
          borderRadius: '8px',
          color: '#22c55e',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#22c55e',
            animation: 'pulse 2s ease-in-out infinite'
          }} />
          Adding {activeCount} node{activeCount > 1 ? 's' : ''}...
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
