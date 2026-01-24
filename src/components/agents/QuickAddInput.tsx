"use client";

import { useState, useCallback } from 'react';
import type { AgentDelegation } from '@/services/agents/delegation';

interface QuickAddSubmitPayload {
  input: string;
  mode: 'link' | 'note' | 'chat';
  description?: string;
}

interface QuickAddInputProps {
  activeDelegations: AgentDelegation[];
  onSubmit: (payload: QuickAddSubmitPayload) => Promise<void>;
  // External control (optional - if provided, component is controlled)
  isOpen?: boolean;
  onClose?: () => void;
}

export default function QuickAddInput({ activeDelegations, onSubmit, isOpen, onClose }: QuickAddInputProps) {
  const [input, setInput] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Support both controlled (isOpen/onClose) and uncontrolled (internal state) modes
  const isControlled = isOpen !== undefined;
  const isExpanded = isControlled ? isOpen : isExpandedInternal;
  const setIsExpanded = isControlled
    ? (value: boolean) => { if (!value && onClose) onClose(); }
    : setIsExpandedInternal;

  const maxConcurrent = 5;
  const activeCount = activeDelegations.filter(
    (d) => d.status === 'queued' || d.status === 'in_progress'
  ).length;
  const isSoftLimited = activeCount >= maxConcurrent;

  const handleFileUpload = useCallback(async (file: File) => {
    setIsPosting(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/extract/pdf/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Success - clear state
      setUploadedFile(null);
      setInput('');
      setIsExpanded(false);

      // Show warning if present (large file)
      if (result.warning) {
        console.log('[QuickAddInput] Upload warning:', result.warning);
      }

    } catch (error) {
      console.error('[QuickAddInput] Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsPosting(false);
    }
  }, []);

  const handleSubmit = async () => {
    // If there's a file, upload it
    if (uploadedFile) {
      await handleFileUpload(uploadedFile);
      return;
    }

    // Otherwise, submit text as before
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
      setUploadedFile(null);
      setUploadError(null);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setUploadError(null);

    const file = e.dataTransfer?.files[0];
    if (!file) return;

    // Check if it's a PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are supported');
      return;
    }

    // Check size (50MB limit)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(`File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 50MB.`);
      return;
    }

    setUploadedFile(file);
    setInput(''); // Clear text input when file is dropped
  }, []);

  const clearFile = useCallback(() => {
    setUploadedFile(null);
    setUploadError(null);
  }, []);

  const hasContent = input.trim() || uploadedFile;

  // Collapsed state - only show button if NOT controlled externally
  if (!isExpanded) {
    // In controlled mode, don't render anything when closed
    if (isControlled) return null;

    // Uncontrolled mode - show the "ADD STUFF" button
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

  // Expanded state - modal overlay (centered if controlled, absolute if uncontrolled)
  const modalContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: '#0a0a0a',
        padding: '16px',
        borderRadius: '12px',
        border: dragOver ? '1px solid #22c55e' : '1px solid #2a2a2a',
        animation: 'fadeIn 150ms ease-out',
        transition: 'border-color 0.15s ease',
        width: isControlled ? '500px' : 'auto',
        maxWidth: isControlled ? '90vw' : 'none',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => e.stopPropagation()}
    >
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
            setUploadedFile(null);
            setUploadError(null);
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

      {/* File preview (when a file is dropped) */}
      {uploadedFile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          background: '#0f1a0f',
          border: '1px solid #1a3a1a',
          borderRadius: '10px',
        }}>
          {/* PDF icon */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round"/>
              <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round"/>
            </svg>
          </div>

          {/* File info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: '#e5e5e5',
              fontSize: '13px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {uploadedFile.name}
            </div>
            <div style={{
              color: '#666',
              fontSize: '11px',
              marginTop: '2px'
            }}>
              {uploadedFile.size < 1024 * 1024
                ? `${Math.round(uploadedFile.size / 1024)} KB`
                : `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB`}
            </div>
          </div>

          {/* Remove button */}
          <button
            onClick={clearFile}
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
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '12px',
        }}>
          {uploadError}
        </div>
      )}

      {/* Input area - show if no file uploaded */}
      {!uploadedFile && (
        <div
          style={{
            position: 'relative',
            borderRadius: '10px',
            border: dragOver ? '2px dashed #22c55e' : '1px solid #1f1f1f',
            background: dragOver ? 'rgba(34, 197, 94, 0.05)' : '#0a0a0a',
            transition: 'all 0.15s ease'
          }}
        >
          {/* Drag overlay */}
          {dragOver && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(34, 197, 94, 0.05)',
              borderRadius: '10px',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                color: '#22c55e'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Drop PDF here</span>
              </div>
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a URL, note, or transcript — or drop a PDF file"
            disabled={isPosting || isSoftLimited}
            autoFocus
            style={{
              width: '100%',
              minHeight: '140px',
              maxHeight: '300px',
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              color: '#e5e5e5',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'none',
              lineHeight: '1.6',
              opacity: dragOver ? 0.3 : 1,
              transition: 'opacity 0.15s ease'
            }}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: '#525252' }}>
          {uploadedFile ? 'Ready to upload' : '\u2318\u21B5 to submit \u00B7 esc to close'}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!hasContent || isPosting || isSoftLimited}
          style={{
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            background: hasContent && !isPosting ? '#22c55e' : '#262626',
            border: 'none',
            borderRadius: '50%',
            cursor: hasContent && !isPosting ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: hasContent && !isPosting ? '0 0 0 0 rgba(34, 197, 94, 0)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (hasContent && !isPosting) {
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasContent ? '#0a0a0a' : '#525252'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

  // In controlled mode, wrap with backdrop
  if (isControlled) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setIsExpanded(false)}
      >
        {modalContent}
      </div>
    );
  }

  // Uncontrolled mode - render with absolute positioning
  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      left: '20px',
      right: '20px',
      zIndex: 100,
    }}>
      {modalContent}
    </div>
  );
}
