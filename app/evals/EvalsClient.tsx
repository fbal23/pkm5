'use client';

import { useMemo, useState } from 'react';
import type { EvalTrace } from '@/services/evals/evalsStore';

type Props = {
  traces: EvalTrace[];
  scenarioList: Array<{
    id: string;
    name: string;
    description?: string;
    tools?: string[];
    enabled?: boolean;
    notes?: string;
  }>;
};

function formatPreview(text: string | null, max = 80) {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

function statusLabel(success: number | null) {
  if (success === null) return 'n/a';
  return success ? 'success' : 'fail';
}

function badgeStyle(kind: 'success' | 'fail' | 'neutral') {
  const base = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12 };
  if (kind === 'success') return { ...base, background: '#e6f4ea', color: '#146c2e' };
  if (kind === 'fail') return { ...base, background: '#fdecea', color: '#b42318' };
  return { ...base, background: '#f2f2f2', color: '#333' };
}

function prettyJson(value: string | null) {
  if (!value) return '';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function EvalsClient({ traces, scenarioList }: Props) {
  const [openTraceId, setOpenTraceId] = useState<string | null>(traces[0]?.chat.trace_id || null);
  const [comments, setComments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    traces.forEach((trace) => {
      if (trace.comment) {
        initial[trace.chat.trace_id] = trace.comment;
      }
    });
    return initial;
  });
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // 'all' | 'live' | 'scenario'
  const [scenarioFilter, setScenarioFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const rows = useMemo(() => {
    return traces.map((trace) => {
      const { chat, toolCalls } = trace;
      const status = statusLabel(chat.success);
      const isLive = !chat.scenario_id;
      return {
        trace,
        id: chat.trace_id,
        source: isLive ? 'live' : 'scenario',
        scenario: chat.scenario_id || '—',
        model: chat.model || 'n/a',
        latency: chat.latency_ms ?? 'n/a',
        tokens: `${chat.input_tokens ?? 0}/${chat.output_tokens ?? 0} (${chat.total_tokens ?? 0})`,
        cost: chat.estimated_cost_usd ?? null,
        cache: chat.cache_hit == null ? 'n/a' : chat.cache_hit ? 'hit' : 'miss',
        cacheTokens: `${chat.cache_read_tokens ?? 0}/${chat.cache_write_tokens ?? 0}`,
        toolCount: toolCalls.length,
        status,
        userPreview: formatPreview(chat.user_message),
        timestamp: chat.ts,
        mode: chat.mode || 'n/a',
        workflow: chat.workflow_key || '—',
      };
    });
  }, [traces]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (scenarioFilter !== 'all' && row.scenario !== scenarioFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (searchFilter.trim()) {
        const needle = searchFilter.toLowerCase();
        if (!row.userPreview.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [rows, sourceFilter, scenarioFilter, statusFilter, searchFilter]);

  const openTrace = traces.find((trace) => trace.chat.trace_id === openTraceId) || traces[0];

  return (
    <div>
      <div style={{ marginBottom: 24, border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Scenario Set</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '6px 6px' }}>ID</th>
                <th style={{ padding: '6px 6px' }}>Name</th>
                <th style={{ padding: '6px 6px' }}>Description</th>
                <th style={{ padding: '6px 6px' }}>Tools</th>
                <th style={{ padding: '6px 6px' }}>Enabled</th>
                <th style={{ padding: '6px 6px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {scenarioList.map((scenario) => (
                <tr key={scenario.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 6px' }}>{scenario.id}</td>
                  <td style={{ padding: '6px 6px' }}>{scenario.name}</td>
                  <td style={{ padding: '6px 6px', color: '#555' }}>{scenario.description || '—'}</td>
                  <td style={{ padding: '6px 6px', color: '#555' }}>{scenario.tools?.join(', ') || '—'}</td>
                  <td style={{ padding: '6px 6px' }}>{scenario.enabled === false ? 'no' : 'yes'}</td>
                  <td style={{ padding: '6px 6px', color: '#555' }}>{scenario.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>Source</span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', fontWeight: 500 }}
            >
              <option value="all">All</option>
              <option value="live">🟢 Live Runs</option>
              <option value="scenario">🔬 Scenarios</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>Scenario</span>
            <select
              value={scenarioFilter}
              onChange={(event) => setScenarioFilter(event.target.value)}
              style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd' }}
            >
              <option value="all">All</option>
              {Array.from(new Set(rows.filter(row => row.scenario !== '—').map(row => row.scenario))).map((scenario) => (
                <option key={scenario} value={scenario}>{scenario}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd' }}
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="fail">Fail</option>
              <option value="n/a">N/A</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>Search</span>
            <input
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="User input contains..."
              style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', minWidth: 240 }}
            />
          </label>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '8px 6px' }}>Source</th>
              <th style={{ padding: '8px 6px' }}>Scenario</th>
              <th style={{ padding: '8px 6px' }}>Status</th>
              <th style={{ padding: '8px 6px' }}>Latency</th>
              <th style={{ padding: '8px 6px' }}>Tokens</th>
              <th style={{ padding: '8px 6px' }}>Cost</th>
              <th style={{ padding: '8px 6px' }}>Cache</th>
              <th style={{ padding: '8px 6px' }}>Tools</th>
              <th style={{ padding: '8px 6px' }}>Model</th>
              <th style={{ padding: '8px 6px' }}>Mode</th>
              <th style={{ padding: '8px 6px' }}>Workflow</th>
              <th style={{ padding: '8px 6px' }}>User Input</th>
              <th style={{ padding: '8px 6px' }}>Time</th>
              <th style={{ padding: '8px 6px' }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const isOpen = row.id === openTraceId;
              const statusKind = row.status === 'success' ? 'success' : row.status === 'fail' ? 'fail' : 'neutral';
              const commentValue = comments[row.id] || '';
              return (
                <tr
                  key={row.id}
                  onClick={() => setOpenTraceId(row.id)}
                  style={{
                    cursor: 'pointer',
                    background: isOpen ? '#eef4ff' : '#fff',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{
                      ...badgeStyle(row.source === 'live' ? 'success' : 'neutral'),
                      fontSize: 11,
                    }}>
                      {row.source === 'live' ? '🟢 Live' : '🔬 Scenario'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px' }}>{row.scenario}</td>
                  <td style={{ padding: '8px 6px' }}><span style={badgeStyle(statusKind)}>{row.status}</span></td>
                  <td style={{ padding: '8px 6px' }}>{row.latency} ms</td>
                  <td style={{ padding: '8px 6px' }}>{row.tokens}</td>
                  <td style={{ padding: '8px 6px' }}>{row.cost == null ? 'n/a' : `$${row.cost.toFixed(4)}`}</td>
                  <td style={{ padding: '8px 6px' }}>{row.cache} ({row.cacheTokens})</td>
                  <td style={{ padding: '8px 6px' }}>{row.toolCount}</td>
                  <td style={{ padding: '8px 6px' }}>{row.model}</td>
                  <td style={{ padding: '8px 6px' }}>{row.mode}</td>
                  <td style={{ padding: '8px 6px' }}>{row.workflow}</td>
                  <td style={{ padding: '8px 6px', color: '#555' }}>{row.userPreview}</td>
                  <td style={{ padding: '8px 6px', color: '#666' }}>{row.timestamp}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <textarea
                      value={commentValue}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setComments((prev) => ({ ...prev, [row.id]: nextValue }));
                      }}
                      onBlur={async (event) => {
                        const nextValue = event.target.value;
                        try {
                          await fetch('/api/evals/comment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              traceId: row.id,
                              scenarioId: row.scenario,
                              comment: nextValue,
                            }),
                          });
                        } catch {
                          // Ignore failures in the UI, keep local state.
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                      rows={2}
                      style={{
                        width: 220,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        fontSize: 12,
                        padding: 6,
                        borderRadius: 6,
                        border: '1px solid #ddd',
                      }}
                      placeholder="Add notes..."
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openTrace ? (
        <div style={{ marginTop: 24, border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <div><strong>Source:</strong> {openTrace.chat.scenario_id ? '🔬 Scenario' : '🟢 Live Run'}</div>
            <div><strong>Scenario:</strong> {openTrace.chat.scenario_id || '—'}</div>
            <div><strong>Trace:</strong> {openTrace.chat.trace_id}</div>
            <div><strong>Helper:</strong> {openTrace.chat.helper_name || 'n/a'}</div>
            <div><strong>Model:</strong> {openTrace.chat.model || 'n/a'}</div>
            <div><strong>Mode:</strong> {openTrace.chat.mode || 'n/a'}</div>
            <div><strong>Workflow:</strong> {openTrace.chat.workflow_key || '—'}</div>
            <div><strong>Latency:</strong> {openTrace.chat.latency_ms ?? 'n/a'} ms</div>
            <div><strong>Tokens:</strong> {openTrace.chat.input_tokens ?? 0}/{openTrace.chat.output_tokens ?? 0} (total {openTrace.chat.total_tokens ?? 0})</div>
            <div><strong>Cost:</strong> {openTrace.chat.estimated_cost_usd == null ? 'n/a' : `$${openTrace.chat.estimated_cost_usd.toFixed(4)}`}</div>
            <div><strong>Cache:</strong> {openTrace.chat.cache_hit == null ? 'n/a' : openTrace.chat.cache_hit ? 'hit' : 'miss'} (read {openTrace.chat.cache_read_tokens ?? 0} / write {openTrace.chat.cache_write_tokens ?? 0})</div>
            <div><strong>Tools:</strong> {openTrace.toolCalls.length}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div><strong>Comment:</strong></div>
            <div style={{ color: '#555' }}>{comments[openTrace.chat.trace_id] || '—'}</div>
          </div>

          <details open>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}><strong>System Message</strong></summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{openTrace.chat.system_message || 'n/a'}</pre>
          </details>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Trace Steps</div>
            {[
              {
                type: 'chat',
                ts: openTrace.chat.ts,
                title: 'LLM Chat',
                spanId: openTrace.chat.span_id,
                parentSpanId: null,
                latency: openTrace.chat.latency_ms,
                success: openTrace.chat.success,
                content: (
                  <>
                    <div><strong>User</strong></div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{openTrace.chat.user_message}</pre>
                    <div><strong>Assistant</strong></div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{openTrace.chat.assistant_message}</pre>
                  </>
                ),
              },
              ...openTrace.toolCalls.map((tool) => ({
                type: 'tool',
                ts: tool.ts,
                title: `Tool: ${tool.tool_name}`,
                spanId: tool.span_id,
                parentSpanId: tool.parent_span_id,
                latency: tool.latency_ms,
                success: tool.success,
                content: (
                  <>
                    <div><strong>Args</strong></div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{prettyJson(tool.args_json)}</pre>
                    <div><strong>Result</strong></div>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{prettyJson(tool.result_json)}</pre>
                    {tool.error ? (
                      <>
                        <div><strong>Error</strong></div>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{tool.error}</pre>
                      </>
                    ) : null}
                  </>
                ),
              })),
            ].sort((a, b) => a.ts.localeCompare(b.ts)).map((step, index) => {
              const stepStatus = statusLabel(step.success);
              const stepKind = stepStatus === 'success' ? 'success' : stepStatus === 'fail' ? 'fail' : 'neutral';
              return (
                <div key={`${openTrace.chat.trace_id}-${step.type}-${index}`} style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div><strong>Step {index + 1}:</strong> {step.title}</div>
                    <span style={badgeStyle(stepKind)}>{stepStatus}</span>
                    <div style={{ color: '#666' }}>{step.ts}</div>
                  </div>
                  <div style={{ marginTop: 6, color: '#555' }}>
                    <div><strong>Span:</strong> {step.spanId || 'n/a'}</div>
                    {step.parentSpanId ? <div><strong>Parent Span:</strong> {step.parentSpanId}</div> : null}
                    <div><strong>Latency:</strong> {step.latency ?? 'n/a'} ms</div>
                  </div>
                  <div style={{ marginTop: 8 }}>{step.content}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
