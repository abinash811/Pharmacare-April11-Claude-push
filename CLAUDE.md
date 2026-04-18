# PharmaCare — Claude Code Master Reference
# Single source of truth. All other docs (PHARMACARE_RULES.md, PHARMACARE_DESIGN_SKILL.md,
# PHARMACARE_DESIGN_BRIEF.md, CONTEXT.md, PROGRESS.md) are supplementary history only.
# Read THIS FILE at the start of every session. Nothing else is required.
# Last updated: April 18, 2026

---

## THE PHARMACARE MANIFESTO

Seven principles that govern every decision in this codebase.

1. **One component, one way.** Every button is `<AppButton>`. Every page header is `<PageHeader>`. Every tab bar is `<PageTabs>`. No raw `<button>` tags, no inline title `<div>`, no custom tab UI anywhere.

2. **Design tokens, not hex.** `bg-brand`, `hover:bg-brand-dark`, `text-brand`, `border-brand`. Never `#4682B4`, never `#3a6fa0`, never `bg-[#anything]` in component code.

3. **Every page looks like the same product.** Same header height, same tab underline, same button weights. A user switching from Billing to Reports to Settings should feel zero visual friction.

4. **No file over 300 lines.** If it grows past 300, split it. Orchestrators import components — they don't contain JSX logic.

5. **Money is integer paise. Always.** ₹1 = 100 paise. Never floats for currency calculations. Display only converts.

6. **Soft deletes only.** Pharmacy data is compliance data. Hard delete is never acceptable.

7. **International standard or nothing.** If it wouldn't ship in Linear, Notion, or Stripe — don't ship it here.

---

## PROJECT SNAPSHOT

**What:** Indian pharmacy management SaaS — billing, inventory, purchases, GST, compliance.
**Stack:** React + Tailwind CSS + Shadcn/UI · Python FastAPI + SQLAlchemy 2.0 async · PostgreSQL
**Auth:** JWT
**Active branch:** `claude/compassionate-agnesi`
**Backend port:** 8000 (`uvicorn main:app --host 0.0.0.0 --port 8000 --reload`)
**Frontend env:** `REACT_APP_BACKEND_URL=http://localhost:8000`

> `backend/server.py` = original MongoDB backup. Keep it. Never run it on port 8000.

---

## DESIGN TOKENS

### Colors
| Token | Tailwind class | Use |
|-------|---------------|-----|
| Brand primary | `bg-brand` / `text-brand` / `border-brand` | Buttons, active tabs, links |
| Brand hover | `hover:bg-brand-dark` | All brand button hovers |
| Brand subtle bg | `bg-brand-subtle` or `bg-brand/10` | Badge bg on active tab count |
| Page canvas | `bg-[#F8FAFB]` | Page background |
| Surface | `bg-white` | Cards, tables, modals |
| Border | `border-gray-200` | All borders |
| Text primary | `text-gray-900` | Main content |
| Text secondary | `text-gray-600` | Supporting copy |
| Text muted | `text-gray-500` | Helpers, captions |
| Sidebar bg | `#1a2332` (dark navy) | Layout sidebar only |

**Semantic colors (muted only — never bg-X-100):**
- Success: `bg-green-50 text-green-700 border-green-200`
- Warning: `bg-amber-50 text-amber-700 border-amber-200`
- Error: `bg-red-50 text-red-700 border-red-200`
- Info: `bg-blue-50 text-blue-700 border-blue-200`

**Banned forever:** Any teal (`bg-teal-*`, `text-teal-*`), bright cyan hex (`#13ecda`, `#00CED1`), hardcoded `#4682B4` or `#3a6fa0` in component code, `bg-X-100` semantic shades.

### Typography
| Role | Class |
|------|-------|
| Page title | `text-xl font-bold text-gray-900` |
| Section heading | `text-lg font-semibold text-gray-900` |
| Table header | `text-xs font-medium text-gray-500 uppercase tracking-wider` |
| Button label | `text-sm font-semibold` |
| Badge | `text-xs font-medium` |
| Money/numbers | `text-sm font-semibold tabular-nums` |

