# PharmaCare — Claude Code Master Reference
# Last updated: August 21, 2026
# Read this file at the start of every session.
# All rules live in /docs — this file is the index and quick-reference only.

---

## THE PHARMACARE MANIFESTO

1. **One component, one way.** Every button is `<AppButton>`. Every page header is `<PageHeader>`. Every tab bar is `<PageTabs>`. Every "More options" dropdown is `<MoreMenu>`. No raw `<button>` tags, no inline title `<div>`, no custom tab UI, no hand-rolled `top-full mt-1` popover anywhere.
2. **Design tokens, not hex.** `bg-brand`, `hover:bg-brand-dark`, `text-brand`, `border-brand`. Never `#4682B4`, never `#3a6fa0`, never `bg-[#anything]` in component code.
3. **Every page looks like the same product.** Same header height, same tab underline, same button weights.
4. **No file over 300 lines.** If it grows past 300, split it. Orchestrators import components — they don't contain JSX logic.
5. **Money is integer paise. Always.** ₹1 = 100 paise. Never floats for currency calculations. Display only converts.
6. **Soft deletes only.** Pharmacy data is compliance data. Hard delete is never acceptable.
7. **International standard or nothing.** If it wouldn't ship in Linear, Notion, or Stripe — don't ship it here.
8. **Zero cognitive load.** Every feature must be completable in the fewest possible clicks. No unnecessary steps, no confirmation modals for reversible actions, no forms asking for data we can infer. If the user has to think — we've failed. Smart defaults, inline edits, auto-save where possible.
9. **No magic strings. No unverified routes. Ever.** Every status value (`'draft'`, `'paid'`, `'parked'`) comes from `constants/domainConstants.js`. Every API call targets a route you have confirmed exists in the backend routers. Writing a raw string like `status='parked'` or calling `/patients` without checking — that is the bug. Fix the root, not the symptom.
10. **Every error notification must say why.** "Failed to save settings" with no cause is a bug, not a valid error state — the user can't fix what they can't see. Every `toast.error(...)` must show the actual field/reason (`error.message`, already normalised by `frontend/src/lib/axios.js`'s interceptor — see `docs/12_ERROR_HANDLING.md`), never a hardcoded generic fallback alone.

---

## DESIGN SYSTEM — VISUAL AUTHORITY

**Location:** `PharmaCare Design System/` folder in the project root.

> Before building any new page, component, or UI pattern — **check this folder first.**
> The HTML previews are the ground truth for visual output. Code must match them.

| File | What it governs |
|------|----------------|
| `preview/design-auth.html`              | Auth page — split layout, both breakpoints |
| `preview/design-billing-shortcuts.html` | Billing header — shortcut badges, legend popover |
| `preview/design-dashboard-zero.html`    | Dashboard — zero state for new pharmacies |
| `tokens/colors.css`                     | All brand color tokens |
| `tokens/typography.css`                 | Font scale, weights |

**Rule:** If a design preview exists for what you're building, match it exactly. If none exists, follow CLAUDE.md patterns and create a preview after shipping.

> ⛔ HARD STOP: Before writing ANY component, page, or UI pattern — open this folder and check. No exceptions. No skipping. Code first = rework guaranteed.

---

## PROJECT SNAPSHOT

**What:** Indian pharmacy management SaaS — billing, inventory, purchases, GST, compliance.
**Stack:** React + Tailwind CSS + Shadcn/UI · Python FastAPI + SQLAlchemy 2.0 async · PostgreSQL
**Auth:** JWT
**Backend port:** 8000 (`uvicorn main:app --host 0.0.0.0 --port 8000 --reload`)
**Frontend env:** `REACT_APP_BACKEND_URL=http://localhost:8000`

> `backend/server.py` = original MongoDB backup. Keep it. Never run it on port 8000.

---

## DOCS INDEX

All rules, patterns, and decisions live here. One topic per file. No overlap.

| # | File | What's inside |
|---|------|--------------|
| 01 | `docs/01_PRODUCT.md` | Vision, personas, feature matrix, non-goals |
| 02 | `docs/02_GLOSSARY.md` | All domain terms — MRP, PTR, Schedule H1, paise, FEFO, etc. |
| 03 | `docs/03_ONBOARDING.md` | Setup steps, project structure, first-change checklist |
| 04 | `docs/04_GIT_WORKFLOW.md` | Branch strategy, commit format, PR template |
| 05 | `docs/05_DESIGN_SYSTEM.md` | All design tokens, typography, spacing, banned patterns |
| 06 | `docs/06_COMPONENTS.md` | Every shared component — props, usage, anti-patterns |
| 07 | `docs/07_BUSINESS_LOGIC.md` | Billing, stock, GST, H1 register — exact formulas and flows |
| 08 | `docs/08_ARCHITECTURE.md` | System design, ADRs, request lifecycle, security rules |
| 09 | `docs/09_DATABASE.md` | All 21 tables, columns, indexes, migration rules |
| 10 | `docs/10_API.md` | All endpoints, request/response shapes, error codes |
| 11 | `docs/11_TESTING.md` | pytest + jest setup, P0/P1/P2 priorities, critical tests |
| 12 | `docs/12_ERROR_HANDLING.md` | All error states, toast rules, retry patterns |
| 13 | `docs/13_DEPLOYMENT.md` | Env vars, migration commands, pre-deploy checklist |
| 14 | `docs/14_SECURITY.md` | Auth patterns, multi-tenancy rules, sensitive data |
| 15 | `docs/15_ROADMAP.md` | Built / in-progress / planned / Phase 2+ / tech debt |
| 16 | `docs/16_NAMING_CONVENTIONS.md` | File, component, variable, DB, API naming rules |
| 17 | `docs/17_ACCESSIBILITY.md` | WCAG AA, ARIA, focus, contrast, keyboard nav |
| 18 | `docs/18_ICONOGRAPHY_MOTION.md` | Lucide icons, sizes, stroke, animation durations |
| 19 | `docs/19_PERFORMANCE.md` | Lighthouse targets, lazy loading, pagination, N+1 rules |
| 20 | `docs/20_CODE_QUALITY.md` | ESLint, Prettier, CI pipeline, audit rubric, SOLID/DRY |
| 21 | `docs/21_FEATURES.md`     | Every feature — what it is, why it exists, who uses it, how it works |
| 22 | `docs/22_TECH_RADAR.md`   | What's modern/cost-efficient per stack layer, sourced externally — check before adopting new infra |

---

## HOW CLAUDE WORKS WITH ABINASH — WORKFLOW AGREEMENT

> Added April 26, 2026, after a session working through local setup, a pre-commit
> enforcement system, and an Inventory design-consistency fix together.

- **Branch, not main.** Claude works on the session's feature branch (see
  `docs/04_GIT_WORKFLOW.md`), never commits straight to `main`.
