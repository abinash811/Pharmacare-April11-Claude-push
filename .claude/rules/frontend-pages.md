---
paths:
  - "frontend/src/pages/**/*"
  - "frontend/src/components/**/*"
---

# Frontend Page & Component Quick-Reference

Moved out of `CLAUDE.md` Sep 18, 2026 to keep that file under Anthropic's
documented 200-line target — this only loads when you're actually touching
a page or shared component, instead of every session regardless of task.

## Page structure (every page, no exceptions)
```jsx
<div className="px-8 py-6 min-h-screen bg-page">
  <PageHeader title="..." actions={...} />
  <PageTabs tabs={TABS} activeTab="..." onChange={...} />
  <div className="bg-white rounded-xl border border-gray-200">
    {/* content */}
  </div>
</div>
```

## Tab routes
| Tab bar | Route A | Route B |
|---------|---------|---------|
| Billing | `/billing` | `/billing/returns` |
| Purchases | `/purchases` | `/purchases/returns` |
| Inventory | `/inventory` | `/inventory/stock-movements` |
| Reports | `/reports` | `/reports/gst` |

## Component audit (check before every PR)
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
- [ ] Zero hand-rolled `animate-pulse` skeletons — always `TableSkeleton`/`PageSkeleton`/`CardSkeleton`/`InlineLoader`, or the raw `Skeleton` primitive composed for a one-off shape **(auto — Rule 9)**
- [ ] Every loading state actually has a skeleton — no `return null`/blank screen while data fetches **(manual — a missing skeleton isn't grep-able like a hand-rolled one)**
- [ ] Every page uses `<PageHeader>` — no inline `<h1>`, no subtitle **(manual)**
- [ ] Every multi-view page uses `<PageTabs>` **(manual)**
- [ ] Every LIST page root = `px-8 py-6 min-h-screen bg-page` — never `flex flex-col h-full` **(manual)**
- [ ] `flex flex-col h-full` is ONLY for workspace pages: BillingWorkspace, PurchaseNew — nowhere else **(manual)**
- [ ] Zero inline pill `.map()` patterns — always `<FilterPills>` from shared **(manual)**
- [ ] Zero `import` statements after `const` declarations **(manual — ESLint may catch some cases)**
- [ ] `npx tsc --noEmit` passes with zero errors **(auto — script Rule 10)**
- [ ] Every caught-error `toast.error(...)` shows the real reason, not a hardcoded generic (Manifesto rule 10) **(auto — script Rule 14, added Sep 12, 2026)**
- [ ] Run `bash scripts/design-guard.sh` — must exit 0 before any PR

## Dead files (already deleted — do not recreate)
- `frontend/src/pages/InventorySearch/components/InventoryHeader.jsx`
- `frontend/src/pages/Settings/components/SettingsTabs.jsx`
- `frontend/src/pages/Reports/components/ReportTypeCards.jsx`
- `frontend/src/components/ActivityTimeline.js`
