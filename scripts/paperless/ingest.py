#!/opt/homebrew/bin/python3
"""
Paperless-ngx → PKM5 full ingestion pipeline.

Modes:
  ingest   — create PKM5 nodes for Paperless docs that have no linked node yet
  enrich   — fetch full OCR text for nodes that have a paperless_id but no OCR content
  orphans  — list Paperless docs with no linked PKM5 node (read-only report)
  all      — run ingest + enrich (default)

Usage:
    python scripts/paperless/ingest.py [--mode ingest|enrich|orphans|all] [--dry-run]

Requirements:
    pip install requests
    Paperless token at ~/.config/pkm/paperless_token
    PKM5 running at http://localhost:3000 (for ingest mode — node/edge creation)
    SSH access to maci (for tunnel to Paperless at maci:8000)
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PKM5_DB = Path.home() / "Library" / "Application Support" / "PKM5" / "db" / "pkm5.sqlite"
PKM5_API = "http://localhost:3000"
PAPERLESS_TUNNEL_PORT = 18000  # local port → maci:8000 via SSH
PAPERLESS_BASE = f"http://localhost:{PAPERLESS_TUNNEL_PORT}"
TOKEN_FILE = Path.home() / ".config" / "pkm" / "paperless_token"
ENRICHED_MARKER = "## Full Document Content (from Paperless)"

# Dimensions that map 1:1 from Paperless tags with "domain:" prefix
VALID_DOMAINS = {
    "admin", "EIT Water", "InnoStars", "HAC26", "BIO-RED",
    "KillerCatch", "MyBoards", "ClaimMore", "InnoMap",
    "family", "health", "hobby", "AI_development", "development",
}


# ---------------------------------------------------------------------------
# Paperless helpers
# ---------------------------------------------------------------------------

def read_token() -> str:
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    # fall back to hardcoded value used by enrich_from_paperless.py
    return "6ca87335cdd33abdadb0dac0aa9e089d3a2879d0"


def open_tunnel() -> subprocess.Popen:
    proc = subprocess.Popen(
        ["ssh", "-N", "-L", f"{PAPERLESS_TUNNEL_PORT}:localhost:8000", "maci"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2.0)
    return proc


def paperless_get(path: str, token: str, params: dict | None = None) -> dict:
    r = requests.get(
        f"{PAPERLESS_BASE}{path}",
        headers={"Authorization": f"Token {token}"},
        params=params or {},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def fetch_all_documents(token: str) -> list[dict]:
    """Fetch all documents from Paperless with pagination."""
    docs: list[dict] = []
    page = 1
    while True:
        data = paperless_get("/api/documents/", token, {"page": page, "page_size": 100})
        docs.extend(data.get("results", []))
        if not data.get("next"):
            break
        page += 1
    return docs


def fetch_all_tags(token: str) -> dict[int, str]:
    """Return {tag_id: tag_name}."""
    data = paperless_get("/api/tags/", token, {"page_size": 200})
    return {t["id"]: t["name"] for t in data.get("results", [])}


def fetch_all_correspondents(token: str) -> dict[int, str]:
    """Return {correspondent_id: correspondent_name}."""
    data = paperless_get("/api/correspondents/", token, {"page_size": 200})
    return {c["id"]: c["name"] for c in data.get("results", [])}


def fetch_document_content(doc_id: int, token: str) -> tuple[str, str]:
    """Return (content, title) for a single document."""
    data = paperless_get(f"/api/documents/{doc_id}/", token)
    return data.get("content", "").strip(), data.get("title", "")


def infer_domain_from_tags(tag_ids: list[int], tag_map: dict[int, str]) -> str | None:
    """Extract domain from tags with 'domain:' prefix."""
    for tid in tag_ids:
        name = tag_map.get(tid, "")
        if name.startswith("domain:"):
            candidate = name[len("domain:"):]
            if candidate in VALID_DOMAINS:
                return candidate
    return None


# ---------------------------------------------------------------------------
# PKM5 SQLite helpers (reads)
# ---------------------------------------------------------------------------

def pkm5_db() -> sqlite3.Connection:
    return sqlite3.connect(PKM5_DB)


def get_linked_paperless_ids(db: sqlite3.Connection) -> dict[int, int]:
    """Return {paperless_id: node_id} for all PKM5 nodes that reference Paperless."""
    cur = db.execute("""
        SELECT id,
               COALESCE(
                   json_extract(metadata, '$.paperless_id'),
                   json_extract(metadata, '$.obsidian.paperless_id')
               ) AS pid
        FROM nodes
        WHERE json_extract(metadata, '$.paperless_id') IS NOT NULL
           OR json_extract(metadata, '$.obsidian.paperless_id') IS NOT NULL
    """)
    result: dict[int, int] = {}
    for node_id, pid in cur.fetchall():
        if pid is not None:
            result[int(pid)] = node_id
    return result


def find_person_node(db: sqlite3.Connection, name: str) -> int | None:
    """Find a person or org node matching the given name (case-insensitive prefix match)."""
    name_lower = name.lower()
    cur = db.execute("""
        SELECT n.id, n.title
        FROM nodes n
        JOIN node_dimensions nd ON nd.node_id = n.id
        WHERE nd.dimension IN ('person', 'org')
        ORDER BY n.id DESC
    """)
    for node_id, title in cur.fetchall():
        if title.lower().startswith(name_lower) or name_lower in title.lower():
            return node_id
    return None


def node_is_enriched(db: sqlite3.Connection, node_id: int) -> bool:
    cur = db.execute("SELECT notes FROM nodes WHERE id = ?", (node_id,))
    row = cur.fetchone()
    if not row:
        return False
    return ENRICHED_MARKER in (row[0] or "")


def get_nodes_needing_enrichment(db: sqlite3.Connection) -> list[dict]:
    """Return nodes that have paperless_id(s) but are not yet enriched."""
    cur = db.execute("""
        SELECT id, title, notes,
               json_extract(metadata, '$.paperless_id')            AS pid_flat,
               json_extract(metadata, '$.paperless_ids')           AS pids_flat,
               json_extract(metadata, '$.obsidian.paperless_id')   AS pid_nested,
               json_extract(metadata, '$.obsidian.paperless_ids')  AS pids_nested
        FROM nodes
        WHERE json_extract(metadata, '$.paperless_id')          IS NOT NULL
           OR json_extract(metadata, '$.paperless_ids')         IS NOT NULL
           OR json_extract(metadata, '$.obsidian.paperless_id') IS NOT NULL
           OR json_extract(metadata, '$.obsidian.paperless_ids') IS NOT NULL
    """)
    rows = []
    for row in cur.fetchall():
        node_id, title, notes, pid_f, pids_f, pid_n, pids_n = row
        ids: list[int] = []
        for val in (pid_f, pid_n):
            if val is not None:
                ids.append(int(val))
        for val in (pids_f, pids_n):
            if val:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    ids.extend(int(x) for x in parsed if isinstance(x, (int, str)))
        if ids:
            rows.append({"id": node_id, "title": title, "notes": notes or "", "paperless_ids": ids})
    return rows


# ---------------------------------------------------------------------------
# PKM5 HTTP API helpers (writes — requires PKM5 server running at :3000)
# ---------------------------------------------------------------------------

def pkm5_api_available() -> bool:
    try:
        r = requests.get(f"{PKM5_API}/api/dimensions", timeout=5)
        return r.status_code < 500
    except Exception:
        return False


def create_pkm5_node(
    title: str,
    dimensions: list[str],
    content: str,
    metadata: dict,
    dry_run: bool,
) -> int | None:
    if dry_run:
        print(f"  [dry-run] would create node: {title!r} dims={dimensions}")
        return None
    payload = {
        "title": title,
        "dimensions": dimensions,
        "notes": content,
        "metadata": metadata,
    }
    r = requests.post(f"{PKM5_API}/api/nodes", json=payload, timeout=30)
    r.raise_for_status()
    body = r.json()
    node_id = (body.get("data") or body).get("id")
    print(f"  Created node ID {node_id}: {title!r}")
    return node_id


def create_pkm5_edge(from_id: int, to_id: int, relationship: str, dry_run: bool) -> None:
    if dry_run:
        print(f"  [dry-run] would create edge {from_id} → {to_id} ({relationship!r})")
        return
    payload = {"from_node_id": from_id, "to_node_id": to_id, "relationship": relationship}
    r = requests.post(f"{PKM5_API}/api/edges", json=payload, timeout=15)
    r.raise_for_status()
    print(f"  Edge {from_id} → {to_id} ({relationship!r})")


# ---------------------------------------------------------------------------
# Enrichment (direct SQLite write — same as enrich_from_paperless.py)
# ---------------------------------------------------------------------------

def enrich_node(db: sqlite3.Connection, node: dict, token: str, dry_run: bool, force: bool) -> bool:
    if not force and ENRICHED_MARKER in node["notes"]:
        return False  # already enriched

    parts: list[str] = []
    for doc_id in node["paperless_ids"]:
        content, pl_title = fetch_document_content(doc_id, token)
        if content:
            parts.append(f"[Paperless doc {doc_id}: {pl_title}]\n\n{content}")
            print(f"    Fetched doc {doc_id}: {len(content)} chars")
        else:
            print(f"    doc {doc_id}: no content")

    if not parts:
        return False

    full = "\n\n---\n\n".join(parts)
    existing = node["notes"].strip()
    separator = f"\n\n---\n\n{ENRICHED_MARKER}\n\n"
    if "## Full Document Content" in existing:
        new_notes = existing.split("## Full Document Content")[0].rstrip() + separator + full
    else:
        new_notes = (existing + separator + full) if existing else (ENRICHED_MARKER + "\n\n" + full)

    if dry_run:
        print(f"  [dry-run] would enrich node {node['id']} ({len(new_notes)} chars total)")
    else:
        db.execute(
            "UPDATE nodes SET notes = ?, chunk_status = 'not_chunked' WHERE id = ?",
            (new_notes, node["id"]),
        )
        db.commit()
        print(f"  Enriched node {node['id']} ({len(new_notes)} chars)")
    return True


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

def mode_orphans(docs: list[dict], linked: dict[int, int], tag_map: dict, correspondent_map: dict) -> None:
    """Print Paperless docs with no PKM5 node."""
    orphans = [d for d in docs if d["id"] not in linked]
    if not orphans:
        print("No orphan documents — all Paperless docs are linked to PKM5 nodes.")
        return

    print(f"\nOrphan documents ({len(orphans)} of {len(docs)} total):\n")
    print(f"{'ID':>4}  {'Date':<12}  {'Correspondent':<20}  {'Domain':<15}  Title")
    print("-" * 90)
    for d in sorted(orphans, key=lambda x: x.get("created", "")):
        corr_id = d.get("correspondent")
        corr = correspondent_map.get(corr_id, "") if corr_id else ""
        domain = infer_domain_from_tags(d.get("tags", []), tag_map) or ""
        created = (d.get("created") or "")[:10]
        print(f"{d['id']:>4}  {created:<12}  {corr:<20}  {domain:<15}  {d['title']}")


def mode_ingest(
    docs: list[dict],
    linked: dict[int, int],
    tag_map: dict[int, str],
    correspondent_map: dict[int, str],
    token: str,
    db: sqlite3.Connection,
    dry_run: bool,
) -> int:
    """Create PKM5 nodes for unlinked Paperless docs. Returns count created."""
    orphans = [d for d in docs if d["id"] not in linked]
    if not orphans:
        print("All Paperless docs are already linked to PKM5 nodes.")
        return 0

    print(f"\nIngesting {len(orphans)} unlinked document(s)...\n")
    created = 0

    for d in orphans:
        doc_id = d["id"]
        title = d["title"]
        created_date = (d.get("created") or "")[:10]
        corr_id = d.get("correspondent")
        corr_name = correspondent_map.get(corr_id, "") if corr_id else ""

        tag_ids = d.get("tags", [])
        domain = infer_domain_from_tags(tag_ids, tag_map)
        tag_names = [tag_map[t] for t in tag_ids if t in tag_map and not tag_map[t].startswith("domain:")]

        print(f"\nDoc {doc_id}: {title!r}")
        print(f"  Date: {created_date}  Correspondent: {corr_name!r}  Domain: {domain!r}")

        # Fetch OCR content upfront so the node has full text on creation
        content, _ = fetch_document_content(doc_id, token)
        if content:
            notes = f"{ENRICHED_MARKER}\n\n[Paperless doc {doc_id}: {title}]\n\n{content}"
        else:
            notes = ""

        metadata: dict = {
            "paperless_id": doc_id,
            "paperless_created": created_date,
        }
        if corr_name:
            metadata["correspondent"] = corr_name
        if tag_names:
            metadata["tags"] = tag_names

        dimensions = ["clipping"]
        if domain:
            dimensions.append(domain)
        dimensions.append("pending")

        node_id = create_pkm5_node(title, dimensions, notes, metadata, dry_run)

        if node_id and not dry_run:
            # Edge to correspondent person/org node
            if corr_name:
                person_id = find_person_node(db, corr_name)
                if person_id:
                    create_pkm5_edge(node_id, person_id, f"from correspondent {corr_name}", dry_run)
                else:
                    print(f"  No person/org node found for correspondent {corr_name!r} — skipping edge")
            created += 1
        elif dry_run:
            created += 1  # count for dry-run reporting

    return created


def mode_enrich(
    db: sqlite3.Connection,
    token: str,
    dry_run: bool,
    force: bool,
) -> int:
    """Enrich PKM5 nodes with full OCR content. Returns count enriched."""
    nodes = get_nodes_needing_enrichment(db)
    if not force:
        nodes = [n for n in nodes if ENRICHED_MARKER not in n["notes"]]

    if not nodes:
        print("All nodes with paperless_id already have full OCR content.")
        return 0

    print(f"\nEnriching {len(nodes)} node(s) with OCR content...\n")
    count = 0
    for node in nodes:
        print(f"Node {node['id']}: {node['title']}")
        if enrich_node(db, node, token, dry_run, force):
            count += 1
    return count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Paperless-ngx → PKM5 ingestion pipeline")
    parser.add_argument(
        "--mode",
        choices=["ingest", "enrich", "orphans", "all"],
        default="all",
        help="Pipeline mode (default: all)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print what would change, don't write")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if already enriched")
    args = parser.parse_args()

    token = read_token()
    do_ingest = args.mode in ("ingest", "all")
    do_enrich = args.mode in ("enrich", "all")
    do_orphans = args.mode == "orphans"

    # Ingest requires PKM5 API
    if do_ingest and not args.dry_run:
        if not pkm5_api_available():
            print("ERROR: PKM5 server not reachable at http://localhost:3000")
            print("Start it with: cd pkm5 && npm run dev")
            print("Or use --mode enrich (which uses direct SQLite and doesn't need the server)")
            sys.exit(1)

    print("Opening SSH tunnel to maci:8000...")
    tunnel = subprocess.Popen(
        ["ssh", "-N", "-L", f"{PAPERLESS_TUNNEL_PORT}:localhost:8000", "maci"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2.0)

    db = sqlite3.connect(PKM5_DB)

    def cleanup(sig=None, frame=None):
        tunnel.terminate()
        db.close()
        print("\nTunnel closed.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)

    try:
        print("Fetching Paperless metadata...")
        tag_map = fetch_all_tags(token)
        correspondent_map = fetch_all_correspondents(token)
        docs = fetch_all_documents(token)
        linked = get_linked_paperless_ids(db)
        print(f"  {len(docs)} Paperless docs, {len(linked)} already linked to PKM5 nodes")

        ingested = 0
        enriched = 0

        if do_orphans:
            mode_orphans(docs, linked, tag_map, correspondent_map)

        if do_ingest:
            ingested = mode_ingest(docs, linked, tag_map, correspondent_map, token, db, args.dry_run)

        if do_enrich:
            enriched = mode_enrich(db, token, args.dry_run, args.force)

        # Summary
        print("\n" + "─" * 50)
        print("Paperless → PKM5 pipeline complete")
        if do_ingest:
            label = "[dry-run] " if args.dry_run else ""
            print(f"  {label}Nodes created: {ingested}")
        if do_enrich:
            label = "[dry-run] " if args.dry_run else ""
            print(f"  {label}Nodes enriched: {enriched}")
        if do_orphans and not do_ingest:
            orphan_count = len([d for d in docs if d["id"] not in linked])
            print(f"  Orphan docs: {orphan_count}")

    finally:
        tunnel.terminate()
        db.close()
        print("Done.")


if __name__ == "__main__":
    main()
