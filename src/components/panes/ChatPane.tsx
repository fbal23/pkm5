"use client";

import { useState, useEffect } from 'react';
import RAHChat from '@/components/agents/RAHChat';
import PaneHeader from './PaneHeader';
import { ChatPaneProps } from './types';
import type { ChatMessage } from '@/components/agents/hooks/useSSEChat';

export default function ChatPane({
  slot,
  isActive,
  onPaneAction,
  onCollapse,
  onSwapPanes,
  openTabsData,
  activeTabId,
  activeDimension,
  onClearDimension,
  onNodeClick,
  delegations,
  chatMessages: externalMessages,
  setChatMessages: externalSetMessages,
  highlightedPassage,
  onClearPassage,
}: ChatPaneProps) {
  const [rahMode, setRahMode] = useState<'easy' | 'hard'>('easy');
  const [hasStarted, setHasStarted] = useState(false);

  // Use lifted state if provided, otherwise fall back to local state
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);

  const rahMessages = (externalMessages as ChatMessage[]) ?? internalMessages;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setRahMessages = (externalSetMessages as any) ?? setInternalMessages;

  // Load mode from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('rah-mode');
    if (stored === 'easy' || stored === 'hard') {
      setRahMode(stored);
    }
  }, []);

  // Persist mode to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('rah-mode', rahMode);
  }, [rahMode]);

  // Listen for mode toggle events
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ mode: 'easy' | 'hard' }>).detail;
      if (detail?.mode) {
        setRahMode(detail.mode);
      }
    };
    window.addEventListener('rah:mode-toggle', handler as EventListener);
    return () => {
      window.removeEventListener('rah:mode-toggle', handler as EventListener);
    };
  }, []);

  // Auto-start if there are existing messages
  useEffect(() => {
    if (rahMessages.length > 0 && !hasStarted) {
      setHasStarted(true);
    }
  }, [rahMessages.length, hasStarted]);

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
        {!hasStarted ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}>
            {/* Start Chat button */}
            <div style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <button
                onClick={() => {
                  setHasStarted(true);
                  setRahMode('easy');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '0',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  const text = e.currentTarget.querySelector('.start-text') as HTMLElement;
                  const icon = e.currentTarget.querySelector('.start-icon') as HTMLElement;
                  if (text) text.style.color = '#22c55e';
                  if (icon) {
                    icon.style.transform = 'translateY(-3px)';
                    icon.style.boxShadow = '0 8px 20px rgba(34, 197, 94, 0.3), 0 0 0 4px rgba(34, 197, 94, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  const text = e.currentTarget.querySelector('.start-text') as HTMLElement;
                  const icon = e.currentTarget.querySelector('.start-icon') as HTMLElement;
                  if (text) text.style.color = '#737373';
                  if (icon) {
                    icon.style.transform = 'translateY(0)';
                    icon.style.boxShadow = '0 0 0 0 rgba(34, 197, 94, 0)';
                  }
                }}
              >
                <span
                  className="start-text"
                  style={{
                    color: '#737373',
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    transition: 'color 0.2s ease'
                  }}
                >
                  Start
                </span>
                <div
                  className="start-icon"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 0 0 0 rgba(34, 197, 94, 0)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5"/>
                    <path d="M5 12l7-7 7 7"/>
                  </svg>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <RAHChat
            openTabsData={openTabsData}
            activeTabId={activeTabId}
            activeDimension={activeDimension}
            onClearDimension={onClearDimension}
            onNodeClick={onNodeClick}
            delegations={delegations}
            messages={rahMessages}
            setMessages={setRahMessages}
            mode={rahMode}
            highlightedPassage={highlightedPassage}
            onClearPassage={onClearPassage}
          />
        )}
      </div>
    </div>
  );
}
