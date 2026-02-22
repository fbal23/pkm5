#!/opt/homebrew/bin/python3
"""
PKM5 Heartbeat — Time-triggered scheduler that surfaces what needs attention.

Replaces Atlas-framework/heartbeat.py. Queries PKM5 SQLite directly instead
of scanning Obsidian markdown files. Runs on the local MacBook (where PKM5
lives), not on Maci.

Modes:
  morning       7am daily — due tasks, today's meetings, unprocessed clippings
  evening       6pm daily — activity count, prompt /daily-review if missing
  overdue       every 30 min — tasks due today not yet complete
  weekly        Monday 9am — nudge if last week's review is missing in PKM5
  monthly       1st of month 9am — nudge if last month's review is missing
  quarterly     1st of quarter 9am — nudge if last quarter's review is missing
  card-proposals 5pm daily — flag stale person/org cards as proposal nodes

Usage:
  python scripts/heartbeat.py --mode morning
  python scripts/heartbeat.py --mode morning --dry-run

Deploy with launchd (not cron) — see scripts/heartbeat-setup.md

Exit codes:
  0  OK
  1  Error
"""

from __future__ import annotations

import argparse
import json
import logging
import sqlite3
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PKM5_DB = Path.home() / "Library" / "Application Support" / "PKM5" / "db" / "pkm5.sqlite"
STATE_FILE = Path.home() / ".config" / "pkm" / "heartbeat_state.json"
LOG_FILE = Path.home() / ".config" / "pkm" / "heartbeat.log"

LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SQLite helpers
# ---------------------------------------------------------------------------

def db() -> sqlite3.Connection:
    con = sqlite3.connect(PKM5_DB)
    con.row_factory = sqlite3.Row
    return con


def query(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    with db() as con:
        return con.execute(sql, params).fetchall()


def scalar(sql: str, params: tuple = ()) -> int | str | None:
    with db() as con:
        row = con.execute(sql, params).fetchone()
        return row[0] if row else None


# ---------------------------------------------------------------------------
# State / rate limiting
# ---------------------------------------------------------------------------

def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str))


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

def notify(message: str, subtitle: str = "", urgent: bool = False) -> None:
    sound = "Basso" if urgent else "Glass"
    safe_msg = message.replace('"', '\\"')
    safe_sub = subtitle.replace('"', '\\"')
    sub_clause = f' subtitle "{safe_sub}"' if safe_sub else ""
    script = (
        f'display notification "{safe_msg}" with title "PKM Heartbeat"'
        f'{sub_clause} sound name "{sound}"'
    )
    try:
        subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
    except Exception as e:
        logger.error(f"Notification failed: {e}")


# ---------------------------------------------------------------------------
# PKM5 queries
# ---------------------------------------------------------------------------

def tasks_due_today() -> list[dict]:
    rows = query("""
        SELECT n.id, n.title,
               json_extract(n.metadata, '$.due') AS due,
               GROUP_CONCAT(nd.dimension, '|') AS dims
        FROM nodes n
        JOIN node_dimensions nd ON nd.node_id = n.id
        WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'task')
          AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
          AND json_extract(n.metadata, '$.due') = date('now')
        GROUP BY n.id
    """)
    return [dict(r) for r in rows]


def tasks_overdue() -> list[dict]:
    rows = query("""
        SELECT n.id, n.title,
               json_extract(n.metadata, '$.due') AS due,
               GROUP_CONCAT(nd.dimension, '|') AS dims
        FROM nodes n
        JOIN node_dimensions nd ON nd.node_id = n.id
        WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'task')
          AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
          AND json_extract(n.metadata, '$.due') < date('now')
          AND json_extract(n.metadata, '$.due') IS NOT NULL
        GROUP BY n.id
        ORDER BY due ASC
        LIMIT 5
    """)
    return [dict(r) for r in rows]


def meetings_today() -> list[dict]:
    rows = query("""
        SELECT n.id, n.title,
               COALESCE(n.event_date, json_extract(n.metadata, '$.date')) AS date
        FROM nodes n
        WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'meeting')
          AND COALESCE(n.event_date, json_extract(n.metadata, '$.date')) = date('now')
    """)
    return [dict(r) for r in rows]


def pending_clippings_count() -> int:
    return scalar("""
        SELECT COUNT(*) FROM nodes
        WHERE id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'clipping')
          AND id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
    """) or 0