- **Commit + push automatically as checkpoints.** After each finished, verified
  change, Claude commits and pushes to that branch without waiting to be asked —
  these are cheap, reversible checkpoints, not a final decision.
- **The confirmation moment is the PR merge into `main`.** Abinash reviews and
  decides there. That's the one point that actually matters — everything before
  it is safe to move fast on.
- **Enforcement is real, not aspirational.** `.githooks/pre-commit` (set up once
  per machine via `git config core.hooksPath .githooks`) blocks a commit that
  breaks a rule in this file, and says which rule and why. `scripts/design-guard.sh`
  runs the same checks across the whole repo in CI.
- **Doc-worthy decisions get written down.** A rule, preference, or workflow
  change stated in conversation only exists in that conversation — it does NOT
  persist to a new session or a teammate's Claude unless it's written into this
  file or the relevant `docs/*.md`. When something said in chat should become a
  standing rule, Claude flags it and asks before/after updating the doc — silence
  is not consent to skip it, but Claude also doesn't rewrite policy on a guess.

---

## DEPENDENCY & ENV SAFETY RULES — NEVER BREAK THE APP

These rules exist because adding uninstalled packages and wrong env values have crashed the app multiple times.

### Adding a new package (frontend)
1. Run `npm install <package>` first — confirm "added X packages" in terminal
2. Only then add `import` statements in code
3. Never add a package to `package.json` manually without running `npm install`

### Adding a new package (backend)
1. Run `pip install <package>` inside venv first — confirm "Successfully installed"
2. Add to `requirements.txt` after install succeeds
3. Only then add `import` statements in `main.py` or any module

### Env files — strictly forbidden
- NEVER add a URL to `.env.production` unless it is a real, live production URL
- NEVER add placeholder values — an empty key is safer than a fake value
- `REACT_APP_BACKEND_URL` is set via CI secret only — never hardcode it in any env file
- Always state explicitly when touching any `.env*` file — treat it as a breaking change

### Verify after every infrastructure change
- After any change to `main.py` imports or `requirements.txt` → restart backend and confirm `Application startup complete`
- After any change to `package.json` or env files → restart frontend and confirm no compile errors
- One change at a time. Verify. Then next change.

---

## CURRENT STATE — READ THIS FIRST EVERY SESSION

> This section is the handoff note. Updated after every session. A new Claude must read this before touching any code.

