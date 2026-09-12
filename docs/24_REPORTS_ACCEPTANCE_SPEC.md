# PharmaCare — Reports & Compliance Acceptance Spec
# Version: 2.2 | Last updated: September 12, 2026
# Type: Living Status
# Source: product-review skill — business reasoning + eVitalRx/Marg ERP/
# Pharmasoft benchmark + live zero-data browser walkthrough (a genuinely
# fresh, never-billed pharmacy) + a dedicated code-audit pass over every
# field the frontend reads against the real backend response, cross-checked
# against docs/08_ARCHITECTURE.md's cross-cutting consumers map. Every row
# below cites file:line evidence, matching docs/23_PURCHASES_ACCEPTANCE_SPEC.md's
# format (the template for future module specs).

---

## HOW TO READ THIS

- ✅ Built — verified against real code/tests, matches the use case.
- 🔄 Partial — built but missing something specific, named per row.
- ❌ Missing — searched, confirmed absent.
- 🐛 flags a **live bug**, not a missing feature — something currently shipped that is actively wrong.

This is the acceptance spec going forward. When work closes a gap, update its
row here (status + evidence), not just in `docs/15_ROADMAP.md`.

---

## WHY THIS SECTION MATTERS (business reasoning, before any feature list)

Per `docs/01_PRODUCT.md`'s personas: **Meena (Accountant)** visits weekly/monthly
specifically to file GSTR-1/GSTR-3B — her one job in this system is pulling a
correct GST number and handing it to the government. **Rajesh (Owner)** checks
Reports for margin/sales visibility and pulls the Dashboard on his phone daily.
If the GST report is wrong or unusable, the pharmacy either can't file on time
(late-filing penalty) or files a wrong number (audit risk) — this is the one
module in the app where a bug doesn't just annoy a user, it creates legal/
financial exposure for a real small business. A crashing or silently-wrong
report is worse than no report: a pharmacist who trusts a wrong number doesn't
know to double check it by hand.

---

## EXECUTIVE SUMMARY — READ THIS FIRST

### 🐛 Live bugs — Batch 1 fixed Sep 12, 2026, verified live + regression tests

1. ~~The GST Report page hard-crashes, 100% of the time, with zero or real data.~~ ✅ **Fixed.**
   Live-confirmed: registered a genuinely fresh pharmacy, created one real bill,
   clicked "Generate Report" — full React error boundary ("Something went
   wrong — Cannot read properties of undefined (reading 'breakup')"), not a
   partial/wrong render. `GSTReport.js` reads a response shape
   (`reportData.sales_gst.breakup`, `.purchase_gst.breakup`,
   `.net_gst_liability`) that **does not exist anywhere** on what
   `GET /reports/gst` actually returns (`sales`, `purchases`, `sales_summary`,
   `purchases_summary`, `net_liability` — confirmed via direct API call,
   real JSON pasted in UC-R05 below). This was already flagged as bug #3 in
   `docs/23_PURCHASES_ACCEPTANCE_SPEC.md` from the Purchases pass — confirmed
   still true, and worse than that summary implied: **every** top-level field
   the component reads is wrong, not just a couple, so nothing on the page
   can ever render once a report is generated. Zero test coverage.
2. ~~The GST report silently excludes every credit sale from output tax.~~ ✅ **Fixed.**
   `get_gst_report`'s sales-side query filters `BillORM.status == "paid"`
   only (`reports.py:292`) — but a `status="due"` bill is a fully confirmed,
   stock-deducted, non-draft sale (`billing.py:511-518`) that simply hasn't
   been paid yet. GST liability arises at the point of supply, not at
   payment collection. **A pharmacy that sells even one item on credit has
   that entire sale invisible to its own GST report — understating what it
   owes the government.** Every sibling endpoint in the same file
   (`sales-summary`, `sales`, all `analytics/*`) correctly includes
   `status IN ("paid","due")`; only the GST report itself got this wrong.
   Currently masked by bug #1 (the page can't render at all to show the
   wrong number), but must be fixed in the same change — fixing only the
   field names would ship a GST report that *looks* right and is still
   silently wrong for any pharmacy with outstanding credit sales.
3. ~~The Reports page's "Stock" tab has no real backend behind it.~~ ✅
   **Fixed — removed entirely** (decision made per the spec's own lean:
   none of eVitalRx/Marg/Pharmasoft have a separate "Stock" report either;
   real inventory reporting already lives at `/inventory`). Was: silently
   fell back to Sales data under a "Stock Report" heading, plus a dead
   link to `/inventory-v2` (a route that never existed).