def activity_today() -> int:
    """Count nodes created or updated today."""
    return scalar("""
        SELECT COUNT(*) FROM nodes
        WHERE date(created_at) = date('now')
           OR date(updated_at) = date('now')
    """) or 0


def review_exists(title_prefix: str, since_days: int) -> bool:
    """Check if a review node with a given title prefix was created recently."""
    count = scalar("""
        SELECT COUNT(*) FROM nodes
        WHERE title LIKE ?
          AND date(created_at) >= date('now', ? || ' days')
    """, (title_prefix + "%", f"-{since_days}"))
    return (count or 0) > 0


def stale_person_cards(days: int = 90) -> list[dict]:
    """Return person/org nodes not updated in >N days."""
    rows = query("""
        SELECT n.id, n.title,
               json_extract(n.metadata, '$.last') AS last,
               GROUP_CONCAT(nd.dimension, '|') AS dims
        FROM nodes n
        JOIN node_dimensions nd ON nd.node_id = n.id
        WHERE n.id IN (
            SELECT node_id FROM node_dimensions WHERE dimension = 'person'
        )
          AND n.id NOT IN (
            SELECT node_id FROM node_dimensions WHERE dimension = 'archived'
          )
          AND (
            json_extract(n.metadata, '$.last') < date('now', ? || ' days')
            OR json_extract(n.metadata, '$.last') IS NULL
          )
        GROUP BY n.id
        ORDER BY last ASC NULLS FIRST
        LIMIT 20
    """, (f"-{days}",))
    return [dict(r) for r in rows]


def proposal_already_exists(title: str) -> bool:
    count = scalar("""
        SELECT COUNT(*) FROM nodes
        WHERE title = ?
          AND id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'proposal')
          AND id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
    """, (title,))
    return (count or 0) > 0


def create_proposal_node(title: str, notes: str) -> None:
    """Write a card-update proposal directly to PKM5 SQLite."""
    with db() as con:
        now = datetime.utcnow().isoformat()
        cur = con.execute(
            """INSERT INTO nodes (title, notes, metadata, created_at, updated_at, chunk_status)
               VALUES (?, ?, '{}', ?, ?, 'not_chunked')""",
            (title, notes, now, now),
        )
        node_id = cur.lastrowid
        for dim in ("proposal", "pending", "admin"):
            con.execute(
                "INSERT INTO node_dimensions (node_id, dimension) VALUES (?, ?)",
                (node_id, dim),
            )
        con.commit()
    logger.info(f"  Created proposal node {node_id}: {title!r}")


# ---------------------------------------------------------------------------
# Mode handlers
# ---------------------------------------------------------------------------

def mode_morning(dry_run: bool) -> int:
    logger.info("Mode: morning")
    t = tasks_due_today()
    m = meetings_today()
    c = pending_clippings_count()

    parts = []
    if t:
        parts.append(f"{len(t)} task{'s' if len(t) != 1 else ''} due today")
    if m:
        parts.append(f"{len(m)} meeting{'s' if len(m) != 1 else ''} scheduled")
    if c:
        parts.append(f"{c} unprocessed clipping{'s' if c != 1 else ''}")

    if not parts:
        logger.info("OK: nothing urgent this morning")
        return 0

    message = " · ".join(parts)
    logger.info(f"Morning brief: {message}")
    if not dry_run:
        notify(message, subtitle="Open pkm5 to review")
    return 0


def mode_evening(dry_run: bool) -> int:
    logger.info("Mode: evening")
    activity = activity_today()

    # Check for today's review note
    today = datetime.now().strftime("%Y-%m-%d")
    has_review = review_exists(f"Daily Review — {today}", since_days=1)

    parts = []
    if activity:
        parts.append(f"{activity} node{'s' if activity != 1 else ''} touched today")

    subtitle = ""
    if not has_review:
        parts.append("No daily review yet — run /daily-review")
        subtitle = "Reflect on the day"

    if not parts:
        logger.info("OK: quiet day, review exists")
        return 0

    message = " · ".join(parts)
    logger.info(f"Evening digest: {message}")
    if not dry_run:
        notify(message, subtitle=subtitle)
    return 0


