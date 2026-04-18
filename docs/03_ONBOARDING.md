# PharmaCare — Onboarding
# Version: 1.0 | Last updated: April 18, 2026
# Audience: New developer, Claude, anyone setting up PharmaCare from scratch
# Goal: Zero to running app in under 30 minutes. Zero questions needed.

---

## PREREQUISITES

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node --version` |
| Python | 3.11+ | `python3 --version` |
| PostgreSQL | 14+ | `psql --version` |
| Git | any | `git --version` |

---

## STEP 1 — CLONE

```bash
git clone git@github.com:abinash811/Pharmacare-April11-Claude-push.git
cd Pharmacare-April11-Claude-push
```

Always work on `main`. Never create a branch without reading `docs/04_GIT_WORKFLOW.md` first.

---

## STEP 2 — DATABASE SETUP

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE pharmacare;"

# Create a user (or use postgres superuser for local dev)
psql -U postgres -c "CREATE USER pharmacare_user WITH PASSWORD 'pharmacare_pass';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE pharmacare TO pharmacare_user;"
```

---

## STEP 3 — BACKEND SETUP

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate          # Mac/Linux
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://pharmacare_user:pharmacare_pass@localhost:5432/pharmacare
SECRET_KEY=your-secret-key-min-32-chars-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

```bash
# Run database migrations
alembic upgrade head

# Seed default admin user and pharmacy
python seed_admin.py

# Start backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: open `http://localhost:8000/docs` — FastAPI docs should load.

---

## STEP 4 — FRONTEND SETUP

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env.local

# Start frontend
npm start
```

App opens at `http://localhost:3000`.

---

## STEP 5 — FIRST LOGIN

After `seed_admin.py` runs, use these credentials:

```
Email:    admin@pharmacare.com
Password: Admin@123
```

Change this password immediately in Settings → Team after first login.

---

## STEP 6 — VERIFY EVERYTHING WORKS

Walk through this checklist before writing any code:

- [ ] Login works → lands on Dashboard
- [ ] Sidebar shows all nav items (Billing, Inventory, Purchases, Customers, Suppliers, Reports, Settings, Team)
- [ ] `/billing` loads with Bills tab active
- [ ] `/billing/returns` loads with Sales Returns tab active
- [ ] `/inventory` loads with Products tab active
- [ ] `/inventory/stock-movements` loads with Stock Movements tab active
- [ ] `/reports` loads with Reports tab active
- [ ] `/reports/gst` loads with GST Report tab active
- [ ] `/settings` loads with tabs (Inventory, Billing, Bill Sequence, Returns, General)
- [ ] Backend API responds: `curl http://localhost:8000/api/health`

---

## PROJECT STRUCTURE

```
Pharmacare-April11-Claude-push/
├── docs/                          ← All documentation (read before touching code)
│   ├── 01_PRODUCT.md
│   ├── 02_GLOSSARY.md
│   ├── 03_ONBOARDING.md           ← You are here
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── shared/            ← ONLY place for shared components
│   │   │   │   ├── AppButton.jsx  ← The only button component
│   │   │   │   ├── PageHeader.jsx ← Every page header
│   │   │   │   ├── PageTabs.jsx   ← Every tab bar
│   │   │   │   └── index.js       ← All exports
│   │   │   ├── Layout.js          ← App shell (sidebar + content)
│   │   │   └── ui/                ← Shadcn/UI primitives (do not modify)
│   │   ├── pages/                 ← One folder per page/feature
│   │   │   ├── BillingOperations.js
│   │   │   ├── Customers/
│   │   │   │   ├── index.jsx      ← Orchestrator (state + composition only)
│   │   │   │   ├── hooks/         ← useCustomers.js etc.
│   │   │   │   └── components/    ← Sub-components
│   │   │   └── ...
│   │   ├── constants/             ← API URLs, app constants
│   │   ├── hooks/                 ← Shared hooks
│   │   ├── lib/
│   │   │   └── axios.js           ← Single configured axios instance
│   │   └── utils/                 ← Shared utilities (currency, dates, etc.)
├── backend/
│   ├── main.py                    ← FastAPI app entry point
│   ├── routers/                   ← One file per feature domain
│   ├── models.py                  ← SQLAlchemy models
│   ├── schemas.py                 ← Pydantic request/response schemas
│   ├── database.py                ← DB connection + session
│   ├── deps.py                    ← FastAPI dependencies (auth, DB session)
│   ├── migrations/                ← Alembic migration files
│   └── server.py                  ← LEGACY MongoDB backup. DO NOT RUN. DO NOT DELETE.
└── CLAUDE.md                      ← Index file pointing to /docs
```

