#!/usr/bin/env tsx
/**
 * Obsidian Vault → RA-OS Migration Script
 *
 * Two-pass migration:
 *   Pass 1 — Create all nodes from markdown files
 *   Pass 2 — Resolve [[wikilinks]] and frontmatter refs into edges
 *
 * Usage:
 *   npx tsx scripts/migrate-obsidian.ts --vault /path/to/vault [options]
 *
 * Options:
 *   --vault <path>        Path to Obsidian vault root (required)
 *   --base-url <url>      RA-OS base URL (default: http://localhost:3000)
 *   --dirs <dirs>         Comma-separated subdirs to scan
 *                         (default: notes,clippings,references,daily)
 *   --include-root-docs   Also import root-level .md files from vault
 *   --skip-edges          Skip edge creation (Pass 2)
 *   --dry-run             Print what would be created; no API calls
 *   --delay <ms>          Delay between node API calls in ms (default: 150)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import matter from 'gray-matter';
import { parseArgs } from 'util';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedNote {
  filePath: string;
  slug: string;          // filename without .md, used for wikilink resolution
  title: string;
  type: string;          // RA-OS node type
  notes: string;         // markdown body (displayed in UI)
  chunk: string;         // same body, for embedding
  eventDate?: string;    // ISO date
  dimensions: string[];  // tags + domain
  metadata: Record<string, unknown>;
  wikilinks: string[];   // resolved slugs found in body + frontmatter
}

interface CreatedNode {
  nodeId: number;
  title: string;
  slug: string;
}

interface MigrationStats {
  filesScanned: number;
  nodesCreated: number;
  nodesSkipped: number;
  nodesFailed: number;
  edgesCreated: number;
  edgesSkipped: number;   // already existed
  edgesFailed: number;
  unresolvedWikilinks: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a file slug to a human-readable title */
function slugToTitle(slug: string): string {
  // Strip trailing date suffix like -2026-02-11
  const withoutDate = slug.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  return withoutDate
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Strip [[wikilink]] and [[slug|label]] syntax from a title string */
function stripWikilinks(text: string): string {
  // [[slug|label]] → label
  // [[slug]]       → slug (humanised)
  return text
    .replace(/\[\[([^\]|\\]+)[\\|]([^\]]+)\]\]/g, (_, _slug, label) => label.trim())
    .replace(/\[\[([^\]]+)\]\]/g, (_, slug) => slugToTitle(slug))
    .trim();
}