def mode_overdue(dry_run: bool) -> int:
    logger.info("Mode: overdue")
    tasks = tasks_overdue()

    if not tasks:
        logger.info("OK: no overdue tasks")
        return 0

    # Rate limit: don't re-notify the same task within 4 hours
    state = load_state()
    notified = state.get("notified_tasks", {})
    now = datetime.now()

    to_notify = []
    for t in tasks:
        key = str(t["id"])
        last = notified.get(key)
        if last and now - datetime.fromisoformat(last) < timedelta(hours=4):
            continue
        to_notify.append(t)
        notified[key] = now.isoformat()

    if not to_notify:
        logger.info("OK: already notified recently")
        return 0

    state["notified_tasks"] = notified
    save_state(state)

    first = to_notify[0]
    extra = f" (+{len(to_notify) - 1} more)" if len(to_notify) > 1 else ""
    message = f"Overdue: {first['title']}{extra}"
    logger.info(f"Overdue alert: {message}")
    if not dry_run:
        notify(message, subtitle=f"Due: {first['due']}", urgent=True)
    return 0


def mode_weekly(dry_run: bool) -> int:
    logger.info("Mode: weekly")
    # Look for any weekly review created in the last 10 days
    if review_exists("Weekly Review —", since_days=10):
        logger.info("OK: weekly review exists")
        return 0

    now = datetime.now()
    week = now.isocalendar()[1]
    message = f"Weekly review due — W{week:02d}"
    logger.info(f"Weekly nudge: {message}")
    if not dry_run:
        notify(message, subtitle="Run /weekly-review to synthesize")
    return 0


def mode_monthly(dry_run: bool) -> int:
    logger.info("Mode: monthly")
    if review_exists("Monthly Review —", since_days=35):
        logger.info("OK: monthly review exists")
        return 0

    month = (datetime.now() - timedelta(days=1)).strftime("%B %Y")
    message = f"Monthly review due — {month}"
    logger.info(f"Monthly nudge: {message}")
    if not dry_run:
        notify(message, subtitle="Run /monthly-review to distill")
    return 0


def mode_quarterly(dry_run: bool) -> int:
    logger.info("Mode: quarterly")
    if review_exists("Quarterly Review —", since_days=100):
        logger.info("OK: quarterly review exists")
        return 0

    now = datetime.now()
    q = (now.month - 1) // 3
    last_q = q if q > 0 else 4
    last_y = now.year if q > 0 else now.year - 1
    message = f"Quarterly review due — Q{last_q} {last_y}"
    logger.info(f"Quarterly nudge: {message}")
    if not dry_run:
        notify(message, subtitle="Run /quarterly-review to reflect")
    return 0


def mode_card_proposals(dry_run: bool) -> int:
    logger.info("Mode: card-proposals")
    stale = stale_person_cards(days=90)

    if not stale:
        logger.info("OK: no stale person cards")
        return 0

    created = 0
    for card in stale:
        last = card["last"] or "never"
        title = f"PROPOSAL: Update card for {card['title']}"
        if proposal_already_exists(title):
            logger.info(f"  Skipping (proposal exists): {card['title']}")
            continue
        notes = (
            f"Person/org card not updated since: {last}\n\n"
            f"Node ID: {card['id']}\n\n"
            f"Actions:\n"
            f"- Review recent meetings/clippings mentioning this person\n"
            f"- Update metadata.last with most recent interaction date\n"
            f"- Update metadata.role if changed\n"
            f"- Increment metadata.cited if relevant\n"
        )
        if not dry_run:
            create_proposal_node(title, notes)
        else:
            logger.info(f"  [dry-run] would create proposal: {title!r}")
        created += 1

    if created == 0:
        logger.info("OK: all proposals already exist")
        return 0

    message = f"{created} stale card proposal{'s' if created != 1 else ''} created"
    logger.info(f"Card proposals: {message}")
    if not dry_run:
        notify(message, subtitle="Run /card-updates to review")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

MODES = {
    "morning": mode_morning,
    "evening": mode_evening,
    "overdue": mode_overdue,
    "weekly": mode_weekly,
    "monthly": mode_monthly,
    "quarterly": mode_quarterly,
    "card-proposals": mode_card_proposals,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="PKM5 Heartbeat scheduler")
    parser.add_argument("--mode", required=True, choices=list(MODES))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    logger.info(f"=== Heartbeat: {args.mode} {'(dry-run) ' if args.dry_run else ''}===")
    try:
        code = MODES[args.mode](dry_run=args.dry_run)
        logger.info(f"=== Done (exit {code}) ===")
        return code
    except Exception as e:
        logger.exception(f"Heartbeat failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