---

## CRITICAL FILES TO READ BEFORE WRITING ANY CODE

Read in this order. No exceptions.

| Order | File | Why |
|-------|------|-----|
| 1 | `docs/02_GLOSSARY.md` | Understand pharmacy domain terms |
| 2 | `docs/05_DESIGN_SYSTEM.md` | Every color, spacing, typography rule |
| 3 | `docs/06_COMPONENTS.md` | Every shared component with examples |
| 4 | `docs/08_ARCHITECTURE.md` | Tech decisions and patterns |
| 5 | `docs/07_BUSINESS_LOGIC.md` | How billing, inventory, purchases work |

---

## MAKING YOUR FIRST CHANGE

Before touching any file:

1. Read `docs/04_GIT_WORKFLOW.md` — branch naming, commit format
2. Identify which shared component handles your UI need (check `docs/06_COMPONENTS.md`)
3. Check if a hook already exists for your data need (look in `src/hooks/` and page-level `hooks/`)
4. Write code
5. Run the component audit checklist (in `CLAUDE.md`) before committing
6. Commit with conventional commit format (see `docs/04_GIT_WORKFLOW.md`)

---

## COMMON MISTAKES NEW DEVELOPERS MAKE

These will be caught by ESLint and pre-commit hooks — but understand why they're wrong.

| Mistake | Why it's wrong | Correct approach |
|---------|---------------|-----------------|
| Using raw `<button>` | Bypasses design system | Always use `<AppButton>` |
| Hardcoding `#4682B4` or any hex | Breaks theming | Use `bg-brand`, `text-brand` |
| `hover:bg-[#3a6fa0]` | Hardcoded hex | Use `hover:bg-brand-dark` |
| Storing money as float | Rounding errors | Always integer paise |
| `DELETE FROM` in SQL | Destroys audit trail | Soft delete: `is_deleted = true` |
| `MAX(id) + 1` for bill numbers | Race condition → duplicates | Use `nextval()` sequence |
| Inline `<h1>` in page root | Inconsistent headers | Use `<PageHeader>` |
| Custom tab UI | Inconsistent tabs | Use `<PageTabs>` |
| `font-medium` on buttons | Wrong weight | `font-semibold` on all buttons |
| `text-gray-900` on `bg-brand` | Dark text on blue = unreadable | Always `text-white` on `bg-brand` |

---

## RUNNING TESTS

```bash
# Frontend
cd frontend
npm test

# Backend
cd backend
pytest
```

See `docs/11_TESTING.md` for what to test and how to write tests.

---

## ENVIRONMENT VARIABLES REFERENCE

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (asyncpg driver) |
| `SECRET_KEY` | Yes | JWT signing key. Min 32 chars. Never commit. |
| `ALGORITHM` | Yes | JWT algorithm. Always `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Yes | Token lifetime. Default 1440 (24h). |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_BACKEND_URL` | Yes | Backend URL. Local: `http://localhost:8000` |

**Never commit `.env` or `.env.local` files. They are in `.gitignore`.**

---

## IF SOMETHING IS BROKEN

Before asking anyone:

1. Is the backend running? `curl http://localhost:8000/api/health`
2. Is the database running? `psql -U postgres -c "\l"`
3. Are migrations up to date? `cd backend && alembic upgrade head`
4. Is the frontend pointed at the right backend? Check `frontend/.env.local`
5. Clear node modules and reinstall: `rm -rf node_modules && npm install`
6. Check browser console for errors
7. Check backend terminal for Python tracebacks

If still broken — check `docs/12_ERROR_HANDLING.md` for known error patterns.

---

*Last updated when: new dependency added, setup step changes, new environment variable added.*
*Owner: The developer who changes the setup process updates this file in the same PR.*
