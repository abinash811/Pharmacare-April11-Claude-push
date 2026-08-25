# PharmaCare — Claude Code Master Reference
# Version: 2.2 | Last updated: August 25, 2026
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
11. **Cross-cutting changes ship as one change, not a series of surprises.** A billing rule doesn't live only in billing — it's also read by the GST report, analytics, the H1 register, stock. Before calling a change to one of these domains done, check every linked consumer listed in `docs/08_ARCHITECTURE.md`'s cross-cutting map and update or verify each one in the same change. Found August 22, 2026 the hard way: an MRP/stock/H1 check added to billing's create path didn't reach its own update/finalize path, and the GST report didn't reach sales/purchase returns, until both were checked separately. Ship the whole surface area, not just the entry point you happened to be looking at.
12. **Test what you build, before calling it done.** Every feature, fix, or enhancement ships with the tests that prove it — pytest for backend, jest for frontend, at the P0/P1/P2 priority its behavior warrants per `docs/11_TESTING.md`. If no test covers the code path you touched, write one in the same change, and run the suite (locally, then CI) before reporting the work finished. "It compiles" and "the doc says it works" are not evidence — a passing test is.
13. **Anything outside these rules needs permission first, explained simply.** If a task can't be done inside an existing pattern in this file or `/docs` — a new library, a new architecture, bypassing a documented rule, a schema change — stop and ask before building it. Explain in plain language what's being proposed and why, no jargon, so a non-engineer can approve or reject it. Only propose modern, cost-effective options, checked against `docs/22_TECH_RADAR.md` — never just the first tool that comes to mind.
14. **No assumptions. Verify, every time.** Don't guess what a route returns, what a doc claims, or whether a pattern still holds — check the real code or the real doc first, per the "HOW TO BUILD" order below. If something looks outdated — a doc, a dependency, a convention, an approach that used to be right — flag it explicitly and ask before deviating from it on your own judgment; don't silently route around it and don't silently keep building on it either. These rules are the law until the user changes them, not a default to override when they seem inconvenient or stale.
15. **Think like a product manager, not just an auditor.** A use-case list built only by reading our own code rediscovers what we already built — it can't tell you what's missing. Before calling any section's use-case list complete, benchmark it against what real competitors actually ship: **eVitalRx, Marg ERP, Pharmasoft** (see `docs/01_PRODUCT.md` §10 for what's known about each). Named/researched features that we don't have are real gaps, not nice-to-haves — call them out explicitly rather than only listing what exists in our code today.

---

## DESIGN SYSTEM — VISUAL AUTHORITY

**Location:** `PharmaCare Design System/` folder in the project root.

> Before building any new page, component, or UI pattern — **check this folder first.**
> The HTML previews are the ground truth for visual output. Code must match them.