### App status (April 25, 2026)
- ✅ App runs locally — backend on port 8000, frontend on port 3001
- ✅ All Settings tabs built: Pharmacy Profile, Receipt & Print, Tax & GST, Notifications, Inventory, Billing, Bill Sequence, Returns
- ✅ Dashboard dynamic thresholds + drug license expiry banner
- ✅ Team page: Members + Roles with permissions matrix
- ✅ Billing list filter chips fixed — parked, cash, upi, due all work correctly
- ✅ PatientCombobox — inline typeahead, uses /customers endpoint, walk-in + add new customer
- ✅ DoctorDropdown — rebuilt, same UX as PatientCombobox (click → inline input → suggestions)
- ✅ Billing footer — CTAs removed, header-only CTAs
- ✅ Print formats — Thermal (80mm/58mm) + A4/A5, default set in Settings → Receipt & Print
- ✅ domainConstants.js — single source of truth for all status/enum values
- ✅ All commits pushed to main

### 🚦 PRE-LAUNCH PLAN — agreed April 26, 2026
Order of work: **(1) finish building product features module-by-module** (starting
with signup/auth — see below), **then (2) work this list top to bottom** before
any real pharmacy uses this in production. Don't start (2) early — a half-fixed
production checklist on top of half-built features is worse than either alone.

### 🔴 Launch blockers — data-loss or security risk, fix first
1. **Signup doesn't create a new pharmacy (multi-tenancy bug).** `POST /auth/register`
   attaches every new signup to whichever pharmacy is first in the DB
   (`select(Pharmacy).limit(1)`) instead of creating a new tenant. The public
   Register form also lets anyone self-select "Admin" as their role — a live
   privilege-escalation hole. **Must be fixed as part of the signup/auth rebuild
   (in progress) before any deployment.**
2. **Multi-tenancy isolation needs a full audit, not just this one fix.** The
   register bug proves the *pattern* — "forgot to scope by `pharmacy_id`" — exists
   in this codebase. Before trusting 100 pharmacies' data stays separated, audit
   every query, not just auth.
3. **No automated backups.** This is real pharmacy business + compliance data
   (H1 register, bills). Losing it isn't acceptable.
4. **CORS misconfiguration** — `allow_origins=["*"]` with `allow_credentials=True`
   is invalid. Fix: set `CORS_ORIGINS` env var to the production frontend URL.
   Already fixed in code — just needs the env var set on the server.
5. **Nothing is actually deployed anywhere.** Runs on localhost/dev containers
   only. Needs a real hosted backend + Postgres + frontend before "launch" means
   anything.

### 🟡 Should fix before real users — not data-loss risk, but real gaps
6. **No rate limiting** — login/register and the rest of the API have no
   protection against brute-force or abuse.
7. **No error monitoring** — `frontend/src/lib/sentry.ts` is committed but never
   initialized. At real-user scale, bugs will happen with zero visibility unless
   a user reports them. Wait for DSN from owner.
8. **No CI/CD** — `.github/workflows/staging.yml` exists but deploy steps are
   `echo` only. Deploys are manual today.
9. **Alembic migrations must run on the real deploy target** — three migrations
   exist (`95d13d1508dc` initial schema, `a3f8c2d14e90` pharmacy_settings GST/print/
   notification fields, `b1e4f7a29c03` paper_size). Already applied to this dev DB;
   still a required step on whatever server actually hosts this.
10. **TypeScript errors in test files** — `npm install --save-dev @types/jest
    @testing-library/react @testing-library/jest-dom`.

### 🟠 Billing flow — in progress (next session continues here)
The billing UX is being improved. Current state:
- ✅ Filter chips fixed
- ✅ Patient search: inline combobox, /customers endpoint, add new customer mini-form
- ✅ Doctor search: inline input, freetext + DB suggestions
- ⚠️ Patient/Doctor UX needs one more improvement: when user types a name with no DB match, show typed text + "Add [name]" option inline (same as PatientCombobox already has for patients). Doctor needs same "Add doctor" flow.
- ⚠️ Batch selection UX in medicine row — not discoverable, needs visual cue (chip with chevron)
- ⚠️ WhatsApp button — "Add custom number" flow incomplete
- 🔲 Print: Thermal/A4 built, needs testing after `alembic upgrade head`

