#!/usr/bin/env npx ts-node
/**
 * import_pkm2026.ts
 *
 * One-time migration: PKM_2026 Obsidian vault → RA-H SQLite
 *
 * Reads markdown files from PKM_2026 vault, parses YAML frontmatter,
 * and creates RA-H nodes via the HTTP API.
 *
 * Usage:
 *   npx ts-node scripts/migrate/import_pkm2026.ts [--dry-run] [--folder notes|references|clippings|daily]
 *
 * Prerequisites:
 *   - RA-H running at http://localhost:3000
 *   - PKM_2026 vault at /Users/balazsfurjes/Cursor files/PKM_2026/
 *
 * What it migrates:
 *   - notes/        → task, project, idea, meeting, commitment nodes
 *   - references/   → person, org nodes
 *   - clippings/    → clipping nodes
 *   - daily/        → note nodes
 *
 * Wiki-links [[Target]] → RA-H edges (type: related_to, source: migration)
 * Created after all nodes are imported (second pass).
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const VAULT_ROOT = '/Users/balazsfurjes/Cursor files/PKM_2026';
const RA_H_API = 'http://localhost:3000/api';
const FOLDERS = ['notes', 'references', 'clippings', 'daily'] as const;

const DRY_RUN = process.argv.includes('--dry-run');
const FOLDER_FILTER = (() => {
  const idx = process.argv.indexOf('--folder');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Frontmatter {
  type?: string;
  domain?: string;
  status?: string;
  tags?: string[];
  created?: string;
  due?: string;
  project?: string;
  follows?: string;
  outcome?: string;
  org?: string;
  role?: string;
  emails?: string | string[];
  aliases?: string[];
  cited?: number;
  last?: string;
  strength?: string;
  source?: string;
  from?: string;
  subject?: string;
  'msg-id'?: string;
  paperless_id?: number;
  attendees?: string[];
  confidential?: boolean;
  date?: string;
  made?: string;
  [key: string]: unknown;
}

interface ParsedFile {
  filePath: string;
  slug: string;
  folder: string;
  frontmatter: Frontmatter;
  content: string;
  wikiLinks: string[];
}

interface CreatedNode {
  slug: string;
  id: number;
  title: string;
}

// ---------------------------------------------------------------------------
// YAML frontmatter parser (minimal, no deps)
// ---------------------------------------------------------------------------

function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { fm: {}, body: raw };

  const yamlBlock = fmMatch[1];
  const body = fmMatch[2];
  const fm: Frontmatter = {};

  // Simple line-by-line YAML parser for flat + list values
  const lines = yamlBlock.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    let value: string = keyMatch[2].trim();

    // Check if next lines are list items
    if (value === '' || value === '[]') {
      const listItems: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].match(/^\s+-\s+/)) {
        listItems.push(lines[j].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, '').trim());
        j++;
      }
      if (listItems.length > 0) {
        (fm as Record<string, unknown>)[key] = listItems;
        i = j;
        continue;
      }
      if (value === '[]') {
        (fm as Record<string, unknown>)[key] = [];
        i++;
        continue;
      }
    }

    // Scalar value
    value = value.replace(/^['"]|['"]$/g, '');
    if (value === 'true') (fm as Record<string, unknown>)[key] = true;
    else if (value === 'false') (fm as Record<string, unknown>)[key] = false;
    else if (/^\d+$/.test(value)) (fm as Record<string, unknown>)[key] = parseInt(value, 10);
    else (fm as Record<string, unknown>)[key] = value || undefined;

    i++;
  }

  return { fm, body };
}

// ---------------------------------------------------------------------------
// Wiki-link extractor
// ---------------------------------------------------------------------------

function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g);
  return [...new Set([...matches].map(m => m[1].trim().toLowerCase()))];
}

// ---------------------------------------------------------------------------
// Dimension mapping
// ---------------------------------------------------------------------------

function buildDimensions(fm: Frontmatter): string[] {
  const dims: string[] = [];

  // Entity type dimension
  const type = fm.type;
  if (type && ['task','project','idea','note','meeting','commitment','person','org','clipping'].includes(type)) {
    dims.push(type);
  }

  // Domain dimension
  if (fm.domain && fm.domain !== 'personal') {
    dims.push(fm.domain);
  } else if (!fm.domain) {
    dims.push('admin');
  }

  // Status dimension
  const status = fm.status;
  if (status === 'pending') dims.push('pending');
  else if (status === 'active') dims.push('active');
  else if (status === 'complete' || status === 'completed') dims.push('complete');
  else if (status === 'archived' || status === 'cancelled') dims.push('archived');

  // Tags as dimensions (skip generic ones)
  const skipTags = new Set(['daily', 'weekly', 'monthly', 'quarterly', 'eusc']);
  if (Array.isArray(fm.tags)) {
    for (const tag of fm.tags) {
      if (typeof tag === 'string' && !skipTags.has(tag)) {
        dims.push(tag);
      }
    }
  }

  // Deduplicate, max 5
  return [...new Set(dims)].slice(0, 5);
}

function buildMetadata(fm: Frontmatter): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  if (fm.due) meta.due = fm.due;
  if (fm.project) meta.project = fm.project;
  if (fm.follows) meta.follows = fm.follows;
  if (fm.outcome) meta.outcome = fm.outcome;
  if (fm.org) meta.org = fm.org;
  if (fm.role) meta.role = fm.role;
  if (fm.emails) meta.emails = fm.emails;
  if (fm.aliases) meta.aliases = fm.aliases;
  if (fm.cited !== undefined) meta.cited = fm.cited;
  if (fm.last) meta.last = fm.last;
  if (fm.strength) meta.strength = fm.strength;
  if (fm.source) meta.source = fm.source;
  if (fm.from) meta.from = fm.from;
  if (fm.subject) meta.subject = fm.subject;
  if (fm['msg-id']) meta['msg-id'] = fm['msg-id'];
  if (fm.paperless_id) meta.paperless_id = fm.paperless_id;
  if (fm.attendees) meta.attendees = fm.attendees;
  if (fm.confidential !== undefined) meta.confidential = fm.confidential;
  if (fm.date) meta.date = fm.date;
  if (fm.made) meta.made = fm.made;
  meta.migrated_from = 'PKM_2026';

  return meta;
}

// ---------------------------------------------------------------------------
// File scanner
// ---------------------------------------------------------------------------

function scanFiles(): ParsedFile[] {
  const files: ParsedFile[] = [];
  const folders = FOLDER_FILTER ? [FOLDER_FILTER] : FOLDERS;

  for (const folder of folders) {
    const dir = path.join(VAULT_ROOT, folder);
    if (!fs.existsSync(dir)) {
      console.warn(`[warn] Folder not found: ${dir}`);
      continue;
    }

    const entries = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const entry of entries) {
      const filePath = path.join(dir, entry);
      const slug = entry.replace(/\.md$/, '');
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { fm, body } = parseFrontmatter(raw);
      const wikiLinks = extractWikiLinks(body);

      files.push({ filePath, slug, folder, frontmatter: fm, content: body, wikiLinks });
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Title derivation
// ---------------------------------------------------------------------------

function deriveTitle(file: ParsedFile): string {
  // Try first H1 heading
  const h1 = file.content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();

  // Convert slug to title
  return file.slug
    .replace(/-\d{4}-\d{2}-\d{2}$/, '') // remove trailing date
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// RA-H API calls
// ---------------------------------------------------------------------------

async function apiPost(endpoint: string, body: unknown): Promise<{ id: number; [key: string]: unknown }> {
  const res = await fetch(`${RA_H_API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${endpoint} failed (${res.status}): ${text}`);
  }

  const json = await res.json() as { success?: boolean; data?: { id: number; [key: string]: unknown }; id?: number; [key: string]: unknown };
  // RA-H API wraps responses in { success, data: { id, ... } }
  return (json.data ?? json) as { id: number; [key: string]: unknown };
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function migrate() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('PKM_2026 → RA-H Migration');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Folder: ${FOLDER_FILTER || 'all'}`);
  console.log('='.repeat(60));

  // Check RA-H is running
  if (!DRY_RUN) {
    try {
      const health = await fetch(`${RA_H_API}/health`);
      if (!health.ok) throw new Error('Health check failed');
      console.log('✓ RA-H API reachable');
    } catch (e) {
      console.error('✗ RA-H API not reachable. Start with: npm run dev');
      process.exit(1);
    }
  }

  // Scan files
  const files = scanFiles();
  console.log(`\nFound ${files.length} markdown files`);

  const nodeMap = new Map<string, CreatedNode>(); // slug → created node
  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Pass 1: Create nodes
  console.log('\n── Pass 1: Creating nodes ─────────────────────────────');
  for (const file of files) {
    const title = deriveTitle(file);
    const dims = buildDimensions(file.frontmatter);
    const meta = buildMetadata(file.frontmatter);

    const payload = {
      title,
      dimensions: dims,
      content: file.content.slice(0, 20000), // RA-H content limit
      description: `Migrated from PKM_2026/${file.folder}/${file.slug}.md`,
      metadata: meta,
    };

    if (DRY_RUN) {
      console.log(`  [dry] ${file.folder}/${file.slug} → ${title} [${dims.join(', ')}]`);
      nodeMap.set(file.slug.toLowerCase(), { slug: file.slug, id: Math.random() * 10000 | 0, title });
      created++;
      continue;
    }

    try {
      const result = await apiPost('/nodes', payload);
      nodeMap.set(file.slug.toLowerCase(), { slug: file.slug, id: result.id, title });
      console.log(`  ✓ (${result.id}) ${title}`);
      created++;
    } catch (e) {
      console.error(`  ✗ ${file.slug}: ${e instanceof Error ? e.message : e}`);
      errors++;
    }

    // Rate-limit: avoid hammering the API
    await new Promise(r => setTimeout(r, 50));
  }

  // Pass 2: Create wiki-link edges
  console.log('\n── Pass 2: Creating edges from wiki-links ──────────────');
  let edgesCreated = 0;
  let edgesSkipped = 0;

  for (const file of files) {
    const sourceNode = nodeMap.get(file.slug.toLowerCase());
    if (!sourceNode) continue;

    for (const targetSlug of file.wikiLinks) {
      const targetNode = nodeMap.get(targetSlug);
      if (!targetNode) {
        edgesSkipped++;
        continue;
      }
      if (sourceNode.id === targetNode.id) continue;

      if (DRY_RUN) {
        console.log(`  [dry] edge: "${sourceNode.title}" → "${targetNode.title}"`);
        edgesCreated++;
        continue;
      }

      try {
        await apiPost('/edges', {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          explanation: `wiki-link from migration`,
        });
        edgesCreated++;
      } catch {
        // Edge may already exist — ignore
      }

      await new Promise(r => setTimeout(r, 20));
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Migration complete:');
  console.log(`  Nodes created:  ${created}`);
  console.log(`  Nodes errored:  ${errors}`);
  console.log(`  Nodes skipped:  ${skipped}`);
  console.log(`  Edges created:  ${edgesCreated}`);
  console.log(`  Edges skipped (no match): ${edgesSkipped}`);
  if (DRY_RUN) console.log('\n  [DRY RUN — no data was written]');
  console.log('='.repeat(60));
}

migrate().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
