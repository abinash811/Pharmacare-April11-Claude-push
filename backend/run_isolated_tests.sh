#!/bin/bash
# Runs backend/tests/ against a dedicated, always-reset test database and a
# throwaway backend instance on port 8001 — never the shared dev database
# (`pharmacare`, port 8000) used for day-to-day manual development.
#
# Why this exists: backend/tests/ (all HTTP integration tests) used to run
# against that same shared dev database, with nothing ever resetting it —
# every test run's fake products/purchases/etc. just accumulated forever.
# By Sep 19, 2026 that had reached 10,202 fake products, which made
# GET /inventory/reorder-list too slow to use and once caused a real
# duplicate-key collision in a live endpoint (see docs/15_ROADMAP.md's
# Sep 19, 2026 RULE MISSES LOG entry). This mirrors exactly what
# `.github/workflows/ci.yml`'s `backend` job already does correctly with a
# fresh Postgres container per run — adapted for this persistent local
# environment (no Docker here) via a dedicated database that gets wiped
# clean before every run instead of a brand-new container.
#
# Usage:
#   backend/run_isolated_tests.sh                    # full suite
#   backend/run_isolated_tests.sh tests/test_foo.py   # one file
#   backend/run_isolated_tests.sh -k test_name -v     # any pytest args
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKEND_DIR"

TEST_DB="pharmacare_test"
TEST_PORT=8001
DB_USER="pharmacare_user"
TEST_DATABASE_URL="postgresql+asyncpg://${DB_USER}:pharmacare_pass@localhost:5432/${TEST_DB}"

echo "==> Resetting $TEST_DB to a clean slate..."
sudo -u postgres dropdb --if-exists "$TEST_DB"
sudo -u postgres createdb "$TEST_DB"
sudo -u postgres psql -d "$TEST_DB" -c "GRANT ALL PRIVILEGES ON DATABASE $TEST_DB TO $DB_USER;" >/dev/null
sudo -u postgres psql -d "$TEST_DB" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" >/dev/null

echo "==> Running migrations against $TEST_DB..."
DATABASE_URL="$TEST_DATABASE_URL" venv/bin/alembic upgrade head

echo "==> Seeding test admin account..."
DATABASE_URL="$TEST_DATABASE_URL" venv/bin/python seed_admin.py \
  --email testadmin@pharmacy.com --password admin123 --name "Test Admin"

echo "==> Starting throwaway backend on port $TEST_PORT..."
DATABASE_URL="$TEST_DATABASE_URL" venv/bin/uvicorn main:app --host 0.0.0.0 --port "$TEST_PORT" \
  > /tmp/pharmacare-test-backend.log 2>&1 &
TEST_BACKEND_PID=$!

cleanup() {
  echo "==> Stopping throwaway backend (pid $TEST_BACKEND_PID)..."
  kill "$TEST_BACKEND_PID" 2>/dev/null || true
  wait "$TEST_BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Waiting for throwaway backend to become healthy..."
ready=0
for _ in $(seq 1 30); do
  if curl -sf "http://localhost:${TEST_PORT}/docs" -o /dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "Throwaway backend did not become ready in time — see /tmp/pharmacare-test-backend.log"
  cat /tmp/pharmacare-test-backend.log
  exit 1
fi

echo "==> Running pytest against the isolated backend..."
# DATABASE_URL matters here too, not just for the throwaway backend above:
# tests/test_sequence_number_digit_boundary.py imports database.py directly
# (the one file in this suite that talks to the DB, not just HTTP) — that
# import happens in THIS process, so without this it would silently
# connect to the real dev database while its HTTP calls hit the isolated
# one, causing a pharmacy_id foreign-key mismatch between the two DBs.
REACT_APP_BACKEND_URL="http://localhost:${TEST_PORT}" DATABASE_URL="$TEST_DATABASE_URL" \
  venv/bin/python -m pytest "$@"