/** Extract text of the first H1 heading from markdown body */
function extractH1(body: string): string | null {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Normalise a wikilink target to a slug:
 *   "EIT Water"  → "eit-water"
 *   "hero-prins" → "hero-prins"
 */
function wikilinkToSlug(target: string): string {
  return target.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Extract all wikilink targets from a string.
 * Handles:  [[slug]]  [[slug|label]]  [[slug\|label]]
 */
function extractWikilinks(text: string): string[] {
  const slugs: string[] = [];
  // Match [[...]] — capture everything up to first | or \| or ]]
  const re = /\[\[([^\]|\\]+?)(?:[\\|][^\]]+?)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const slug = wikilinkToSlug(m[1]);
    if (slug) slugs.push(slug);
  }
  return slugs;
}

/**
 * Extract wikilinks from a frontmatter value that may be:
 *   - a string: "[[slug|Label]]"
 *   - an array: ["[[slug|Label]]", ...]
 */
function extractFrontmatterWikilinks(value: unknown): string[] {
  if (typeof value === 'string') return extractWikilinks(value);
  if (Array.isArray(value)) {
    return value.flatMap(v => (typeof v === 'string' ? extractWikilinks(v) : []));
  }
  return [];
}

/** Map Obsidian frontmatter `type` to a RA-OS node type */
function mapType(obsidianType: string | undefined): string {
  switch (obsidianType) {
    case 'person':     return 'person';
    case 'org':        return 'org';
    case 'task':       return 'task';
    case 'idea':       return 'idea';
    default:           return 'note';
  }
}

/** Sleep for `ms` milliseconds */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

function parseMarkdownFile(filePath: string): ParsedNote | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    // Malformed YAML frontmatter — treat the whole file as plain body, no frontmatter
    parsed = { data: {}, content: raw, matter: '', stringify: () => raw } as unknown as matter.GrayMatterFile<string>;
  }
  const { data: fm, content: body } = parsed;

  const slug = basename(filePath, '.md');

  // --- Title ---
  let title: string;
  if (fm.type === 'person' || fm.type === 'org') {
    const aliases = fm.aliases;
    if (Array.isArray(aliases) && aliases.length > 0 && typeof aliases[0] === 'string') {
      title = aliases[0];
    } else if (typeof aliases === 'string') {
      title = aliases;
    } else {
      title = extractH1(body) ?? slugToTitle(slug);
    }
  } else {
    title = extractH1(body) ?? slugToTitle(slug);
  }
  title = stripWikilinks(title);

  // --- Type ---
  const type = mapType(typeof fm.type === 'string' ? fm.type : undefined);

  // --- Event date ---
  let eventDate: string | undefined;
  if (type === 'task' && fm.due) {
    eventDate = String(fm.due);
  } else if (fm.date) {
    eventDate = String(fm.date);
  } else if (fm.created && (type === 'note') && slug.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Daily note
    eventDate = String(fm.created);
  }

  // --- Dimensions ---
  const dimensions: string[] = [];
  if (typeof fm.domain === 'string' && fm.domain) {
    dimensions.push(fm.domain.toLowerCase().replace(/\s+/g, '-'));
  }
  if (Array.isArray(fm.tags)) {
    for (const t of fm.tags) {
      if (typeof t === 'string' && t) dimensions.push(t.toLowerCase());
    }
  }
  // Add obsidian type as a dimension for easy filtering
  if (typeof fm.type === 'string' && fm.type) {
    dimensions.push(fm.type.toLowerCase());
  }

  // --- Metadata (store full frontmatter) ---
  const metadata: Record<string, unknown> = {
    source: 'obsidian_import',
    obsidian: { ...fm },
    imported_at: new Date().toISOString(),
  };

  // --- Wikilinks (body + frontmatter relational fields) ---
  const wikilinks = new Set<string>(extractWikilinks(body));

  // Frontmatter fields that can contain wikilinks
  for (const field of ['attendees', 'org', 'capture-note']) {
    if (fm[field] !== undefined) {
      for (const s of extractFrontmatterWikilinks(fm[field])) {
        wikilinks.add(s);
      }
    }
  }

  // Remove self-reference
  wikilinks.delete(slug);

  return {
    filePath,
    slug,
    title,
    type,
    notes: body.trim(),
    chunk: body.trim(),
    eventDate,
    dimensions: [...new Set(dimensions)],
    metadata,
    wikilinks: [...wikilinks],
  };
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function discoverFiles(vaultPath: string, dirs: string[], includeRootDocs: boolean): string[] {
  const files: string[] = [];

  // Subdirectories
  for (const dir of dirs) {
    const dirPath = join(vaultPath, dir);
    if (!existsSync(dirPath)) {
      console.warn(`  [WARN] Directory not found, skipping: ${dirPath}`);
      continue;
    }
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      if (extname(entry) === '.md') {
        files.push(join(dirPath, entry));
      }
    }
  }

  // Root-level docs
  if (includeRootDocs) {
    const SKIP_ROOT = new Set(['README.md', 'CLAUDE.md', 'CHANGELOG.md', 'hook.md']);
    const entries = readdirSync(vaultPath);
    for (const entry of entries) {
      if (
        extname(entry) === '.md' &&
        !SKIP_ROOT.has(entry) &&
        statSync(join(vaultPath, entry)).isFile()
      ) {
        files.push(join(vaultPath, entry));
      }
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function createNode(
  note: ParsedNote,
  baseUrl: string,
  dryRun: boolean
): Promise<number | null> {
  if (dryRun) {
    console.log(`  [DRY-RUN] Would create node: "${note.title}" (${note.type})`);
    return Math.floor(Math.random() * 100000); // fake ID for dry-run edge simulation
  }

  const body: Record<string, unknown> = {
    title: note.title,
    type: note.type,
    notes: note.notes,
    chunk: note.chunk,
    dimensions: note.dimensions,
    metadata: note.metadata,
  };
  if (note.eventDate) body.event_date = note.eventDate;

  const res = await fetch(`${baseUrl}/api/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(err.error ?? `HTTP ${res.status}`));
  }

  const json = await res.json() as { success: boolean; data?: { id: number }; error?: string };
  if (!json.success || !json.data?.id) {
    throw new Error(json.error ?? 'No node ID returned');
  }
  return json.data.id;
}

async function createEdge(
  fromId: number,
  toId: number,
  explanation: string,
  baseUrl: string,
  dryRun: boolean
): Promise<'created' | 'exists' | 'error'> {
  if (dryRun) {
    console.log(`  [DRY-RUN] Would create edge: ${fromId} → ${toId} (${explanation})`);
    return 'created';
  }

  const res = await fetch(`${baseUrl}/api/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_node_id: fromId,
      to_node_id: toId,
      explanation,
      source: 'user',
      created_via: 'workflow',
      skip_inference: false,
    }),
  });

  if (res.status === 200) return 'exists';
  if (res.status === 201) return 'created';

  const err = await res.json().catch(() => ({})) as Record<string, unknown>;
  throw new Error(String(err.error ?? `HTTP ${res.status}`));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { values: args } = parseArgs({
    options: {
      vault:              { type: 'string' },
      'base-url':         { type: 'string', default: 'http://localhost:3000' },
      dirs:               { type: 'string', default: 'notes,clippings,references,daily' },
      'include-root-docs':{ type: 'boolean', default: false },
      'skip-edges':       { type: 'boolean', default: false },
      'dry-run':          { type: 'boolean', default: false },
      delay:              { type: 'string', default: '150' },
    },
    strict: false,
  });

  const vaultPath = args.vault as string | undefined;
  if (!vaultPath) {
    console.error('Error: --vault <path> is required');
    process.exit(1);
  }
  if (!existsSync(vaultPath as string)) {
    console.error(`Error: vault path does not exist: ${vaultPath}`);
    process.exit(1);
  }

  const resolvedVault = vaultPath as string;
  const baseUrl    = (args['base-url'] as string).replace(/\/$/, '');
  const dirs       = (args.dirs as string).split(',').map(d => d.trim()).filter(Boolean);
  const includeRoot = Boolean(args['include-root-docs']);
  const skipEdges  = Boolean(args['skip-edges']);
  const dryRun     = Boolean(args['dry-run']);
  const delay      = parseInt(args.delay as string, 10) || 150;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' Obsidian → RA-OS Migration');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Vault:       ${resolvedVault}`);
  console.log(`  Target:      ${baseUrl}`);
  console.log(`  Dirs:        ${dirs.join(', ')}${includeRoot ? ' + root docs' : ''}`);
  console.log(`  Skip edges:  ${skipEdges}`);
  console.log(`  Dry run:     ${dryRun}`);
  console.log(`  API delay:   ${delay}ms`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ------------------------------------------------------------------
  // Discover + parse all files
  // ------------------------------------------------------------------
  console.log('▶ Discovering files…');
  const filePaths = discoverFiles(resolvedVault, dirs, includeRoot);
  console.log(`  Found ${filePaths.length} markdown files\n`);

  const notes: ParsedNote[] = [];
  let parseErrors = 0;
  for (const fp of filePaths) {
    const parsed = parseMarkdownFile(fp);
    if (parsed) {
      notes.push(parsed);
    } else {
      console.warn(`  [WARN] Could not parse: ${fp}`);
      parseErrors++;
    }
  }
  console.log(`  Parsed: ${notes.length} notes (${parseErrors} parse errors)\n`);

  // ------------------------------------------------------------------
  // Pass 1 — Create nodes
  // ------------------------------------------------------------------
  console.log('▶ Pass 1 — Creating nodes…');
  const stats: MigrationStats = {
    filesScanned: notes.length,
    nodesCreated: 0,
    nodesSkipped: 0,
    nodesFailed: 0,
    edgesCreated: 0,
    edgesSkipped: 0,
    edgesFailed: 0,
    unresolvedWikilinks: [],
  };

  // slug → created node (for wikilink resolution in pass 2)
  const slugMap = new Map<string, CreatedNode>();

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const progress = `[${String(i + 1).padStart(3)}/${notes.length}]`;

    try {
      const nodeId = await createNode(note, baseUrl, dryRun);
      if (nodeId !== null) {
        slugMap.set(note.slug, { nodeId, title: note.title, slug: note.slug });
        stats.nodesCreated++;
        console.log(`  ${progress} ✓ "${note.title}" (${note.type}) → id:${nodeId}`);
      }
    } catch (err) {
      stats.nodesFailed++;
      console.error(`  ${progress} ✗ "${note.title}" — ${err instanceof Error ? err.message : err}`);
    }

    if (!dryRun && i < notes.length - 1) await sleep(delay);
  }

  console.log(`\n  Pass 1 complete: ${stats.nodesCreated} created, ${stats.nodesFailed} failed\n`);

  // ------------------------------------------------------------------
  // Pass 2 — Create edges from wikilinks
  // ------------------------------------------------------------------
  if (!skipEdges) {
    console.log('▶ Pass 2 — Creating edges from wikilinks…');

    // Deduplicate edges: track (from,to) pairs we've already submitted
    const edgesAttempted = new Set<string>();

    for (const note of notes) {
      const fromNode = slugMap.get(note.slug);
      if (!fromNode) continue; // node wasn't created, skip

      if (note.wikilinks.length === 0) continue;

      for (const targetSlug of note.wikilinks) {
        const toNode = slugMap.get(targetSlug);

        if (!toNode) {
          // Only log each unresolved slug once
          if (!stats.unresolvedWikilinks.includes(targetSlug)) {
            stats.unresolvedWikilinks.push(targetSlug);
          }
          continue;
        }

        const pairKey = `${fromNode.nodeId}:${toNode.nodeId}`;
        if (edgesAttempted.has(pairKey)) continue;
        edgesAttempted.add(pairKey);

        const explanation = buildEdgeExplanation(note, targetSlug, toNode.title);

        try {
          const result = await createEdge(fromNode.nodeId, toNode.nodeId, explanation, baseUrl, dryRun);
          if (result === 'created') {
            stats.edgesCreated++;
            console.log(`  ✓ edge: "${note.title}" → "${toNode.title}"`);
          } else {
            stats.edgesSkipped++;
          }
        } catch (err) {
          stats.edgesFailed++;
          console.error(`  ✗ edge "${note.title}" → "${toNode.title}": ${err instanceof Error ? err.message : err}`);
        }

        if (!dryRun) await sleep(Math.max(50, delay / 3));
      }
    }

    console.log(
      `\n  Pass 2 complete: ${stats.edgesCreated} created, ` +
      `${stats.edgesSkipped} already existed, ${stats.edgesFailed} failed`
    );
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' Migration Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Files scanned:        ${stats.filesScanned}`);
  console.log(`  Nodes created:        ${stats.nodesCreated}`);
  console.log(`  Nodes failed:         ${stats.nodesFailed}`);
  if (!skipEdges) {
    console.log(`  Edges created:        ${stats.edgesCreated}`);
    console.log(`  Edges already existed:${stats.edgesSkipped}`);
    console.log(`  Edges failed:         ${stats.edgesFailed}`);
  }

  if (stats.unresolvedWikilinks.length > 0) {
    console.log(`\n  Unresolved wikilinks (${stats.unresolvedWikilinks.length}):`);
    for (const slug of stats.unresolvedWikilinks.sort()) {
      console.log(`    [[${slug}]]`);
    }
    console.log('\n  Tip: unresolved links point to files outside the scanned dirs.');
    console.log('  Re-run with a broader --dirs value to resolve more of them.');
  }

  console.log('\n  Done.\n');
}

// ---------------------------------------------------------------------------
// Edge explanation builder
// ---------------------------------------------------------------------------

function buildEdgeExplanation(note: ParsedNote, targetSlug: string, targetTitle: string): string {
  const fm = note.metadata.obsidian as Record<string, unknown>;

  // Attendees field → person attended this meeting
  const attendees = fm.attendees as unknown;
  if (attendees) {
    const attendeeSlugs = extractFrontmatterWikilinks(attendees);
    if (attendeeSlugs.includes(targetSlug)) {
      return `${targetTitle} attended "${note.title}"`;
    }
  }

  // Org field on a person → member of org
  if (note.type === 'person' && fm.org) {
    const orgSlugs = extractFrontmatterWikilinks(fm.org);
    if (orgSlugs.includes(targetSlug)) {
      return `${note.title} is a member of ${targetTitle}`;
    }
  }

  // Default
  return `"${note.title}" references ${targetTitle}`;
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