4. ~~Excel export is broken for 3 of 4 exportable reports~~ ✅ **Fixed**
   for Low Stock and Expiry (real field names now used, plus a derived
   Status label matching the on-screen badge). The "Inventory" case was
   removed along with the Stock tab (bug #3) rather than fixed, since the
   tab itself no longer exists.
5. ~~No permission gate on 10 of this router's 12 endpoints~~ ✅ **Fixed**
   for GST/Sales/Low-Stock/Expiry/Schedule H1/Audit Log (both endpoints) —
   all now require `reports:view`, the permission that already existed in
   the catalog and that manager already had granted. Dashboard analytics
   deliberately left ungated (a product decision, not an oversight — see
   the Cross-Cutting Permissions Matrix below).
6. ~~Schedule H1 Register's permission gate ... hardcoded~~ ✅ **Fixed** —
   migrated to `has_permission(current_user, "reports:view", db)`, which
   preserves identical real-world access (admin has `"*"`, manager has
   `reports:view`, cashier/inventory_staff don't).

### ❌ Structural gaps (not bugs — never built)

7. **No HSN-wise GST breakdown** — the report groups strictly by `gst_rate`
   (0/5/12/18), never by HSN code, even though `hsn_code` is a real column
   on both `BillItem` and `PurchaseItem`. Marg ERP's own marketing
   explicitly leads with "HSN-wise reporting" as a named GST feature (see
   Competitor Benchmark below) — this is a real, named competitor gap, not
   a nice-to-have, since GSTR-1 filing in practice is commonly done
   HSN-wise. Separately: **`docs/21_FEATURES.md` claims the report already
   is HSN-wise — it is not; that doc is stale/wrong against real code**
   (`docs/07_BUSINESS_LOGIC.md`'s description is the accurate one).
8. **Four fully-built backend endpoints have zero frontend caller** —
   `GET /reports/sales`, `GET /reports/dashboard`, `GET /analytics/summary`,
   `GET /analytics/daily` all exist, work, and have `apiUrl` helpers
   defined, but nothing in the app ever calls them. Real, working code
   nobody can reach — same shape as the Purchases spec's UC-P16
   (`units_per_pack` UI) and P40 (`/analytics/purchases`) findings.
9. No margin/profitability report, no Tally export, no price-variation
   report, no scheduled-drugs report — all named, real features on
   competitor sites (see Competitor Benchmark).
10. No supplier-wise or product-wise breakdown on any report; no
    GSTR-3B-shaped export (a raw JSON/CSV of the numbers, not a
    government-portal-ready file).

### What actually works, confirmed live

- Sales, Low Stock, and Expiry reports on the main Reports page: correct
  data, correct fields, correct CSV export, load cleanly from zero data.
- Schedule H1 Register: correct fields end-to-end, correctly permission-gated,
  clean CSV export, loads cleanly from zero data.
- Dashboard analytics (`/analytics/dashboard`): every field the frontend
  reads matches the real backend response — the one fully clean, zero-gap
  consumer found in this whole audit.
- GST report's underlying **math** (rate-bucket totals, CGST/SGST split,
  sales-return and purchase-return netting formulas) is arithmetically
  correct where it applies — the bugs are in the status filter and the
  frontend's field names, not the tax calculation itself.

---

## COMPETITOR BENCHMARK (eVitalRx, Marg ERP, Pharmasoft)

Researched fresh Sep 12, 2026 — `docs/01_PRODUCT.md` §10 had no
Reports/GST-specific competitor notes yet (only Inventory-side notes from
Sep 5/12).

- **Marg ERP**: "1,000+ built-in reports covering GST, profit & loss, and
  stock analysis"; GSTR-1/GSTR-3B built-in with **HSN-wise reporting** and
  export in **GST-portal-ready format**; ITC tracking; medicines pre-mapped
  to HSN codes for accurate classification. [Source](https://margcompusoft.com/m/what-are-the-gst-ready-features-in-pharmacy-management-software-for-distributors/), [Source](https://care.margcompusoft.com/margerp/gstr1/17852/1/How-to-see-GSTR-1-GSTR)
- **eVitalRx**: named report list includes **GST Reports, Item-wise Margin
  Reports, Scheduled Drugs Report, Expiry Reports, Price Variation
  Reports**, plus direct **Tally integration** for GST-compliant
  accounting handoff. [Source](https://www.evitalrx.in/)
- **Pharmasoft**: auto-generates **GSTR-1 and GSTR-2** in a CA/filing-ready
  export format; item-wise full purchase→sales history (already partially
  matched by `Product.transactions`, per the Purchases spec). [Source](https://yadavsoftware.com/), [Source](https://pharma247.in/blogs/gst-report-generator-download-gstr-1-3b-purchase-gst-reports-instantly)

**Real gaps this surfaces, not yet in PharmaCare**: HSN-wise GST grouping,
a GST-portal-ready export format (today's export is a plain CSV/Excel of
internal numbers, not a GSTR-1 JSON/Excel template), item-wise margin
report, price-variation report, Tally export, a named "Scheduled Drugs
Report" (Schedule H1 Register covers the H1 subset of this, not the
broader Schedule H concept).

---

## 1. REPORTS LANDING PAGE (Sales / Low Stock / Expiry / Stock tabs)

> Note: the real tabs are **Sales / Low Stock / Expiry / Stock**
> (`Reports/index.jsx:20-25`) — there is no "Purchases" tab on this page.
> Purchase reporting lives entirely on the Purchases list page itself
> (`docs/23_PURCHASES_ACCEPTANCE_SPEC.md` P33), a real structural fact
> `docs/21_FEATURES.md` doesn't document at all (that doc only covers GST
> Report / Schedule H1 / Audit Log under "Reports & Compliance").

### UC-R01: Sales report — ✅ Built
Correct fields both ways (`bill_number/date/customer_name/items_count/payment_method/total_amount`, `reports.py:76-83` ↔ `ReportTables.jsx:31-38`), correct `pharmacy_id`/`status IN (paid,due)`/`deleted_at` scoping, indexed date filter. Live-verified zero-data → clean empty state → real bill appears after refresh with correct total. CSV and Excel export both correct.

### UC-R02: Low Stock report — 🔄 Partial
Table data correct (`reports.py:122-127` ↔ `ReportTables.jsx:66-72`), live-verified clean empty state. **Excel export broken** — `formatLowStockReport` (`excelExport.js:105-116`) reads `item.name`/`.status`/`.category`, none of which exist on the real row (`product_name`, no status/category fields at all) — Product/Status/Category columns always blank. CSV export unaffected (generic).

### UC-R03: Expiry report — 🔄 Partial
Table data correct (`reports.py:164-169` ↔ `ReportTables.jsx:112-117`), live-verified clean empty state with a working day-range selector (30/60/90/180). **Excel export broken** — `formatExpiryReport` (`excelExport.js:118-129`) reads `item.stock`/`.days_left`/`.value`/`.status` — real fields are `qty`/`days_to_expiry`/`stock_value` (no status field) — Stock/Days Left/Value/Status columns always blank. CSV export unaffected.

### UC-R04: "Stock" tab — ❌ Not a real report
🐛 No `'inventory'` entry exists in `useReports.js`'s report-type config (`:23-29`) — the tab silently reuses the Sales report's fetch and shows Sales numbers under a "Stock Report" heading (live-confirmed: "Total Sales: ₹105.00 / Total Bills: 1" shown on this tab after creating one bill). The only real content is a stub message + a "Go to Inventory" link pointing at `/inventory-v2`, **a route that does not exist** (`App.js` only registers `/inventory`) — live-confirmed clicking it silently redirects to `/dashboard`. Exporting from this tab produces either raw sales rows mislabeled "Inventory_Report" (CSV) or an all-blank spreadsheet (Excel, `formatInventoryReport` reads fields like `item.total_stock`/`.stock_value` that exist on neither the sales rows actually fetched nor any inventory endpoint). This tab should either be removed (real inventory reporting already exists at `/inventory`) or wired to a real inventory-summary endpoint — currently it's actively misleading, not just incomplete.

---

## 2. GST REPORT

### UC-R05: Generate GST report for a date range — 🐛 Completely broken
Live-confirmed, zero-data pharmacy, one real ₹105 bill (5% GST):
```
GET /api/reports/gst?start_date=2026-09-01&end_date=2026-09-12  →  200 OK
{
  "sales": [{"gst_rate": 5.0, "taxable_amount": 100.0, "cgst": 2.5, "sgst": 2.5, "igst": 0.0, "total_gst": 5.0}],
  "purchases": [],
  "sales_summary": {"total_taxable": 100.0, "cgst": 2.5, "sgst": 2.5, "igst": 0.0, "total_gst": 5.0},
  "purchases_summary": {"total_taxable": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0},
  "net_liability": 5.0,
  "period": {"start_date": "2026-09-01", "end_date": "2026-09-12"}
}
```
`GSTReport.js` reads `reportData.sales_gst.breakup` (`:136`), `.sales_gst.total_taxable/.total_cgst/.total_sgst/.total_igst/.total_gst` (`:148-152`), `.purchase_gst.breakup` (`:178`), `.purchase_gst.total_*` (`:190-194`), and `.net_gst_liability` (`:209,215,219,226,231`) — **not one of these top-level keys exists** on the real response above (real keys: `sales`, `purchases`, `sales_summary`, `purchases_summary`, `net_liability`). Clicking "Generate Report" throws `TypeError: Cannot read properties of undefined (reading 'breakup')` inside the render, caught only by the app's top-level `ErrorBoundary` — a full "Something went wrong" screen, reproduced identically with real transaction data and with none. Zero test coverage references this endpoint or component (matches `docs/23`'s note that the GST report has no test anywhere in the suite).

### UC-R06: GST liability calculation — 🐛 Understates real liability
Math is correct where it runs (CGST/SGST 50/50 split, sales-return and purchase-return netting both verified against the exact paise formulas `create_sales_return`/`create_purchase_return` actually write) — but the sales-side query filters `BillORM.status == "paid"` only (`reports.py:292`), excluding every confirmed-but-unpaid (`status="due"`) credit sale. A `"due"` bill has already deducted stock and is not a draft (`billing.py:511-518`) — it is a real, GST-liable supply. Every sibling report/analytics endpoint in the same file correctly uses `status IN ("paid","due")`; only this one doesn't. **A pharmacy that sells on credit today would file an understated GST number the moment bug #1 is fixed and this one isn't caught alongside it.**

### UC-R07: HSN-wise breakdown — ❌ Missing
Grouped strictly by `gst_rate` (`reports.py:297-298,334`) — `hsn_code` (a real column on both `BillItem` and `PurchaseItem`) is never read anywhere in this endpoint. `docs/21_FEATURES.md:291,300` claims the report is "HSN-wise" — **confirmed false against real code; that doc is stale.** `docs/07_BUSINESS_LOGIC.md`'s "grouped by gst_rate, not HSN" description is the accurate one. Real, named competitor gap (Marg ERP explicitly markets HSN-wise GSTR-1 reporting).

### UC-R08: Export GST report — ❌ Unreachable
CSV export code exists (`GSTReport.js:36-60`, reading the same wrong field names as the render) but the page crashes before the Export button can ever appear. No Excel export offered for this report at all, unlike Sales/Low-Stock/Expiry.

### UC-R09: Permission gate on GST export — ❌ Missing
No role check anywhere in `get_gst_report` — live-confirmed a plain `cashier` account gets `200 OK` pulling the full report. Matches `docs/23`'s finding #15 on the purchases side, confirmed here as a gap in `reports.py`'s own code too.

### UC-R10: IGST support — ❌ Not populated (by design, matches known scope)
`igst` fields exist in the response shape and are always 0 — consistent with the already-known, deliberately-deferred single-state-only Phase 1 decision (same as Purchases' UC-P21).

---

## 3. SCHEDULE H1 REGISTER

### UC-R11: View/filter the register — ✅ Built
Every field the frontend reads matches the real backend response exactly (`product_name, quantity, batch_number, prescriber_name, prescriber_registration_number, patient_name, patient_address, patient_age, supply_date, id` — `reports.py:397-408` ↔ `ScheduleH1Register.jsx:67-71,87-91,198-219`, zero mismatches). Live-verified: loads cleanly from zero data with a correct "no entries yet" empty state and a working date-range picker (defaulted to the Indian FY, 01 Apr–31 Mar).

### UC-R12: Permission gate — 🔄 Partial (gated, but not via the real permission system)
`role not in ["admin","manager"]` is a hardcoded string check (`reports.py:386-389`), not `has_permission()`/`ALL_PERMISSIONS` — live-confirmed correctly blocking a `cashier` account (403). Works today, but can't be customized per-pharmacy the way Suppliers/Products permissions now can, and is the same "hardcoded role string instead of the real catalog" pattern already found and fixed once before in this codebase (`update_product`/`delete_product`, Sep 12, 2026).

### UC-R13: Export/print — ✅ Built
CSV export builds directly from the correct, matched fields; Print (`window.print()`) also present. No Excel export offered (not flagged as a gap — CSV is the format an inspector/CA actually needs here, unlike GST which is spreadsheet-shaped by nature).

---

## 4. DASHBOARD ANALYTICS (cross-referenced — the one fully clean consumer)

### UC-R14: Dashboard metrics — ✅ Built, zero mismatches found
Every field `Dashboard/hooks/useDashboard.js` and its child components read (`metrics.*`, `daily_trend[]`, `category_sales[]`, `top_products[]`, `top_customers[]`, `low_stock[]`, `expiring_soon[]`, `recent_bills[]`, `quick_stats.*`, `license_alert.*`) maps exactly to `GET /analytics/dashboard`'s real response (`reports.py:699-733`). This is the one area of this audit with no gap to report — included here specifically because `docs/08_ARCHITECTURE.md`'s cross-cutting map flags dashboard/analytics as an "Independent direct query" consumer of Billing that must be individually re-verified, and it holds up.

### UC-R15: Dead backend endpoints — ❌ Real code, zero reachability
`GET /reports/sales`, `GET /reports/dashboard`, `GET /analytics/summary`, `GET /analytics/daily` are fully implemented, correctly scoped, and have `apiUrl` helpers defined in `api.js` — but grepping the entire frontend finds no caller for any of the four. Not bugs, but real, working effort sitting unused — worth deciding whether to wire one in (e.g. `/analytics/summary`'s gross/return/net-sales shape could back a "Sales Summary" card somewhere) or delete them.

---

## 5. CROSS-CUTTING CHECK (per `docs/08_ARCHITECTURE.md`'s consumers map)

The map already flags GST report and dashboard/analytics as **Independent
direct query** consumers of Billing/Purchases/Returns — meaning nothing
forces them to stay in sync with those domains' own schema/rules. This
audit re-verified each one individually, as the map instructs:

| Consumer | Verified against | Result |
|---|---|---|
| GST report — sales side | `create_bill`'s status values (`billing.py:511-518`) | 🐛 Drifted — see UC-R06 |
| GST report — sales-return netting | `create_sales_return`'s pricing formula (`sales_returns.py:271-272`) | ✅ Formula matches exactly |
| GST report — purchase-return netting | `create_purchase_return`'s pricing formula (`purchase_returns.py:386-388`) | ✅ Formula matches exactly |
| GST report vs. purchase analytics — return status filtering | `get_purchase_analytics` filters `PurchaseReturnORM.status=="confirmed"`; GST report applies no status filter to returns at all | ⚠️ Inconsistent, currently harmless only because no cancel/reject path exists for either return type yet (matches `docs/23`'s PR07/PR14 findings) — would silently break the moment one is added |
| Dashboard analytics | `create_bill`, `Product`/`StockBatch` fields | ✅ No drift found |

Also newly found: `SalesReturn`/`PurchaseReturn` have no `(pharmacy_id, return_date)` index (unlike `Bill`/`Purchase`'s `idx_bills_date`/`idx_purchases_date`) — every GST report call range-scans both return tables unindexed. A latent performance gap, not a correctness one.

---

## 6. DEFINITION OF DONE — CURRENT VERDICT

**Reports & Compliance is not done, and the GST Report specifically is not
shippable in its current state** — it is not "partial," it cannot be used
at all, by any pharmacy, ever, without a code fix. Of the module's three
real surfaces:

- **Sales/Low-Stock/Expiry (main Reports page)**: mostly solid — real bug
  is limited to 3 broken Excel exports and one fake "Stock" tab with a
  dead link.
- **GST Report**: completely broken (render crash) and, once that's fixed,
  would still under-report liability for any pharmacy with credit sales,
  and has no permission gate at all. This is the single most consequential
  gap in this spec given the module's entire reason for existing (Meena's
  monthly filing).
- **Schedule H1 Register**: the one genuinely solid surface in this
  module — correct data, correctly gated, clean export.

---

## RECOMMENDED BUILD ORDER — SMALL BATCHES, NOT ONE SWEEP

**Batch 1 — GST report, stop the active bleeding (this is the module's core promise)** — ✅ done, Sep 12, 2026
1. ~~Fix `GSTReport.js`'s field names~~ — done, plus swapped both raw date-input pairs (Reports landing + GST) for the existing `DateRangePicker` component.
2. ~~Fix the sales-side status filter to `status IN ("paid","due")`~~ — done, same change as #1.
3. ~~Add a permission gate to `GET /reports/gst`~~ — done for GST/Sales/Low-Stock/Expiry/Schedule H1/Audit Log (both endpoints), using the real `reports:view` permission. Dashboard analytics left ungated by design.
   6 regression tests added (`test_reports_gst_and_permissions.py`), confirmed to fail against the pre-fix code via `git stash` and pass after. Full 364-test backend suite passes (2 unrelated pre-existing order-dependent flakes, confirmed to pass in isolation).

**Batch 2 — the fake "Stock" tab** — ✅ done, Sep 12, 2026
4. ~~Decide: wire it to a real inventory-summary endpoint, or remove the tab~~ — removed. None of eVitalRx/Marg/Pharmasoft have a separate "Stock" report either; real inventory reporting already lives at `/inventory`.

**Batch 3 — export correctness** — ✅ done, Sep 12, 2026
5. ~~Fix `excelExport.js`'s `formatLowStockReport`/`formatExpiryReport` field names~~ — done, with a derived Status label matching each table's own on-screen badge. The dead "Inventory" case was removed along with the Stock tab rather than fixed.
6. Add a real Excel/portable export to the GST report — not yet done, still pending (GST13, bigger scope — a filing-ready format, not just enabling the existing broken export code).

**Batch 4 — real gaps, prioritize with Abinash**
7. HSN-wise GST grouping (competitor-validated, schema already supports it).
8. Wire or delete the 4 dead backend endpoints (`/reports/sales`, `/reports/dashboard`, `/analytics/summary`, `/analytics/daily`).
9. Fix `docs/21_FEATURES.md`'s stale "HSN-wise" claim to match real behavior.
10. Item-wise margin report, price-variation report, Tally export, HSN/date index on `SalesReturn`/`PurchaseReturn` — genuinely new work, sequence by what a real pharmacist/accountant would ask for first.

Everything in the recommended batches was verified via direct code reads,
a live zero-data browser walkthrough, and a real API call — not inferred
from a variable name or docstring.

---

## FULL USE-CASE COVERAGE — FEATURES, FLOW, VISUAL DESIGN

> Rewritten Sep 12, 2026 to the same rigor as `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`
> (numbered UCs, each with a Built/Partial/Missing verdict and file:line or
> live evidence), per direct request ("before building let's research on
> what all features should be there how the flow should be, visual design
> and use cases to cover") followed by confirmation that the first pass
> (a shallow per-report-type paragraph) wasn't exhaustive enough. This
> section replaces that first pass. It decides *what Reports & Compliance
> should become*; the Executive Summary and Batches above are *what's
> currently broken*. A bug fix proceeds regardless of this section — a
> crash is a crash. Anything that reshapes a screen or adds a new report
> type still needs its own plain-language go-ahead, not a blanket "build
> all of this" from this document existing.
>
> Scope note: "Reports & Compliance" per `docs/21_FEATURES.md` and the
> app's own left-nav grouping covers GST Report, Schedule H1 Register,
> and Audit Log as named pages, plus the Reports landing page (Sales/Low
> Stock/Expiry/Stock) and Dashboard analytics as the module's other real
> surfaces. Two gaps in the first pass are fixed here: **Return Reports**
> (sales returns + purchase returns) had no section at all despite being
> a confirmed, total gap; **Audit Log** had no numbered UCs despite being
> one of the three named Compliance pages — and while researching it, a
> live, exploitable cross-tenant data leak was found and fixed in the same
> pass (`get_entity_audit_trail` had no `pharmacy_id` filter at all — see
> `docs/15_ROADMAP.md` RULE MISSES LOG, Sep 12, 2026).

### Design-system constraint (checked first, per the design HARD STOP)

No dedicated Reports/GST preview exists in `PharmaCare Design System/
preview/` (only generic `data-table.html` and `design-dashboard-zero.html`)
— nothing below invents new visual language. Every proposal reuses
components already documented in `docs/06_COMPONENTS.md`:

- **`DateRangePicker`** — Today/This Month/Last Month/Financial Year
  presets, defaults to the current Indian FY. **`ScheduleH1Register.jsx`
  already uses this correctly** (confirmed live: "01 Apr 2026 — 31 Mar
  2027" button). **Both the Reports landing page and `GSTReport.js` use
  raw native `<input type="date">` pairs instead** — a real "one
  component, one way" violation (Manifesto #1), and worse UX for the
  exact accountant use case this module exists for: Meena files monthly/
  quarterly, so "This Month"/"Last Month" presets save her from
  hand-picking two dates every time she visits.
- **`DataCard`** — already used correctly for GST's 3-tile summary and
  should back any new summary tiles (margin report's Gross Margin tile,
  a returns report's Total Refunded tile, etc.).
- **`FilterPills`** — not used anywhere in Reports today; a real candidate
  for an HSN-code or product-category filter, not required for the fix batch.
- **`TableSkeleton`** — Manifesto #16 requires this on every loading state.

### A. GST REPORT (UC-GST01 – UC-GST20)

**Business reasoning:** Meena's one job in this system is producing a
number she can file with, in a shape she can actually use. Real GSTR-1
filing is HSN-wise and B2B/B2C-split; a wrong or unusable report doesn't
just annoy her, it risks a real penalty for a real small business.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| GST01 | Generate report for a date range | 🐛 Broken | Live-confirmed hard crash on every "Generate Report" click — `GSTReport.js:136`, see UC-R05 |
| GST02 | Output tax (sales-side) breakdown by rate | ✅ Built (once render is fixed) | Math correct, `reports.py:290-303` |
| GST03 | Input tax credit (purchase-side) breakdown by rate | ✅ Built (once render is fixed) | `reports.py:322-335` |
| GST04 | Net GST liability (output − input) | ✅ Built (once render is fixed) | `reports.py:373` |
| GST05 | Sales returns reduce output tax | ✅ Built | Formula verified against `create_sales_return`'s own pricing, `reports.py:309-324` |
| GST06 | Purchase returns reduce input tax credit | ✅ Built | Formula verified against `create_purchase_return`'s own pricing, `reports.py:346-361` |
| GST07 | Credit ("due") sales included in output tax | 🐛 Missing | `status == "paid"` only excludes confirmed unpaid sales — see UC-R06 |
| GST08 | HSN-wise breakdown (not just rate-wise) | ❌ Missing | Real GSTR-1 filing is HSN-wise ([ClearTax](https://docs.cleartax.in/product-help-and-support/for-large-businesses/cleargst/generate-reports/sales-and-g1/gstr-1-hsn-summary-report)); `hsn_code` exists on both `BillItem`/`PurchaseItem` but is never read in `get_gst_report` |
| GST09 | B2B vs. B2C bifurcation | ❌ Missing | Real GSTR-1 Table 12 requires this split ([ClearTax](https://cleartax.in/s/gstr-1)); `Customer` has no GSTIN-for-invoicing concept at all — schema gap, not just a report gap |
| GST10 | IGST (interstate sales) | ❌ Not populated, by design | Matches the already-known, deliberately-deferred single-state-only Phase 1 decision |
| GST11 | Composition-scheme pharmacy handling | ❌ Missing | `PharmacySettings.is_composition_scheme` is a real, saveable toggle (`settings.py:254,365`) but is **never read anywhere except Settings itself** — a composition dealer (flat-rate GST, no ITC claim, different return type — GSTR-4 not GSTR-1) gets the exact same CGST/SGST/ITC report as a regular dealer. Not previously flagged in this spec; found while building this section. Real compliance risk for any pharmacy that has this flag on. |
| GST12 | Export to CSV/Excel | ❌ Unreachable | Code exists (`GSTReport.js:36-60`) but the page crashes before the button can appear |
| GST13 | Export in a filing-ready format (GSTR-1 JSON/Excel template) | ❌ Missing | Today's export (once reachable) is a plain dump of internal numbers, not shaped for the GST portal or a CA's working file — Marg ERP/Pharmasoft both name this explicitly |
| GST14 | Permission gate | ❌ Missing | Live-confirmed a cashier gets 200 OK |
| GST15 | Drill down from a rate/HSN bucket to the underlying bills | ❌ Missing | No linkage from a summary row to source transactions anywhere in the UI |
| GST16 | Draft/cancelled transactions excluded | ✅ Built | Sales side already filters non-draft implicitly via status; purchase side filters `status=="confirmed"` and `deleted_at IS NULL` |
| GST17 | Print/PDF view | ❌ Missing | No print button anywhere on this page (unlike Schedule H1) |
| GST18 | Date-range presets matching filing cadence (month/quarter/FY) | ❌ Missing | Raw date inputs, not `DateRangePicker` — see Design-system constraint above |
| GST19 | Rounding/reconciliation display (does the report tie to the bills that generated it) | ❌ Missing | No reconciliation view; a discrepancy would be invisible |
| GST20 | Cess handling | 🔄 Partial | Purchase-side `cess_paise` is a real, captured field (per `docs/23`'s UC-P21) but never appears anywhere in the GST report response at all — silently dropped from the one place it would matter most |

**Recommended flow once Batch 1 (GST01/GST07/GST14) lands:** replace both
raw date-input pairs with `DateRangePicker`; add a "Group by: GST Rate |
HSN Code" toggle over the existing tables (additive, `hsn_code` already
exists — GST08); B2B/B2C split and a filing-ready export are bigger scope
needing their own schema conversation (GST09/GST13) — not proposed for
the current batch. GST11 (composition scheme) needs a product decision
with you first: does PharmaCare support composition-scheme pharmacies at
all today, or should the Settings toggle be removed until it's real?

### B. SALES REPORT (UC-SAL01 – UC-SAL10)

**Business reasoning:** Rajesh checks this for day-to-day visibility
between Dashboard glances; Suresh uses it to spot slow periods.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| SAL01 | List bills for a date range | ✅ Built | `reports.py:43-87` ↔ `ReportTables.jsx:31-38`, live-verified zero-data → real bill |
| SAL02 | CSV/Excel export | ✅ Built | Both formats correct, field names match |
| SAL03 | Payment-method breakdown (cash/UPI/card/credit totals) | ❌ Missing | Row-level payment method shown, no aggregate breakdown |
| SAL04 | Customer-wise sales | ❌ Missing | Exists on Dashboard ("Top Customers") but not as a filterable report |
| SAL05 | Product/category-wise sales | ❌ Missing | Exists on Dashboard ("Top Products") but not as a filterable report here |
| SAL06 | Cashier/user-wise sales | ❌ Missing | No "who sold what" breakdown anywhere |
| SAL07 | Drill down from a row to the bill detail | ❌ Missing | Table rows aren't clickable |
| SAL08 | Print view | ❌ Missing | No print button (unlike Schedule H1) |
| SAL09 | Period-over-period comparison | ❌ Missing | Dashboard has this (vs. yesterday/last week/last month); this report doesn't |
| SAL10 | Draft/refunded bills correctly excluded | ✅ Built | `status IN (paid, due)` per §1 table above |

Lower priority than GST — named here so it isn't lost, not proposed for
the current fix batch.

### C. PURCHASE REPORTS (UC-PU01 – UC-PU06)

Already comprehensively covered in `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`
§7-8 (UC-P33 – UC-P43) — not re-litigated here in full. The Reports-module-
specific angle:

| UC | Use case | Status | Evidence |
|---|---|---|---|
| PU01 | A Purchases tab on the Reports landing page | ❌ Missing | Real tabs are Sales/Low Stock/Expiry/Stock only (`Reports/index.jsx:20-25`) — no Purchases tab exists; `docs/21_FEATURES.md` doesn't document this absence either |
| PU02 | Purchase register / GST purchase report | 🔄 Partial | Lives entirely on the Purchases list page itself, not Reports — see `docs/23` P33/P36 |
| PU03 | Purchase dashboard metrics (value today/month, payable, overdue) | ❌ Missing but built server-side | `GET /analytics/purchases` is fully correct and unused — dead code, see UC-R15 |
| PU04 | Supplier/product purchase analytics | ❌ Missing | See `docs/23` P41/P42 |
| PU05 | Purchase variance report | ❌ Missing | See `docs/23` P38 |
| PU06 | Purchase profitability impact | ❌ Missing | See `docs/23` P43 |

**Recommendation, unchanged from the earlier pass:** wire the existing,
correct `/analytics/purchases` endpoint into a 4th Reports tab before
building anything new (PU01/PU03 together) — cheapest real win in this
whole spec, zero new backend work.

### D. STOCK / INVENTORY REPORT (UC-STK01 – UC-STK08)

**Business reasoning:** Rajesh/Suresh need stock valuation and dead-stock
visibility without leaving Reports; today this is scattered across
`/inventory` and Reports' broken "Stock" tab.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| STK01 | Low stock report | ✅ Built | See UC-R02 |
| STK02 | Expiry report | ✅ Built | See UC-R03 |
| STK03 | Current stock valuation (total value, by category) | ❌ Missing on Reports | Exists on Dashboard as one number (`quick_stats.stock_value`), not a filterable report |
| STK04 | The "Stock" tab itself | 🐛 Fake | Silently reuses Sales data, links to a dead route — see UC-R04 |
| STK05 | Dead/non-moving stock report | ❌ Missing | No endpoint anywhere computes "hasn't sold in N days" |
| STK06 | Batch-wise stock report | ❌ Missing on Reports | Exists per-product on Medicine Detail, not as a Reports-level report |
| STK07 | Stock movement/ledger report | ✅ Built, elsewhere | `StockMovementLog` page (`batches.py`'s `/stock-movements`) — a real, separate page, not under Reports |
| STK08 | Physical stock reconciliation ("Barcode v/s Stock") | ❌ Missing | Named, real Marg ERP feature (see Competitor Benchmark) — no equivalent anywhere |

**Recommendation:** decide STK04 first (fix vs. remove, per the earlier
pass's reasoning: none of the three named competitors have a bare "Stock"
report separate from their Inventory module either). STK03/STK05/STK08
are real, competitor-validated gaps but genuinely new work — sequence
after the fix batches.

### E. MARGIN / PROFITABILITY REPORT (UC-MAR01 – UC-MAR06)

**Business reasoning:** Rajesh's #1 named fear per `docs/01_PRODUCT.md`'s
persona notes is not knowing which products actually make money. Nothing
in Reports answers this today.

**Stronger finding than the first pass had:** this isn't just "the data
exists to compute it" — **`Bill.margin_paise`/`margin_percent` are
already computed and stored on every single bill**, correctly, on both
the create and update paths (`billing.py:520-521,754-756` —
`margin_paise = grand_total_paise - cost_total_paise`). The one frontend
reference to margin (`useBillActions.js:177`) only shows it live during
bill creation, then the stored value is **never read back by anything** —
not Reports, not Dashboard, not any endpoint in `reports.py` (confirmed:
zero occurrences of "margin"/"profit" anywhere in that file). A margin
report here is not new computation logic — it's a `SUM`/`GROUP BY` query
over a column that already sits correctly populated in the database today.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| MAR01 | Item-wise margin report | ❌ Missing | eVitalRx names this explicitly; `BillItem.cost_price_paise` + `mrp_paise` already exist per-line |
| MAR02 | Overall margin trend (period over period) | ❌ Missing | `Bill.margin_paise` already stored per bill — a trivial aggregation |
| MAR03 | Category-wise margin | ❌ Missing | `Product.category` already exists to group by |
| MAR04 | Low-margin/loss-making product alert | ❌ Missing | No threshold/alert concept exists |
| MAR05 | Price-variation report (MRP changes over time across purchases) | ❌ Missing | Named eVitalRx feature; each purchase already snapshots its own MRP per batch, so history technically exists, just never surfaced as a report |
| MAR06 | Export/print | ❌ Missing | N/A — no report exists to export |

**Recommendation:** the clearest "new work, but cheap" candidate in this
whole spec, once GST (Batch 1) lands — the hard part (computing margin
correctly per sale) is already solved and already running in production.

### F. RETURN REPORTS (UC-RET01 – UC-RET08) — previously missing from this spec entirely

**Business reasoning:** Suresh needs to see return volume/value/reasons to
catch a bad supplier batch or a recurring customer complaint pattern; Rajesh
needs total refund exposure. Confirmed live via direct grep: **zero
report or analytics endpoint exists for either return type** —
`GET /sales-returns` and `GET /purchase-returns` are both plain paginated
lists backing their own list pages, not aggregations (`sales_returns.py:389`,
`purchase_returns.py:469`). `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`'s
Section 10 already stated this for purchase returns ("No purchase-return-
specific report endpoint exists at all") — confirmed here it's equally
true for sales returns, which that spec didn't cover.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| RET01 | Sales return report (credit notes issued, by date range) | ❌ Missing | No aggregation endpoint exists |
| RET02 | Purchase return report (debit notes issued, by date range) | ❌ Missing | Same — matches `docs/23` Section 10 |
| RET03 | Return reason breakdown | ❌ Missing | The underlying data barely exists either — `docs/23` PR03 already found the frontend never sends a real reason (`"return"` hardcoded); `sales_returns.py`'s `SalesReturnCreate.note` is closer to a real reason field but still unstructured free text |
| RET04 | Return rate (% of sales value returned) | ❌ Missing | `net_purchases` (purchases minus returns) is the one derivable number that exists today (`analytics/purchases`), and even that endpoint is dead/unwired (UC-R15) |
| RET05 | Product-wise return frequency (defect/quality tracking) | ❌ Missing | No breakdown by product exists |
| RET06 | Refund-method breakdown | ❌ Missing | `SalesReturn.refund_method` is a real, captured field but never aggregated anywhere |
| RET07 | Net sales after returns (as its own report, not just netted into GST) | 🔄 Partial | The GST report correctly nets returns into tax liability (GST05/GST06) but there's no plain "net sales" report a non-accountant would read |
| RET08 | Export/print | ❌ Missing | N/A — no report exists to export |

**Recommendation:** genuinely new work across the board — no existing
endpoint to wire, unlike Purchases (PU03). Lowest-effort starting point
would be RET07 (net sales), since the subtraction logic already exists
correctly inside `get_gst_report` and could be extracted into its own
lightweight summary.

### G. SCHEDULE H1 REGISTER (UC-H101 – UC-H108)

The one clean surface in this module — kept brief since UC-R11-R13 above
already cover it in detail.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| H101 | View/filter register by date range | ✅ Built | UC-R11 |
| H102 | Search by drug/patient/doctor | ✅ Built | `ScheduleH1Register.jsx:41` search box, live-verified present |
| H103 | Auto-population from billing | ✅ Built | `_create_h1_entry` (`billing.py`), confirmed in `docs/07_BUSINESS_LOGIC.md` |
| H104 | Export CSV | ✅ Built | UC-R13 |
| H105 | Print for inspector | ✅ Built | UC-R13 |
| H106 | Permission gate | 🔄 Partial | Gated, but hardcoded role string not the real catalog — UC-R12 |
| H107 | Prescriber registration number captured | ✅ Built | Real field, `reports.py:401`, matches `docs/21_FEATURES.md`'s description |
| H108 | Excel export | ❌ Missing | Not flagged as a gap — CSV/print are the formats this use case actually needs |

No changes proposed beyond H106 (bundle with the other permission-gate fixes in Batch 1).

### H. AUDIT LOG (UC-AL01 – UC-AL07) — previously missing from this spec entirely

**Business reasoning:** Rajesh reviews this when a dispute arises (a
cashier deleted a bill, changed a price). Its entire value is being
trustworthy and complete — a log a pharmacy owner can't actually rely on
(missing entries, or worse, showing someone else's pharmacy's data) is
worse than no log.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| AL01 | List all actions, paginated | ✅ Built | `GET /audit-logs` (`billing.py:1186-1227`), correctly `pharmacy_id`-scoped |
| AL02 | Filter by entity type/id/action | ✅ Built | Same endpoint, real filters |
| AL03 | View one entity's full audit trail | 🐛 Was a live cross-tenant leak, fixed Sep 12, 2026 | `get_entity_audit_trail` had zero `pharmacy_id` filter — proved live, pharmacy B read pharmacy A's real bill audit trail (customer name, totals). Fixed same day; see `docs/15_ROADMAP.md` RULE MISSES LOG. Regression tests added (`TestAuditLogIsolation`, `test_multi_tenancy_isolation.py`). |
| AL04 | ~~`old_values` populated (before/after diff)~~ | ✅ Fixed Sep 12, 2026 | `billing.py`/`purchases.py`/`purchase_returns.py`'s 3 independent `_record_audit` helpers now receive real prior-state values at every meaningful mutation site (payment, refund, purchase update, mark-paid, purchase-return edits) — create actions correctly keep `old_value: null`. Regression tests: `test_audit_log_old_values_and_ip_address.py`, `git stash`-proven to fail pre-fix |
| AL05 | ~~`ip_address` populated~~ | ✅ Fixed Sep 12, 2026 | Same 3 helpers gained a local `_client_ip(request)` helper; both `GET /audit-logs` and `GET /audit-logs/entity/{type}/{id}` responses now also carry an `ip_address` key — previously the column existed but no endpoint returned it, so even a correctly-populated value was unobservable to any real API consumer |
| AL06 | Export/print | ❌ Missing | No export button exists on the Audit Log page for this data at all |
| AL07 | Permission gate (who can view the audit log) | ❌ Missing | No role check anywhere on `GET /audit-logs` — confirmed via code read, not yet live-tested with a cashier account; matches the same "no gate" pattern found on 10 of `reports.py`'s 12 endpoints |

**Recommendation:** AL07 bundles naturally into the same Batch 1
permission-gate work as GST14/H106. AL04/AL05 (`old_values`/`ip_address`)
are a real, cross-module gap already named once in `docs/23` — worth
fixing app-wide in one pass rather than per-module, since the columns and
the one `_record_audit`-family of helpers already exist; just nothing
ever populates them.

### I. DASHBOARD ANALYTICS (UC-DASH01 – UC-DASH06)

Already the one fully clean consumer in this whole audit (UC-R14) —
listed here only for completeness of the numbered scheme.

| UC | Use case | Status | Evidence |
|---|---|---|---|
| DASH01 | Today/week/month/all-time sales with trend | ✅ Built | UC-R14 |
| DASH02 | Sales trend chart (14-day) | ✅ Built | `daily_trend[]`, live-verified rendering |
| DASH03 | Category sales breakdown | ✅ Built | `category_sales[]` |
| DASH04 | Top products/customers | ✅ Built | `top_products[]`/`top_customers[]` — by revenue, not margin (see MAR02) |
| DASH05 | Low-stock/expiring-soon alerts | ✅ Built | `low_stock[]`/`expiring_soon[]` |
| DASH06 | Drug-license expiry banner | ✅ Built | `license_alert` |

No gaps found. Not proposed for any batch.

### J. CROSS-CUTTING PERMISSIONS MATRIX

Consolidating GST14/AL07/H106 and the earlier finding that 10 of
`reports.py`'s 12 endpoints have no gate at all:

| Surface | Gated today? | Real gate needed |
|---|---|---|
| GST Report | ❌ No | `reports:gst` or similar, via `has_permission()` |
| Sales/Low-Stock/Expiry reports | ❌ No | Same catalog |
| Dashboard analytics | ❌ No | Arguably fine ungated (every role needs Dashboard) — a product decision, not assumed here |
| Schedule H1 Register | 🔄 Hardcoded `role in [admin,manager]` | Migrate to `has_permission()` |
| Audit Log (list + entity trail) | ❌ No | A real gap — a cashier can currently read the full action history of every user in the pharmacy |
| Backup export (`/backup/export`) | ✅ `role == "admin"` (hardcoded) | Lower priority — already the most-restricted endpoint in the router |

### K. OPERATIONAL EDGE CASES

| Case | Status | Note |
|---|---|---|
| Multi-store/consolidated reporting | ❌ Not built | Correctly out of scope — explicit Phase 2 per `docs/01_PRODUCT.md` §7.4, not a gap |
| Report scheduling/emailing (e.g. auto-email GST report monthly) | ❌ Not built | Not named as a current competitor feature in this round of research; worth a future search if a persona asks for it |
| Cross-tenant data leak on export | ✅ Fixed | Covered by this session's broader multi-tenancy fix pass — every report endpoint scopes by the caller's own `pharmacy_id` |
| Report access itself creates an audit trail | ❌ Not built | Pulling the GST report isn't logged anywhere — for a compliance-sensitive report, arguably should be, once AL07's permission gate exists |
| Loading skeleton per Manifesto #16 | 🔄 Partial | Present on the Reports landing page's table fetch; not separately re-verified for `GSTReport.js`/`ScheduleH1Register.jsx` in this pass — check before shipping the GST rebuild |

---

## DEFINITION OF DONE — REVISED VERDICT

Reports & Compliance is further from done than the first pass's verdict
suggested, once Return Reports and Audit Log are counted as part of the
module (they weren't in the first pass). Of what a pharmacist/accountant
would actually expect from a "Reports & Compliance" section:

- **Working today**: Sales/Low-Stock/Expiry reports, Schedule H1 Register,
  Dashboard analytics, Audit Log's list/filter view (now correctly scoped).
- **Broken today**: GST Report (crash + liability bug + no gate), the
  fake Stock tab, 3 of 4 Excel exports, Audit Log's entity-trail view (now
  fixed).
- **Never built at all**: HSN-wise/B2B GST detail, composition-scheme
  handling, margin/profitability reporting (despite the data already
  existing), return reports of any kind, a Purchases tab on this page,
  `old_values`/`ip_address` audit population, permission gates on 10+
  endpoints.

---

## REVISED RECOMMENDED BUILD ORDER

Batches 1-4 above are unchanged and still come first — they're bug fixes,
not new scope. This section adds what the fuller use-case pass surfaced:

**Batch 5 — Audit Log correctness (small, same class as Batch 1)**
11. ~~Fix `get_entity_audit_trail`'s missing `pharmacy_id` filter~~ — ✅ done, Sep 12, 2026 (this pass).
12. ~~Add a real permission gate to `GET /audit-logs`/`GET /audit-logs/entity/...`~~ — ✅ done, Sep 12, 2026, same `reports:view` permission and same regression-test file as Batch 1.
13. ~~Populate `old_values`/`ip_address` app-wide (AL04/AL05)~~ — ✅ Done Sep 12, 2026.

**Batch 6 — cheapest real feature wins (data already exists)**
14. Margin report (MAR01/MAR02) — `Bill.margin_paise` already computed and stored; this is a query, not new logic. Reclassified during a follow-up discussion: per the product's own Reports-vs-Analytics split (Reports = filterable + downloadable, Analytics = visual metrics), the *downloadable margin report* stays a Reports tab; a *visual margin trend* would separately belong on Dashboard, not built here.
15. ~~Wire `/analytics/purchases` as a 4th Reports tab (PU01/PU03)~~ — **re-scoped**: `/analytics/purchases` returns aggregate metrics (totals, counts), which is Analytics-shaped per the same split, not a Reports-page tab. It belongs on Dashboard as a visual card instead. A real "Purchase Register" (row-level, filterable, downloadable — matching Sales Report's shape) would be the actual Reports-page equivalent, and is separate, new work, not just wiring the existing endpoint.

**Batch 7 — return reports (genuinely new, no existing endpoint to lean on)**
16. Net-sales-after-returns as a starting point (RET07) — the subtraction logic already exists inside `get_gst_report`, extractable into its own summary.
17. Sales/purchase return reports proper (RET01/RET02), then reason/product breakdowns (RET03/RET05) once real reason capture exists (a prerequisite already named in `docs/23` PR03).

**Batch 8 — bigger scope, needs its own conversation before any code**
18. GST composition-scheme decision (GST11) — is this a real supported pharmacy type or should the toggle be removed?
19. HSN-wise/B2B GST detail (GST08/GST09) — B2B needs a GSTIN-capture flow on Customer that doesn't exist.
20. Physical stock reconciliation ("Barcode v/s Stock", STK08), dead-stock report (STK05), price-variation report (MAR05).

Everything in this document was verified via direct code reads, a live
zero-data browser walkthrough, real API calls, and — for the Audit Log
finding — a live two-tenant exploit reproduction, not inferred from a
variable name or docstring.
