# PharmaCare — Deployment
# Version: 1.2 | Last updated: August 22, 2026
# Audience: Claude, all developers
# Rule: Never ship without reading the pre-deploy checklist. Never touch production DB directly.

---

## ENVIRONMENTS

| Environment | Purpose | URL |
|-------------|---------|-----|
| `local` | Daily development | `http://localhost:3000` / `http://localhost:8000` |
| `staging` | Pre-release testing, QA | TBD — not yet provisioned |
| `production` | Live pharmacies | TBD — not yet provisioned |

Phase 1 is single-instance. All pharmacies share one database, separated by `pharmacy_id`.

---

## PRE-LAUNCH BLOCKERS
> Moved here from CLAUDE.md (August 2026) — this is where a pre-deploy gate
> list belongs, not the always-loaded root file. Update the status inline
> when one of these is actually resolved; don't let this go stale like it
> did living in CLAUDE.md (item 1 sat here listed as broken for a while
> after the fix had already shipped).

### 🔴 Data-loss or security risk — fix before any deployment
1. ~~Signup doesn't create a new pharmacy (multi-tenancy bug).~~ **Fixed** —
   verified in code: `POST /auth/register` calls
   `create_pharmacy_with_defaults(...)`, and `UserCreate` has no
   client-supplied role field (signing-up user is always that new
   pharmacy's Admin, server-side).
2. **Multi-tenancy isolation needs a full audit, not just the signup fix.**
   The old register bug proved the *pattern* — "forgot to scope by
   `pharmacy_id`" — exists in this codebase. Before trusting 100 pharmacies'
   data stays separated, audit every query, not just auth.
3. **No automated backups.** Real pharmacy business + compliance data (H1
   register, bills). Losing it isn't acceptable.
4. **CORS misconfiguration** — `allow_origins=["*"]` with
   `allow_credentials=True` is invalid. Already fixed in code — needs
   `CORS_ORIGINS` env var set to the production frontend URL on deploy.
5. **Nothing is actually deployed anywhere.** Runs on localhost/dev
   containers only. Needs a real hosted backend + Postgres + frontend
   before "launch" means anything.

### 🟡 Should fix before real users — not data-loss risk, real gaps
6. **No rate limiting** — login/register and the rest of the API have no
   protection against brute-force or abuse.
7. **TypeScript errors in test files** — `npm install --save-dev @types/jest
   @testing-library/react @testing-library/jest-dom`.

See "CI/CD — WHAT ACTUALLY EXISTS" below for infra gaps (Sentry, staging
hosting) — not repeated here to avoid two lists disagreeing about the same
item.

---

## LOCAL SETUP (full stack)

### Prerequisites

```bash
# Required versions
node  >= 18
python >= 3.11
postgres >= 15
```

### 1. Clone and install

```bash
git clone git@github.com:abinash811/Pharmacare-April11-Claude-push.git
cd Pharmacare-April11-Claude-push
```

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env — see ENV VARIABLES section below
# (backend/.env.example added August 22, 2026 — this file previously
# didn't exist, so this exact step failed for anyone following it literally)

# Run database migrations
alembic upgrade head

# Start backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env — see ENV VARIABLES section below
# (frontend/.env.example added August 22, 2026, same reason as backend's)

# Start frontend
npm start
```

Frontend starts at `http://localhost:3000`.

---

## ENVIRONMENT VARIABLES

### Backend (`backend/.env`)

> Corrected August 22, 2026 — verified against `backend/config.py`'s real
> `Settings` class and `backend/main.py`'s CORS setup, not copied from an
> assumption. Two real mismatches fixed:
> - The JWT algorithm var is **`JWT_ALGORITHM`**, not `ALGORITHM`. Setting
>   `ALGORITHM` (as `.github/workflows/ci.yml` currently does) is silently
>   ignored by pydantic-settings — it "works" today only because
>   `JWT_ALGORITHM`'s default already happens to be `HS256`. Don't copy
>   that env var name into a real deployment; it will silently do nothing.
> - `ENVIRONMENT` is **not a real setting** — `config.py`'s `Settings`
>   class has no such field, so it's currently a no-op. `DEBUG` is real.
> - CORS is **not** part of this `Settings` class at all — `main.py` reads
>   `CORS_ORIGINS` directly via `os.environ`, a separate path. See below.

```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/pharmacare

# App
APP_NAME=PharmaCare
DEBUG=true

# Auth
SECRET_KEY=your-secret-key-min-32-chars-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# CORS — comma-separated allowed origins; see BACKEND NOTES > CORS below
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Production overrides:**
- `SECRET_KEY` must be a cryptographically random 64-char string
- `DEBUG=false`
- `DATABASE_URL` points to managed PostgreSQL (e.g., RDS, Supabase, Neon)
- `CORS_ORIGINS` set to the exact production frontend origin(s) — never `*`

### Frontend (`frontend/.env`)

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

**Production override:**
```env
REACT_APP_BACKEND_URL=https://api.yourpharmacare.com
```

> `REACT_APP_` prefix is required — Create React App only exposes env vars with this prefix to the browser.

---

## DATABASE MIGRATIONS

PharmaCare uses Alembic for schema migrations.

```bash
cd backend

# Check current migration state
alembic current

# Apply all pending migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "add_supplier_credit_limit"

# Roll back one migration
alembic downgrade -1

# Roll back to a specific revision
alembic downgrade abc123def456
```

### Migration rules

- **Never edit a migration that has already been applied to production.** Create a new one.
- **Always review autogenerated migrations before running.** Alembic can miss complex changes.
- **Test the downgrade path.** Every migration must be reversible.
- **Name migrations descriptively.** `add_batch_cost_price` not `update_table`.

### New column checklist

When adding a column to an existing table:
1. Add it as `nullable=True` or with a `server_default`
2. Apply migration on staging first
3. Deploy backend code
4. Optionally backfill if needed
5. Never add `NOT NULL` without a default on an existing table with data

---

## BACKEND NOTES

### `server.py` — DO NOT RUN

`backend/server.py` is the original MongoDB backup. It is kept for historical reference only.

- Never run it on port 8000
- Never import from it
- Never delete it (it's the original codebase)

The active backend entry point is `backend/main.py`.

### CORS

`backend/main.py` reads `CORS_ORIGINS` from the environment (comma-separated,
`"*"` stripped out if present) — corrected August 22, 2026, this section
previously showed a hardcoded single-origin list that isn't what the real
code does:

```python
_raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip() and o.strip() != "*"]
if not _origins:
    raise RuntimeError(
        "CORS_ORIGINS must be set to an explicit origin list — '*' is not allowed with credentials."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

The app **fails to start** (a hard `RuntimeError`, not a silent fallback)
if `CORS_ORIGINS` resolves to an empty list — e.g. if it's set to just
`*`. Set `CORS_ORIGINS` to the exact production frontend origin(s) when
deploying; never rely on the localhost default.

---

## FRONTEND BUILD

```bash
cd frontend

# Production build
npm run build

# Output: frontend/build/
# Serve with any static file server (nginx, Vercel, Netlify, S3+CloudFront)
```

The build output is a standard Create React App production bundle. All routes are SPA routes — the server must return `index.html` for all non-asset paths.

### nginx config (single-page app routing)

```nginx
location / {
    root /var/www/pharmacare/build;
    try_files $uri /index.html;
}
```

---

## PRE-DEPLOY CHECKLIST

Before any deployment to staging or production:

```
[ ] All tests passing: pytest (backend) + npm test (frontend)
[ ] No .env secrets committed to git
[ ] Alembic migrations tested with: alembic upgrade head on a clean DB
[ ] CORS origin list updated for the target environment
[ ] SECRET_KEY is random and strong (not "changeme" or any default)
[ ] DEBUG=false in production
[ ] backend/server.py NOT running on any port
[ ] Frontend build succeeds: npm run build (no errors)
[ ] No hardcoded localhost URLs in frontend code (use REACT_APP_BACKEND_URL)
```

---

## CI/CD — WHAT ACTUALLY EXISTS

> Corrected August 22, 2026 — this section and the "Environments" table
> below it used to contradict each other (one said CI/CD didn't exist, the
> other showed a specific staging trigger as if live) and neither had been
> checked against the real `.github/workflows/` files. Consolidated into
> one honest section.

**Real and working**, verified live many times this session via
`workflow_dispatch`, not just by reading the YAML:
- `ci.yml` — lint + test gate for both backend and frontend. Runs on push
  to `main`, on PRs targeting `main`, and on-demand via `workflow_dispatch`
  from any branch. This is the CI referenced throughout `docs/11_TESTING.md`.
- `design-guard.yml` — runs `scripts/design-guard.sh` against the whole
  repo; also runs Playwright E2E using `E2E_EMAIL`/`E2E_PASSWORD` secrets.

**Exists but incomplete** — `staging.yml`:
- Triggers on push to the `develop` branch (real, in the YAML).
- Builds the frontend with `REACT_APP_BACKEND_URL`, `REACT_APP_ENV`,
  `REACT_APP_VERSION` from `STAGING_BACKEND_URL`/`SENTRY_DSN` secrets —
  real, but note `REACT_APP_SENTRY_DSN` isn't read by any code yet
  (Sentry is committed but not initialized).
  The actual deploy step is a placeholder comment
  (`# Replace with your actual deploy step (Vercel / Netlify / S3)`) — the
  workflow builds successfully but doesn't ship the build anywhere. The
  staging/production **URLs below are the intended targets once that step
  is filled in — they are not live today.**

**Does not exist at all:**
- Any actual hosting for staging or production (no live URL reachable)
- Docker / docker-compose
- Managed PostgreSQL instance
- S3 for PDF/document storage
- Monitoring / alerting (Sentry DSN wiring, Datadog)
- Log aggregation

When staging/production hosting is set up for real, update the table below
with the URLs that actually resolve — until then, treat them as a plan,
not a fact.

---

## Environments

| Environment | Branch    | Frontend URL (target, not live yet) | Trigger          |
|-------------|-----------|-------------------------------------|------------------|
| Local       | any       | http://localhost:3000               | manual           |
| Staging     | `develop` | https://staging.pharmacare.app      | push to develop (workflow runs; deploy step is a placeholder) |
| Production  | `main`    | https://pharmacare.app              | manual / tag (no workflow wired up yet) |

### Environment variables

Frontend env files that exist today: `.env.local` (git-ignored local
override) and, as of August 22, 2026, a real `.env.example` (see LOCAL
SETUP above). `.env.staging`/`.env.production` template files described
here previously do not exist in the repo — `staging.yml` sets its env vars
directly from GitHub Actions secrets at build time instead of reading a
committed staging template file.

Real secrets live in GitHub Actions secrets only — never in committed files.

### Required secrets (GitHub Actions) — verified against the real workflow files

| Secret | Used by |
|--------|---------|
| `STAGING_BACKEND_URL` | Frontend staging build (`staging.yml`) |
| `STAGING_DATABASE_URL` | Backend staging (`staging.yml`) |
| `STAGING_SECRET_KEY` | Backend staging JWT (`staging.yml`) |
| `SENTRY_DSN` | Both frontend and backend build steps (`staging.yml`) — not yet read by any application code |
| `E2E_EMAIL` | Playwright CI (`design-guard.yml`) |
| `E2E_PASSWORD` | Playwright CI (`design-guard.yml`) |

---

*Owner: whoever sets up real staging/production hosting updates this file
with the actual URLs, credentials patterns, and deploy commands before
calling either environment live.*