### Spacing
| Context | Value |
|---------|-------|
| Page wrapper | `px-8 py-6` |
| Card padding | `p-6` |
| Table cell | `px-4 py-3` |
| Table row height | `h-10` (Zoho density) |
| Button gap | `gap-2` |

---

## SHARED COMPONENT MAP

All shared components live in `frontend/src/components/shared/`.
Import path: `import { X } from '@/components/shared'`

### `<PageHeader>`
Every page's top header. Handles title, subtitle, and right-side actions.
```jsx
<PageHeader
  title="Billing"
  subtitle="Manage bills and sales returns"
  actions={<><AppButton variant="secondary">Export</AppButton><AppButton icon={<Plus />}>New Bill</AppButton></>}
/>
```
Used inside a `px-8 py-6` page wrapper. Bleeds edge-to-edge with `-mx-8 -mt-6 mb-6`.

### `<PageTabs>`
Underline-style tab bar. Used for route-based and state-based tab navigation.
```jsx
const TABS = [
  { key: 'bills',   label: 'Bills' },
  { key: 'returns', label: 'Sales Returns', count: 3 },
];
<PageTabs tabs={TABS} activeTab="bills" onChange={(key) => navigate('/billing/returns')} />
```
- Default: bleeds edge-to-edge with `-mx-8 -mt-6 mb-6` (use inside `px-8 py-6` wrapper)
- `noBleed` prop: use in sticky/h-full layouts (Customers page)
- Active tab: `border-brand text-brand`
- Count badge: `bg-brand-subtle text-brand` (active) / `bg-gray-100 text-gray-500` (inactive)

### `<AppButton>`
The ONLY way to render a button. Never use raw `<button>` tags.
```jsx
// Variants
<AppButton>Save</AppButton>                                    // primary (default)
<AppButton variant="secondary">Cancel</AppButton>              // gray bg
<AppButton variant="outline" icon={<Printer />}>Print</AppButton>  // bordered
<AppButton variant="danger" loading={deleting}>Delete</AppButton>  // red
<AppButton variant="ghost" icon={<X />} iconOnly />            // icon only

// Sizes: sm | md (default) | lg
// loading=true → spinner + disabled
// className → layout overrides ONLY (width, margin) — NEVER colors
```

### `<SearchInput>` — controlled search with debounce
### `<StatusBadge>` — `status` prop, auto-colors
### `<TableSkeleton>` / `<InlineLoader>` / `<PageSkeleton>` / `<CardSkeleton>` — loading states
### `<EmptyState>` + named variants — `BillingEmptyState`, `InventoryEmptyState`, etc.
### `<ConfirmDialog>` / `<DeleteConfirmDialog>` / `<DiscardConfirmDialog>` — modal confirmations
### `<PaginationBar>` — page/offset pagination
### `<DataCard>` — metric/KPI cards
### `<DateRangePicker>` — date range input

---

## PAGE ANATOMY

Every page follows this exact structure:

```jsx
// Route page component
export default function BillingPage() {
  return (
    <div className="px-8 py-6 min-h-screen bg-[#F8FAFB]">
      <PageHeader title="Billing" actions={...} />
      <PageTabs tabs={BILLING_TABS} activeTab="bills" onChange={...} />

      {/* content — no extra padding, PageTabs already provides bottom margin */}
      <div className="bg-white rounded-xl border border-gray-200">
        ...
      </div>
    </div>
  );
}
```

---

## TAB PAGES (route-based)

Each paired page renders `<PageTabs>` with its own route as active. Tab click navigates.

