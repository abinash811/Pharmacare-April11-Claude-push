# PharmaCare — Claude Code Master Reference
# Last updated: April 18, 2026
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
- [ ] Every page uses `<PageHeader>`
- [ ] Every multi-view page uses `<PageTabs>`

### What's next (build in this order)
1. Sheets (Shadcn `<Sheet side="right">` 480px) — replace all centered modals
2. Zod + react-hook-form — all forms
3. Error retry states — every page that fetches data
4. Command Palette — `Cmd+K`
5. Speed keys — `n` / `f` / `/` / `Esc` / `Enter`

### Dead files (already deleted)
- `frontend/src/pages/InventorySearch/components/InventoryHeader.jsx`
- `frontend/src/pages/Settings/components/SettingsTabs.jsx`
- `frontend/src/pages/Reports/components/ReportTypeCards.jsx`
- `frontend/src/components/ActivityTimeline.js`

### Stale docs (do not update, do not trust)
`PHARMACARE_RULES.md` · `PHARMACARE_DESIGN_SKILL.md` · `PHARMACARE_DESIGN_BRIEF.md` · `CONTEXT.md` · `PROGRESS.md` · `DECISIONS.md` · `TECH_SPEC.md` · `PHARMACARE_DATABASE_SCHEMA.md`
