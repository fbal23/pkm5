#!/usr/bin/env npx ts-node
/**
 * create_migration_edges.ts
 *
 * Second-pass: create wiki-link edges for nodes already migrated from PKM_2026.
 * Run after import_pkm2026.ts has completed.
 *
 * Usage:
 *   npx ts-node scripts/migrate/create_migration_edges.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const VAULT_ROOT = '/Users/balazsfurjes/Cursor files/PKM_2026';
const RA_H_API = 'http://localhost:3000/api';
const FOLDERS = ['notes', 'references', 'clippings', 'daily'] as const;
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g);
  return [...new Set([...matches].map(m => m[1].trim()))];
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '');
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Extract first H1 from markdown
function extractH1(content: string): string | null {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

interface NodeCandidate {
  slug: string;
  title: string;
  wikiLinks: string[];
}

// ---------------------------------------------------------------------------
// Build slug → title map from vault files
// ---------------------------------------------------------------------------

function buildVaultMap(): Map<string, NodeCandidate> {
  const map = new Map<string, NodeCandidate>(); // slug (lower) → candidate

  for (const folder of FOLDERS) {
    const dir = path.join(VAULT_ROOT, folder);
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      const slug = slugFromFilename(entry);
      const raw = fs.readFileSync(path.join(dir, entry), 'utf-8');

      // Parse frontmatter body
      const fmMatch = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
      const body = fmMatch ? fmMatch[1] : raw;

      const title = extractH1(body) ?? titleFromSlug(slug);
      const wikiLinks = extractWikiLinks(body);

      map.set(slug.toLowerCase(), { slug, title, wikiLinks });
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// PKM5 API helpers
// ---------------------------------------------------------------------------

async function searchNodeByTitle(title: string): Promise<number | null> {
  const params = new URLSearchParams({ q: title, limit: '5' });
  const res = await fetch(`${RA_H_API}/nodes/search?${params}`);
  if (!res.ok) return null;

  const json = await res.json() as { data?: Array<{ id: number; title: string }> };
  const nodes = json.data ?? [];

  // Exact match first (prefer migrated nodes if duplicates exist — they have higher IDs)
  const exactMatches = nodes.filter(n => n.title.toLowerCase() === title.toLowerCase());
  if (exactMatches.length > 0) return exactMatches[exactMatches.length - 1].id; // highest ID = most recent = migrated

  // Best partial match
  const partial = nodes.find(n =>
    n.title.toLowerCase().includes(title.toLowerCase()) ||
    title.toLowerCase().includes(n.title.toLowerCase())
  );
  return partial?.id ?? null;
}

async function createEdge(sourceId: number, targetId: number, explanation: string): Promise<boolean> {
  const res = await fetch(`${RA_H_API}/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_node_id: sourceId, to_node_id: targetId, relationship: explanation }),
  });
  return res.ok;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('PKM_2026 → PKM5: Edge creation pass');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  if (!DRY_RUN) {
    const health = await fetch(`${RA_H_API}/health`);
    if (!health.ok) { console.error('PKM5 not reachable'); process.exit(1); }
    console.log('✓ PKM5 API reachable');
  }

  const vaultMap = buildVaultMap();
  console.log(`Loaded ${vaultMap.size} vault files`);

  // Cache: target slug → resolved PKM5 node ID
  const idCache = new Map<string, number | null>();

  let edgesCreated = 0;
  let edgesSkipped = 0;
  let edgesFailed = 0;

  for (const [sourceSlug, candidate] of vaultMap) {
    if (candidate.wikiLinks.length === 0) continue;

    // Resolve source node ID
    if (!idCache.has(sourceSlug)) {
      const id = await searchNodeByTitle(candidate.title);
      idCache.set(sourceSlug, id);
    }
    const sourceId = idCache.get(sourceSlug);
    if (!sourceId) {
      edgesSkipped += candidate.wikiLinks.length;
      continue;
    }

    for (const link of candidate.wikiLinks) {
      const linkSlug = link.toLowerCase().replace(/\.md$/, '');

      // Check if target exists in vault
      if (!vaultMap.has(linkSlug)) {
        edgesSkipped++;
        continue;
      }

      const targetCandidate = vaultMap.get(linkSlug)!;

      // Resolve target node ID
      if (!idCache.has(linkSlug)) {
        const id = await searchNodeByTitle(targetCandidate.title);
        idCache.set(linkSlug, id);
        await new Promise(r => setTimeout(r, 30)); // rate limit
      }
      const targetId = idCache.get(linkSlug);

      if (!targetId) {
        edgesSkipped++;
        continue;
      }
      if (sourceId === targetId) continue;

      if (DRY_RUN) {
        console.log(`  [dry] "${candidate.title}" → "${targetCandidate.title}"`);
        edgesCreated++;
        continue;
      }

      const ok = await createEdge(sourceId, targetId, 'wiki-link from migration');
      if (ok) {
        edgesCreated++;
        process.stdout.write('.');
      } else {
        edgesFailed++;
      }
      await new Promise(r => setTimeout(r, 30));
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('Edge creation complete:');
  console.log(`  Created: ${edgesCreated}`);
  console.log(`  Skipped (no match): ${edgesSkipped}`);
  console.log(`  Failed: ${edgesFailed}`);
  if (DRY_RUN) console.log('\n  [DRY RUN — no data was written]');
  console.log('='.repeat(60));
}

main().catch(e => { console.error(e); process.exit(1); });