### Next feature priorities (after infra is solid)
1. **Run alembic upgrade head** — activate the 3 pending migrations (BLOCKER)
2. **Doctor "Add new" flow** — same as PatientCombobox add-new mini-form
3. **Batch selection UX** — show batch as chip with chevron in medicine row
4. **WhatsApp custom number** — inline popover, single number field
5. **Sheets** — replace all centered modals with `<Sheet side="right">` 480px
6. **Zod + react-hook-form** — all forms
7. **Error retry states** — every page that fetches data
8. **Split payment** — cash + UPI on one bill
9. **Day-end closing / Z-report**
10. **Command Palette** — `Cmd+K`

### Terminal tabs (local dev)
- **Tab 1 (backend):** `cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
- **Tab 2 (frontend):** `cd frontend && npm start` → runs on port 3001

---

## QUICK-REFERENCE RULES

### Page structure (every page, no exceptions)
```jsx
<div className="px-8 py-6 min-h-screen bg-[#F8FAFB]">
  <PageHeader title="..." actions={...} />
  <PageTabs tabs={TABS} activeTab="..." onChange={...} />
  <div className="bg-white rounded-xl border border-gray-200">
    {/* content */}
  </div>
</div>
```

### Tab routes
| Tab bar | Route A | Route B |
|---------|---------|---------|
| Billing | `/billing` | `/billing/returns` |
| Purchases | `/purchases` | `/purchases/returns` |
| Inventory | `/inventory` | `/inventory/stock-movements` |
| Reports | `/reports` | `/reports/gst` |

### HOW TO BUILD — mandatory order, every single feature

> Skipping this order is what caused every filter bug, every 404, every patched fix.

1. **Read the DB model first.** What columns exist? What values are actually stored? (`backend/models/` or grep the ORM)
2. **Read the backend router.** Does the route exist? What params does it accept? What does it return?
3. **Read domainConstants.js.** Are the status values you need already defined? If not, add them there first.
4. **Then write the frontend.** Connected to reality — not assumptions.

Never write a frontend filter, API call, or status check before completing steps 1–3.

---

### Component audit (check before every PR)
- [ ] Zero raw `<button>` tags
- [ ] Zero hardcoded hex in className
- [ ] Zero `hover:bg-[#...]` patterns
- [ ] Every page uses `<PageHeader>` — no inline `<h1>`, no subtitle
- [ ] Every multi-view page uses `<PageTabs>`
- [ ] Every LIST page root = `px-8 py-6 min-h-screen bg-[#F8FAFB]` — never `flex flex-col h-full`
- [ ] `flex flex-col h-full` is ONLY for workspace pages: BillingWorkspace, PurchaseNew — nowhere else
- [ ] Zero inline pill `.map()` patterns — always `<FilterPills>` from shared
- [ ] Zero hand-rolled "More options" dropdowns — always `<MoreMenu>` from shared
- [ ] Zero `import` statements after `const` declarations
- [ ] New files use `.tsx` extension, not `.jsx`
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Run `bash scripts/design-guard.sh` — must exit 0 before any PR

### What's next (build in this order)
> Infrastructure first. Features on a broken foundation collapse.

1. **`alembic upgrade head`** — 3 migrations pending, run before any deployment (BLOCKER)
2. **Doctor "Add new" flow** — same mini-form as PatientCombobox
3. **Batch selection UX** — chip with chevron in medicine row so users know it's clickable
4. **WhatsApp custom number** — inline popover, no modal
5. **Sentry** — wire DSN into frontend + backend once owner creates account
6. **Fix TypeScript test errors** — `npm install --save-dev @types/jest @testing-library/react @testing-library/jest-dom`
7. **Sheets** — replace all centered modals with `<Sheet side="right">` 480px
8. **Zod + react-hook-form** — all forms
9. **Error retry states** — every page that fetches data
10. **Split payment** — cash + UPI on one bill
11. **Command Palette** — `Cmd+K`

### Dead files (already deleted)
- `frontend/src/pages/InventorySearch/components/InventoryHeader.jsx`
- `frontend/src/pages/Settings/components/SettingsTabs.jsx`
- `frontend/src/pages/Reports/components/ReportTypeCards.jsx`
- `frontend/src/components/ActivityTimeline.js`

### Stale docs (do not update, do not trust)
`PHARMACARE_RULES.md` · `PHARMACARE_DESIGN_SKILL.md` · `PHARMACARE_DESIGN_BRIEF.md` · `CONTEXT.md` · `PROGRESS.md` · `DECISIONS.md` · `TECH_SPEC.md` · `PHARMACARE_DATABASE_SCHEMA.md`

### Deleted files (do not recreate)
- `memory/PRD.md` — mentioned MongoDB (replaced by PostgreSQL) and teal as primary colour (replaced by brand blue #4682B4). Deleted April 19, 2026. Source of truth is `docs/` folder.
