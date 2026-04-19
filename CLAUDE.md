# PharmaCare — Claude Code Master Reference
# Last updated: April 19, 2026
# Read this file at the start of every session.
# All rules live in /docs — this file is the index and quick-reference only.

---

## THE PHARMACARE MANIFESTO

1. **One component, one way.** Every button is `<AppButton>`. Every page header is `<PageHeader>`. Every tab bar is `<PageTabs>`. No raw `<button>` tags, no inline title `<div>`, no custom tab UI anywhere.
2. **Design tokens, not hex.** `bg-brand`, `hover:bg-brand-dark`, `text-brand`, `border-brand`. Never `#4682B4`, never `#3a6fa0`, never `bg-[#anything]` in component code.
3. **Every page looks like the same product.** Same header height, same tab underline, same button weights.
4. **No file over 300 lines.** If it grows past 300, split it. Orchestrators import components — they don't contain JSX logic.
5. **Money is integer paise. Always.** ₹1 = 100 paise. Never floats for currency calculations. Display only converts.
6. **Soft deletes only.** Pharmacy data is compliance data. Hard delete is never acceptable.
7. **International standard or nothing.** If it wouldn't ship in Linear, Notion, or Stripe — don't ship it here.
8. **Zero cognitive load.** Every feature must be completable in the fewest possible clicks. No unnecessary steps, no confirmation modals for reversible actions, no forms asking for data we can infer. If the user has to think — we've failed. Smart defaults, inline edits, auto-save where possible.

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

### App status (April 19, 2026)
- ✅ App runs locally — backend on port 8000, frontend on port 3001
- ✅ All Settings tabs built: Pharmacy Profile, Receipt & Print, Tax & GST, Notifications, Inventory, Billing, Bill Sequence, Returns
- ✅ Dashboard dynamic thresholds + drug license expiry banner
- ✅ Team page: Members + Roles with permissions matrix
- ✅ All commits pushed to main

### 🔴 Production blockers — fix before any deployment
1. **Missing Alembic migration** — New `PharmacySettings` columns (GST, print, notifications fields) exist on local DB via raw SQL but are NOT in any Alembic migration. Production DB will crash on first settings API call. Fix: `alembic revision --autogenerate -m "add_pharmacy_settings_gst_print_notification_fields"` then `alembic upgrade head`.
2. **CORS misconfiguration** — `allow_origins=["*"]` with `allow_credentials=True` is invalid. Browsers reject it. Fix: set `CORS_ORIGINS` env var to the actual production frontend URL. Default `"*"` must be changed to explicit origin.

### 🟡 Infrastructure gaps (do before adding features)
3. **Sentry not wired** — `frontend/src/lib/sentry.ts` committed but never initialized. Backend has no Sentry. Owner has not yet created a Sentry account. Wait for DSN from owner, then wire both.
4. **CI/CD is placeholder** — `.github/workflows/staging.yml` exists but deploy steps are `echo` only. Needs real deploy commands for the chosen hosting provider.
5. **No rate limiting** — API has no protection against abuse.
6. **TypeScript errors in test files** — `@types/jest` and `@testing-library/react` not installed. `npm test` fails. Fix: `npm install --save-dev @types/jest @testing-library/react @testing-library/jest-dom`.

### Next feature priorities (after infra is solid)
1. Alembic migration (blocker above)
2. Sheets — replace all centered modals with `<Sheet side="right">` 480px
3. Zod + react-hook-form — all forms
4. Error retry states — every page that fetches data
5. Bill PDF download — endpoint exists, template WIP
6. Split payment on one bill (cash + UPI)
7. Day-end closing / Z-report
8. Command Palette — `Cmd+K`

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

### Component audit (check before every PR)
- [ ] Zero raw `<button>` tags
- [ ] Zero hardcoded hex in className
- [ ] Zero `hover:bg-[#...]` patterns
- [ ] Every page uses `<PageHeader>` — no inline `<h1>`, no subtitle
- [ ] Every multi-view page uses `<PageTabs>`
- [ ] Every LIST page root = `px-8 py-6 min-h-screen bg-[#F8FAFB]` — never `flex flex-col h-full`
- [ ] `flex flex-col h-full` is ONLY for workspace pages: BillingWorkspace, PurchaseNew — nowhere else
- [ ] Zero inline pill `.map()` patterns — always `<FilterPills>` from shared
- [ ] Zero `import` statements after `const` declarations
- [ ] New files use `.tsx` extension, not `.jsx`
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Run `bash scripts/design-guard.sh` — must exit 0 before any PR

### What's next (build in this order)
> Infrastructure first. Features on a broken foundation collapse.

1. **Alembic migration** — `add_pharmacy_settings_gst_print_notification_fields` (PRODUCTION BLOCKER)
2. **CORS fix** — explicit origin list, not `"*"` (PRODUCTION BLOCKER)
3. **Sentry** — wire DSN into frontend + backend once owner creates account
4. **Fix TypeScript test errors** — install `@types/jest` + `@testing-library/react`
5. **Sheets** — replace all centered modals with `<Sheet side="right">` 480px
6. **Zod + react-hook-form** — all forms
7. **Error retry states** — every page that fetches data
8. **Bill PDF** — template WIP, finish and wire download button
9. **Split payment** — cash + UPI on one bill
10. **Command Palette** — `Cmd+K`

### Dead files (already deleted)
- `frontend/src/pages/InventorySearch/components/InventoryHeader.jsx`
- `frontend/src/pages/Settings/components/SettingsTabs.jsx`
- `frontend/src/pages/Reports/components/ReportTypeCards.jsx`
- `frontend/src/components/ActivityTimeline.js`

### Stale docs (do not update, do not trust)
`PHARMACARE_RULES.md` · `PHARMACARE_DESIGN_SKILL.md` · `PHARMACARE_DESIGN_BRIEF.md` · `CONTEXT.md` · `PROGRESS.md` · `DECISIONS.md` · `TECH_SPEC.md` · `PHARMACARE_DATABASE_SCHEMA.md`
