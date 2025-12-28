import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { scenarios } from './scenarios';
import { Scenario } from './types';

type EvalChatRow = {
  trace_id: string;
  scenario_id: string;
  assistant_message: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};

type EvalToolCallRow = {
  tool_name: string;
};

type EvalResult = {
  scenario: string;
  passed: boolean;
  failures: string[];
  warnings: string[];
  latencyMs?: number | null;
};

const BASE_URL = process.env.RAH_EVALS_BASE_URL || 'http://localhost:3000';
const DATASET_ENV = process.env.RAH_EVALS_DATASET_ID;
const LOG_DB_PATH = path.join(process.cwd(), 'logs', 'evals.sqlite');
const RAH_DB_PATH = process.env.SQLITE_DB_PATH || path.join(
  process.env.HOME || '~',
  'Library/Application Support/RA-H/db/rah.sqlite'
);

function loadDatasetId() {
  if (DATASET_ENV) return DATASET_ENV;
  const datasetPath = path.join(process.cwd(), 'tests', 'evals', 'dataset.json');
  const raw = fs.readFileSync(datasetPath, 'utf-8');
  const parsed = JSON.parse(raw);
  return parsed.id || 'default';
}

function resolveFocusedNodeId(query: Scenario['input']['focusedNodeQuery']): number | null {
  if (!query) return null;
  if (!fs.existsSync(RAH_DB_PATH)) return null;
  const db = new Database(RAH_DB_PATH, { readonly: true, fileMustExist: true });
  if (query.titleEquals) {
    const row = db.prepare(`
      SELECT id
      FROM nodes
      WHERE title = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).get(query.titleEquals) as { id?: number } | undefined;
    return row?.id ?? null;
  }
  if (query.titleContains) {
    const row = db.prepare(`
      SELECT id
      FROM nodes
      WHERE title LIKE ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).get(`%${query.titleContains}%`) as { id?: number } | undefined;
    return row?.id ?? null;
  }
  return null;
}

async function drainResponse(response: Response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    decoder.decode(value, { stream: true });
  }
}

function openEvalDb() {
  if (!fs.existsSync(LOG_DB_PATH)) {
    return null;
  }
  return new Database(LOG_DB_PATH, { readonly: true, fileMustExist: true });
}

function getEvalChatRow(db: Database.Database, traceId: string, scenarioId: string) {
  return db.prepare(`
    SELECT trace_id, scenario_id, assistant_message, latency_ms, input_tokens, output_tokens, total_tokens
    FROM llm_chats
    WHERE trace_id = ? AND scenario_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(traceId, scenarioId) as EvalChatRow | undefined;
}

function getEvalToolCalls(db: Database.Database, traceId: string, scenarioId: string) {
  return db.prepare(`
    SELECT tool_name
    FROM tool_calls
    WHERE trace_id = ? AND scenario_id = ?
  `).all(traceId, scenarioId) as EvalToolCallRow[];
}

async function waitForEvalRow(traceId: string, scenarioId: string, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const db = openEvalDb();
    if (db) {
      const row = getEvalChatRow(db, traceId, scenarioId);
      if (row) return { row, db };
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return { row: undefined, db: null };
}

function normalizeContains(text: string) {
  return text.toLowerCase();
}

function checkScenario(
  scenario: Scenario,
  chatRow: EvalChatRow,
  toolCalls: EvalToolCallRow[]
): EvalResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const expect = scenario.expect || {};
  const toolNames = toolCalls.map(call => call.tool_name);
  const responseText = chatRow.assistant_message || '';

  (expect.toolsCalled || []).forEach(tool => {
    if (!toolNames.includes(tool)) {
      failures.push(`Expected tool "${tool}" not called`);
    }
  });

  (expect.toolsCalledSoft || []).forEach(tool => {
    if (!toolNames.includes(tool)) {
      warnings.push(`(soft) Expected tool "${tool}" not called`);
    }
  });

  (expect.responseContains || []).forEach(text => {
    if (!normalizeContains(responseText).includes(normalizeContains(text))) {
      failures.push(`Response missing "${text}"`);
    }
  });

  (expect.responseContainsSoft || []).forEach(text => {
    if (!normalizeContains(responseText).includes(normalizeContains(text))) {
      warnings.push(`(soft) Response missing "${text}"`);
    }
  });

  (expect.responseNotContains || []).forEach(text => {
    if (normalizeContains(responseText).includes(normalizeContains(text))) {
      failures.push(`Response should not contain "${text}"`);
    }
  });

  if (typeof expect.maxLatencyMs === 'number' && chatRow.latency_ms !== null) {
    if (chatRow.latency_ms > expect.maxLatencyMs) {
      failures.push(`Latency ${chatRow.latency_ms}ms exceeded ${expect.maxLatencyMs}ms`);
    }
  }

  return {
    scenario: scenario.name,
    passed: failures.length === 0,
    failures,
    warnings,
    latencyMs: chatRow.latency_ms,
  };
}

async function runScenario(scenario: Scenario, datasetId: string): Promise<EvalResult> {
  const traceId = `eval_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const resolvedFocusedNodeId =
    scenario.input.focusedNodeId ?? resolveFocusedNodeId(scenario.input.focusedNodeQuery);
  const response = await fetch(`${BASE_URL}/api/rah/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: scenario.input.message }],
      openTabs: [],
      activeTabId: resolvedFocusedNodeId ?? null,
      currentView: 'nodes',
      mode: scenario.input.mode ?? 'easy',
      traceId,
      evals: {
        datasetId,
        scenarioId: scenario.id,
      },
    }),
  });

  if (!response.ok) {
    return {
      scenario: scenario.name,
      passed: false,
      failures: [`HTTP ${response.status} from /api/rah/chat`],
      warnings: [],
    };
  }

  await drainResponse(response);

  const { row, db } = await waitForEvalRow(traceId, scenario.id);
  if (!row) {
    return {
      scenario: scenario.name,
      passed: false,
      failures: ['Timed out waiting for eval logs'],
      warnings: [],
    };
  }

  const toolCalls = db ? getEvalToolCalls(db, traceId, scenario.id) : [];
  return checkScenario(scenario, row, toolCalls);
}

async function runAll() {
  const datasetId = loadDatasetId();
  console.log(`Running ${scenarios.length} scenarios (dataset: ${datasetId})...\n`);

  const results: EvalResult[] = [];
  for (const scenario of scenarios.filter(s => s.enabled !== false)) {
    const result = await runScenario(scenario, datasetId);
    results.push(result);
    const icon = result.passed ? '✓' : '✗';
    const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : '';
    console.log(`${icon} ${result.scenario}${latency}`);
    result.failures.forEach(failure => console.log(`  - ${failure}`));
    result.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  const failed = results.filter(result => !result.passed);
  const warnings = results.filter(result => result.warnings.length > 0);
  console.log('\nSummary');
  console.log(`- Passed: ${results.length - failed.length}`);
  console.log(`- Failed: ${failed.length}`);
  console.log(`- With warnings: ${warnings.length}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

runAll().catch(error => {
  console.error('Eval runner failed:', error);
  process.exit(1);
});