| Tab bar | Route A | Route B |
|---------|---------|---------|
| Billing | `/billing` (Bills) | `/billing/returns` (Sales Returns) |
| Purchases | `/purchases` (Purchases) | `/purchases/returns` (Purchase Returns) |
| Inventory | `/inventory` (Products) | `/inventory/stock-movements` (Stock Log) |
| Reports | `/reports` (Reports) | `/reports/gst` (GST Report) |

Sidebar nav only shows the primary route for each group — the secondary routes are accessed via tabs only.

---

## SIDEBAR NAV GROUPS

```
DAILY OPS     → Dashboard, Billing, Inventory, Purchases
RELATIONSHIPS → Customers, Suppliers
REPORTS       → Reports
COMPLIANCE    → Sch H1 Register, Audit Log
ADMIN         → Settings, Team
```

(GST Report and Stock Log are removed from sidebar — they are tabs now.)

---

## FILE SIZE RULES

- Max 300 lines per file
- Orchestrator pages: only state + composition, no inline JSX logic
- Extract to `components/` subfolder when a section exceeds ~80 lines
- Hooks in `hooks/` subfolder: `useXxx.js`

---

## ARCHITECTURE RULES

1. **Money:** Always integer paise in state/API. `formatCurrency(paise)` for display only.
2. **Soft deletes:** `is_deleted = true` + `deleted_at` timestamp. Never `DELETE FROM`.
3. **Bill numbers:** Generated only on settle/save — never for drafts. Atomic sequence, no duplicates.
4. **Snapshot billing:** Bill stores product name/price at time of sale — never a live FK join for display.
5. **Concurrent writes:** Use DB-level sequence (`nextval`) for bill numbers — never `MAX(id) + 1`.

---

## COMPONENT AUDIT RULES (check before every PR)

- [ ] Zero raw `<button>` tags (only `<AppButton>`)
- [ ] Zero hardcoded hex in className (only design tokens)
- [ ] Zero `hover:bg-[#...]` patterns
- [ ] Zero `text-gray-900` on `bg-brand` backgrounds
- [ ] Zero `font-medium` on button labels (must be `font-semibold`)
- [ ] Every page uses `<PageHeader>` — no inline `<h1>/<h2>` in page root
- [ ] Every multi-view page uses `<PageTabs>` — no custom tab UI

---

## WHAT'S NEXT (not yet built)

These manifesto requirements are confirmed missing — build in this order:

1. **Sheets (right-side drawers)** — replace centered modals for all data-entry forms (new bill, new purchase, add medicine). Use Shadcn `<Sheet>` with `side="right"`, 480px wide.
2. **Zod validation** — all forms must use Zod schemas + `react-hook-form`. No uncontrolled validation.
3. **Error retry states** — network errors show Shadcn `<Alert variant="destructive">` + Retry button. No silent failures.
4. **Command Palette** — `Cmd+K` opens global search (bills, medicines, customers, suppliers).
5. **Speed keys** — `n` = new, `f` = filter, `/` = search, `Esc` = close, `Enter` = confirm.

---

## DEAD FILES (already deleted)

- `frontend/src/pages/InventorySearch/components/InventoryHeader.jsx` — replaced by `<PageHeader>`
- `frontend/src/pages/Settings/components/SettingsTabs.jsx` — replaced by `<PageTabs>`
- `frontend/src/pages/Reports/components/ReportTypeCards.jsx` — replaced by inline pill buttons
- `frontend/src/components/ActivityTimeline.js` — unused orphan

---

## SUPPLEMENTARY DOCS (historical reference only)

These files exist but are no longer authoritative. Do not add new rules to them.

- `PHARMACARE_RULES.md` — old component patterns, superseded
- `PHARMACARE_DESIGN_SKILL.md` — old design spec, superseded
- `PHARMACARE_DESIGN_BRIEF.md` — original brief, keep for context
- `CONTEXT.md` — project history
- `PROGRESS.md` — task history
- `DECISIONS.md` — architectural decision log
- `TECH_SPEC.md` — backend spec
- `PHARMACARE_DATABASE_SCHEMA.md` — DB schema reference