| File | What it governs |
|------|----------------|
| `colors_and_type.css`                   | All brand color + typography + spacing + motion tokens — single file, not split into `tokens/colors.css`/`tokens/typography.css` (those don't exist; this table listed them for a while, a live example of the doc-drift problem) |
| `preview/design-auth.html`              | Auth page — split layout, both breakpoints |
| `preview/design-billing-shortcuts.html` | Billing header — shortcut badges, legend popover |
| `preview/design-dashboard-zero.html`    | Dashboard — zero state for new pharmacies |
| `preview/motion.html`                   | Duration/easing scale — same tokens as `colors_and_type.css`, rendered as chips |
| ...35 more `preview/*.html` files        | One per pattern (buttons, modals, forms, tables, empty states, dark mode, etc.) — this table is a sample, not the full index; browse the folder |

**Rule:** If a design preview exists for what you're building, match it exactly. If none exists, follow CLAUDE.md patterns and create a preview after shipping.

> ⛔ HARD STOP: Before writing ANY component, page, or UI pattern — open this folder and check. No exceptions. No skipping. Code first = rework guaranteed.

---

## PROJECT SNAPSHOT

**What:** Indian pharmacy management SaaS — billing, inventory, purchases, GST, compliance.
**Stack:** React + Tailwind CSS + Shadcn/UI · Python FastAPI + SQLAlchemy 2.0 async · PostgreSQL
**Auth:** JWT
**Backend port:** 8000 (`uvicorn main:app --host 0.0.0.0 --port 8000 --reload`)
**Frontend env:** No `REACT_APP_BACKEND_URL` needed locally — `craco.config.js` proxies `/api/*` to `localhost:8000` automatically (works whether the browser and backend share a machine or not). Set the env var only when pointing at a different backend (staging, a different port).

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
| 23 | `docs/23_PURCHASES_ACCEPTANCE_SPEC.md` | Purchases + Purchase Returns full use-case spec vs. real code — every UC rated Built/Partial/Missing with evidence. The template for future module acceptance specs. |

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
- **A bug that slips past a written rule gets named, not just fixed.** When a
  real bug is found that a CLAUDE.md/docs rule should have prevented, Claude
  says which rule, in the chat response itself, and whether it wasn't
  enforced (a tooling gap) or wasn't followed (an execution gap) — then
  closes the gap, automated gate first, doc wording only if no automated
  check is realistic — and logs it in `docs/15_ROADMAP.md`'s RULE MISSES LOG.
  Abinash shouldn't have to ask "which rule broke" after the fact — see that
  section for the full process and the first logged example.
- **Docs and commit messages: bullets, not paragraphs.** Added August 23,
  2026 — long prose entries in `docs/15_ROADMAP.md` and commit messages
  were burning tokens for no real benefit. Roadmap findings, fixes, and
  commit messages use short bullet points (what broke, why, what changed) —
  not multi-paragraph explanations. The RULE MISSES LOG's 5-step structure
  (name the rule, why it wasn't caught, fix, gate closed, log it) still
  applies — just written as bullets, not prose.
- **Batch fixes before spinning up servers to verify.** Added August 23,
  2026 — a live-verify pass (start backend+frontend, drive it, tear down)
  costs tokens; doing one per individual fix instead of one per batch was
  wasteful. Default:
  - If more than one fix is already known/queued for the same page or
    feature (e.g. an audit surfaces several bugs), list them all, get
    them approved, fix all of them, then do ONE verification pass.
  - Still verify immediately, without waiting to batch, when: it's a
    single isolated fix with nothing else pending, Abinash says it's
    urgent, or the fix is high-risk (money/stock/compliance logic) and
    needs its own check before moving on.
  - When in doubt, ask "want me to batch this with anything else you
    have queued, or verify now?" rather than guessing.
- **Chat replies stay under 100 words.** Added August 23, 2026, direct
  request. Applies to conversational answers, not code/docs/commit
  content — those keep whatever length the task genuinely needs.
- **Default to the standard, simpler fix over the flexible one.** Added
  August 24, 2026. When a bug fix has a design choice (e.g. reject
  outright vs. allow-with-a-flag), pick the simpler, more conventional
  option by default — reconsider only if real usage after launch shows
  a genuine need for the more flexible behavior. Don't build the
  flexible option speculatively.
- **Product manager first, project manager second.** Added August 25,
  2026, direct correction after Claude called Purchases "solid" from a
  docs/code audit alone — never having walked it as a real pharmacist's
  actual use case (new distributor, new medicine, zero starting data),
  which is exactly where it broke. A project manager organizes what
  already exists into a priority list. A product manager asks *why* the
  business/user needs something and what breaks without it — that
  reasoning comes first, before any list of what to build. Concretely:
  - Before proposing or building anything, state the business/user
    reasoning first — not a feature list.
  - A section isn't "done" because its screens pass review or a
    seeded-fixture test passes. It's done when someone (Claude) has
    walked it as ONE continuous use case starting from zero prior data
    for that flow — not a fixture that already has the distributor/
    medicine/whatever pre-created. See Manifesto item 15.
  - This is a standing rule specifically *because* conversation doesn't
    persist across sessions — this file does, read at the start of
    every session (see the top of this file). If it's not written
    here, it didn't happen, as far as the next session is concerned.

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

> Moved to where it can't silently drift out of sync with the code (August
> 2026) — this section used to hold ~80 lines of status/blockers/diary
> directly in this always-loaded file; several of those lines went stale
> and sat wrong for months before anyone caught it. That content still
> exists, just relocated to where an update to it is a normal part of
> shipping the feature it describes, not a second thing to remember:

- **Feature status** (what's built, in progress, planned per domain) →
  `docs/15_ROADMAP.md` status tables.
- **Pre-launch blockers** (data-loss/security gaps, deploy checklist) →
  `docs/13_DEPLOYMENT.md` → PRE-LAUNCH BLOCKERS.
- **Local dev setup** (terminal commands, ports, env) →
  `docs/13_DEPLOYMENT.md` → LOCAL SETUP.
- **Known issues / tech debt** → `docs/15_ROADMAP.md` → KNOWN ISSUES / TECH DEBT.

Read those before assuming a feature isn't built or a bug isn't already
known — don't trust a stale memory of this section from an old session.

---

## QUICK-REFERENCE RULES

### Page structure (every page, no exceptions)
```jsx
<div className="px-8 py-6 min-h-screen bg-page">
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
> **(auto)** = a real `scripts/design-guard.sh` rule blocks this — checked on
> every commit/PR whether or not anyone remembers to look. **(manual)** = no
> guardrail exists yet; depends on someone actually checking. This distinction
> matters — `MoreMenu` drifted for months specifically because it used to be
> manual with nothing watching. Prefer adding an (auto) check over trusting
> a new (manual) one.

- [ ] Zero raw `<button>` tags **(auto — Rule 1)**
- [ ] Zero hardcoded hex in className **(auto — Rule 2)**
- [ ] Zero `hover:bg-[#...]` patterns **(auto — Rule 3)**
- [ ] No file over 300 lines **(auto — Rule 4)**
- [ ] Zero direct `@/components/ui/button` imports in pages **(auto — Rule 5)**
- [ ] New files use `.tsx` extension, not `.jsx` **(auto — Rule 6)**
- [ ] Zero hand-rolled "More options" dropdowns — always `<MoreMenu>` from shared **(auto — Rule 7)**
- [ ] `tailwind.config.js` and `colors_and_type.css` design tokens agree **(auto — Rule 8)**
- [ ] Every page uses `<PageHeader>` — no inline `<h1>`, no subtitle **(manual)**
- [ ] Every multi-view page uses `<PageTabs>` **(manual)**
- [ ] Every LIST page root = `px-8 py-6 min-h-screen bg-page` — never `flex flex-col h-full` **(manual)**
- [ ] `flex flex-col h-full` is ONLY for workspace pages: BillingWorkspace, PurchaseNew — nowhere else **(manual)**
- [ ] Zero inline pill `.map()` patterns — always `<FilterPills>` from shared **(manual)**
- [ ] Zero `import` statements after `const` declarations **(manual — ESLint may catch some cases)**
- [ ] `npx tsc --noEmit` passes with zero errors **(manual — not yet wired into design-guard.sh)**
- [ ] Run `bash scripts/design-guard.sh` — must exit 0 before any PR

### What's next
> Moved to `docs/15_ROADMAP.md` (August 2026) — this list fully duplicated
> two other lists (the launch-blocker list above it, and `docs/15`'s own
> "MANIFESTO ITEMS NOT YET BUILT" section, which already covered Sheets/
> Zod/Error retry/Command Palette in far more detail: What/Where/Why/Rule
> per item, not a one-liner). See `docs/15_ROADMAP.md`'s Billing table and
> "MANIFESTO ITEMS NOT YET BUILT" section for the current, single copy of
> this list.

### Dead files (already deleted)
- `frontend/src/pages/InventorySearch/components/InventoryHeader.jsx`
- `frontend/src/pages/Settings/components/SettingsTabs.jsx`
- `frontend/src/pages/Reports/components/ReportTypeCards.jsx`
- `frontend/src/components/ActivityTimeline.js`

### Stale docs (do not update, do not trust)
`PHARMACARE_RULES.md` · `PHARMACARE_DESIGN_SKILL.md` · `PHARMACARE_DESIGN_BRIEF.md` · `CONTEXT.md` · `PROGRESS.md` · `DECISIONS.md` · `TECH_SPEC.md` · `PHARMACARE_DATABASE_SCHEMA.md`

### Deleted files (do not recreate)
- `memory/PRD.md` — mentioned MongoDB (replaced by PostgreSQL) and teal as primary colour (replaced by brand blue #4682B4). Deleted April 19, 2026. Source of truth is `docs/` folder.
