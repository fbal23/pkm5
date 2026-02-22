#!/bin/bash
# create_pkm_dimensions.sh
#
# Create all PKM dimensions in RA-H via the HTTP API.
# Run once after RA-H is started (npm run dev).
#
# Usage: bash scripts/migrate/create_pkm_dimensions.sh [--dry-run]

set -e

RA_H_API="http://localhost:3000/api"
DRY_RUN="${1}"

create_dimension() {
  local name="$1"
  local description="$2"

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "[dry-run] Would create dimension: $name"
    return
  fi

  response=$(curl -s -w "\n%{http_code}" -X POST "$RA_H_API/dimensions" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$name\", \"description\": \"$description\"}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "  ✓ Created: $name"
  elif [ "$http_code" = "409" ]; then
    echo "  · Exists:  $name (skipped)"
  else
    echo "  ✗ Failed:  $name (HTTP $http_code) — $body"
  fi
}

echo "========================================"
echo "Creating PKM dimensions in RA-H"
echo "API: $RA_H_API"
[ "$DRY_RUN" = "--dry-run" ] && echo "Mode: DRY RUN"
echo "========================================"

# Check RA-H is running
if [ "$DRY_RUN" != "--dry-run" ]; then
  if ! curl -sf "$RA_H_API/health" > /dev/null 2>&1; then
    echo "✗ RA-H API not reachable. Start with: npm run dev"
    exit 1
  fi
  echo "✓ RA-H API reachable"
fi

echo ""
echo "── Domain dimensions ────────────────────"
create_dimension "admin"          "Administrative work, tools, infrastructure, personal setup"
create_dimension "EIT Water"      "EIT Water project and consortium activities"
create_dimension "InnoStars"      "InnoStars programme activities"
create_dimension "HAC26"          "HAC26 project"
create_dimension "BIO-RED"        "BIO-RED research project"
create_dimension "KillerCatch"    "KillerCatch project"
create_dimension "MyBoards"       "MyBoards product"
create_dimension "ClaimMore"      "ClaimMore project"
create_dimension "InnoMap"        "InnoMap project"
create_dimension "family"         "Personal family matters"
create_dimension "health"         "Health and wellbeing"
create_dimension "hobby"          "Hobbies and personal interests"
create_dimension "AI_development" "AI tools, Claude, LLM workflows, PKM infrastructure"
create_dimension "development"    "Software development, code, infrastructure"

echo ""
echo "── Entity type dimensions ───────────────"
create_dimension "task"       "A discrete piece of work with a potential due date"
create_dimension "project"    "A multi-task effort with an outcome"
create_dimension "meeting"    "A recorded meeting with attendees and discussion"
create_dimension "commitment" "A promise made to or by someone, with a due date"
create_dimension "person"     "A person entity card"
create_dimension "org"        "An organisation entity card"
create_dimension "clipping"   "Captured external content — email, article, document"
create_dimension "idea"       "An observation, hypothesis, or insight"

echo ""
echo "── Status dimensions ────────────────────"
create_dimension "pending"  "Not yet started"
create_dimension "active"   "Currently in progress"
create_dimension "complete" "Done"
create_dimension "archived" "Historical, no longer active"

echo ""
echo "── Memory / system dimensions ───────────"
create_dimension "insight"    "A proven, reusable lesson (replaces MEMORY.md entries)"
create_dimension "proposal"   "A card-update or action proposal awaiting review"
create_dimension "memory-log" "Timestamped memory log entry"

echo ""
echo "========================================"
echo "Done. All PKM dimensions created."
echo "Next: run migration script:"
echo "  npx ts-node scripts/migrate/import_pkm2026.ts --dry-run"
echo "========================================"
