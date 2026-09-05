#!/bin/bash
# PharmaCare session-start reliability hook.
#
# Why this exists: the dev container periodically resets and kills
# Postgres, the backend (uvicorn), and/or the frontend (npm start), and
# sometimes wipes node_modules — forcing a manual restart dance at the
# start of every session. This hook runs that recovery automatically so
# no session has to start broken. Added September 5, 2026 — see
# CLAUDE.md's WORKFLOW AGREEMENT for why.
#
# Safe by design: every step is read-only-check-first, only takes action
# when something is actually missing/stopped, and never touches git state
# or uncommitted work.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/home/user/Pharmacare-April11-Claude-push}"
BACKEND="$PROJECT_DIR/backend"
FRONTEND="$PROJECT_DIR/frontend"
LOG="/tmp/pharmacare-session-start.log"
: > "$LOG"

say() { echo "$1"; echo "$1" >> "$LOG"; }

say "PharmaCare environment check:"

# ── 1. Postgres ──────────────────────────────────────────────────────────
if pg_lsclusters 2>/dev/null | grep -q "16 *main.*online"; then
  say "  [OK] Database was already running."
else
  say "  [FIX] Database was stopped — starting it..."
  pg_ctlcluster 16 main start >> "$LOG" 2>&1
  sleep 2
  if pg_lsclusters 2>/dev/null | grep -q "16 *main.*online"; then
    say "  [OK] Database is now running."
  else
    say "  [FAIL] Could not start the database automatically — see $LOG"
  fi
fi

# ── 2. Migrations ────────────────────────────────────────────────────────
if [ -x "$BACKEND/venv/bin/alembic" ]; then
  cd "$BACKEND"
  CURRENT_REV=$(venv/bin/alembic current 2>/dev/null | head -1 | awk '{print $1}')
  HEAD_REV=$(venv/bin/alembic heads 2>/dev/null | head -1 | awk '{print $1}')
  if [ -n "$CURRENT_REV" ] && [ "$CURRENT_REV" = "$HEAD_REV" ]; then
    say "  [OK] Database schema is up to date."
  else
    say "  [FIX] Database schema is behind — running migrations..."
    venv/bin/alembic upgrade head >> "$LOG" 2>&1
    say "  [OK] Migrations applied."
  fi
else
  say "  [SKIP] Backend virtual environment not found yet (first run?) — see $LOG"
fi

# ── 3. Backend (uvicorn on :8000) ────────────────────────────────────────
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs 2>/dev/null | grep -q "200"; then
  say "  [OK] Backend server was already running."
else
  say "  [FIX] Backend server was stopped — starting it..."
  cd "$BACKEND"
  nohup venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/pharmacare-backend.log 2>&1 &
  disown
  sleep 3
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs 2>/dev/null | grep -q "200"; then
    say "  [OK] Backend server is now running."
  else
    say "  [WAIT] Backend is still starting — check /tmp/pharmacare-backend.log if it doesn't come up in a few seconds."
  fi
fi

# ── 4. Frontend dependencies ─────────────────────────────────────────────
if [ -d "$FRONTEND/node_modules" ] && [ -f "$FRONTEND/node_modules/.package-lock.json" ]; then
  say "  [OK] Frontend packages are installed."
else
  say "  [FIX] Frontend packages are missing or incomplete — installing (can take a minute)..."
  cd "$FRONTEND"
  npm install --legacy-peer-deps >> "$LOG" 2>&1
  say "  [OK] Frontend packages installed."
fi

# ── 5. Frontend dev server (:3000) ───────────────────────────────────────
if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
  say "  [OK] Frontend server was already running."
else
  say "  [FIX] Frontend server was stopped — starting it..."
  cd "$FRONTEND"
  nohup npm start > /tmp/pharmacare-frontend.log 2>&1 &
  disown
  say "  [WAIT] Frontend is starting in the background (usually 20-30s) — check /tmp/pharmacare-frontend.log."
fi

say ""
say "Done. Full details logged to $LOG."
