#!/bin/bash
# Cheap gate for the rule-9/rule-11 agent verifier hook.
#
# Why this exists: a "type": "agent" hook still costs a real agent turn
# every time it fires, even if it finds nothing. Manifesto rules 9 (no
# magic strings / unverified routes) and 11 (cross-cutting consumers) only
# ever matter for a small slice of commits — this script decides, with
# plain grep against the real staged diff, whether that slice applies at
# all. If it prints exactly "NOTHING_RELEVANT", the agent hook is
# instructed to stop immediately without reading anything else.
#
# Deliberately dumb on purpose: false positives here just cost one cheap
# agent turn that clears itself; false negatives would silently skip the
# real check. So this errs toward flagging, and leaves all judgment about
# whether a flagged change is *actually* a violation to the agent step.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/home/user/Pharmacare-April11-Claude-push}"
cd "$PROJECT_DIR" || { echo "NOTHING_RELEVANT"; exit 0; }

STAGED_FILES="$(git diff --cached --name-only 2>/dev/null)"
if [ -z "$STAGED_FILES" ]; then
  echo "NOTHING_RELEVANT"
  exit 0
fi

FOUND=0
REPORT=""

# ── 1. Changes to a cross-cutting backend router (docs/08_ARCHITECTURE.md
#      "Cross-cutting consumers map") ───────────────────────────────────
CROSS_CUTTING_FILES="backend/routers/billing.py backend/routers/purchases.py backend/routers/sales_returns.py backend/routers/purchase_returns.py backend/routers/reports.py backend/routers/inventory.py backend/routers/customers.py backend/routers/suppliers.py"
HIT_FILES=""
for f in $CROSS_CUTTING_FILES; do
  if echo "$STAGED_FILES" | grep -qxF "$f"; then
    HIT_FILES="$HIT_FILES $f"
  fi
done
if [ -n "$HIT_FILES" ]; then
  FOUND=1
  REPORT="$REPORT
=== Cross-cutting router file(s) touched:$HIT_FILES ===
$(git diff --cached -- $HIT_FILES)
"
fi

# ── 2. New frontend API calls (added lines only) ────────────────────────
NEW_API_CALLS="$(git diff --cached -- 'frontend/src/**/*.js' 'frontend/src/**/*.jsx' 'frontend/src/**/*.ts' 'frontend/src/**/*.tsx' 2>/dev/null | grep -E '^\+[^+].*\b(axios|api)\.(get|post|put|patch|delete)\(')"
if [ -n "$NEW_API_CALLS" ]; then
  FOUND=1
  REPORT="$REPORT
=== New/changed frontend API calls (verify each route actually exists in backend/routers or docs/10_API.md) ===
$NEW_API_CALLS
"
fi

# ── 3. New hardcoded status-like string literals ────────────────────────
NEW_MAGIC_STRINGS="$(git diff --cached -- 'frontend/src/**/*.js' 'frontend/src/**/*.jsx' 'frontend/src/**/*.ts' 'frontend/src/**/*.tsx' 'backend/**/*.py' 2>/dev/null | grep -E "^\+[^+]" | grep -E "(status|state)['\"]?[[:space:]]*(===|==|:|=)[[:space:]]*['\"][a-z_-]+['\"]" | grep -vF "domainConstants.js")"
if [ -n "$NEW_MAGIC_STRINGS" ]; then
  FOUND=1
  REPORT="$REPORT
=== New hardcoded status/state string literal(s) (verify each is defined in constants/domainConstants.js or the backend's equivalent, not typed inline) ===
$NEW_MAGIC_STRINGS
"
fi

if [ "$FOUND" -eq 0 ]; then
  echo "NOTHING_RELEVANT"
  exit 0
fi

echo "$REPORT"
exit 0
