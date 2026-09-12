# PharmaCare — Reports & Compliance Acceptance Spec
# Version: 1.1 | Last updated: September 12, 2026
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

### 🐛 Live bugs (shipped, currently wrong — not just missing)

1. **The GST Report page hard-crashes, 100% of the time, with zero or real data.**
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
2. **The GST report silently excludes every credit sale from output tax.**
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
3. **The Reports page's "Stock" tab has no real backend behind it.**
   `useReports.js`'s report-type config map has no `'inventory'` key
   (`hooks/useReports.js:23-29`), so selecting the "Stock" tab silently
   falls back to the **Sales** report's data — confirmed live: the tab
   showed "Total Sales: ₹105.00 / Total Bills: 1" (leftover sales-report
   numbers) instead of any stock figure, plus a stub message and a
   **dead link to `/inventory-v2`**, a route that doesn't exist anywhere
   in `App.js` (only `/inventory` does — confirmed live: clicking it
   silently redirects to `/dashboard`). If a pharmacist exports from this
   tab, the file is titled "Inventory_Report" but is either today's raw
   sales rows (CSV) or entirely blank columns (Excel) — see bug #5.
4. **Excel export is broken for 3 of 4 exportable reports** (Low Stock,
   Expiry, "Inventory") — `frontend/src/utils/excelExport.js`'s formatter
   functions read field names (`item.name`, `.status`, `.category`,
   `.stock`, `.days_left`, `.value`, `.total_stock`, `.stock_value`,
   `.brand`) that don't exist on the real report payloads (real fields are
   `product_name`, `current_stock`, `qty`, `days_to_expiry`,
   `stock_value`, etc.) — every mismatched column exports **blank**. Only
   Sales' Excel export and all three reports' CSV exports (which build
   columns generically from whatever keys are present, not hardcoded
   names) are unaffected.
5. **No permission gate on 10 of this router's 12 endpoints** — a cashier
   can pull the GST report, the Sales/Low-Stock/Expiry reports, and the
   full Dashboard analytics. Only Schedule H1 Register and the admin data
   backup export are gated. This directly extends
   `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`'s finding #15 ("no permission
   gate — a cashier can export the GST report") — confirmed true of
   `reports.py`'s own endpoints directly, live-tested with a real cashier
   account (200 OK on `/reports/gst`, `/reports/sales-summary`,
   `/analytics/dashboard`; correctly 403 on
   `/compliance/schedule-h1-register`).
6. Schedule H1 Register's permission gate exists but is a hardcoded
   `role not in ["admin","manager"]` string check (`reports.py:386-389`),
   not the real `has_permission()`/`ALL_PERMISSIONS` catalog used
   elsewhere in the app (Suppliers/Products, fixed Sep 12, 2026) — the
   same "hardcoded role string instead of the real permission system"
   pattern already found and fixed once before in this codebase.

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

**Batch 1 — GST report, stop the active bleeding (this is the module's core promise)**
1. Fix `GSTReport.js`'s field names to match the real response (`sales`/`purchases`/`sales_summary`/`purchases_summary`/`net_liability`) — the render-crash fix.
2. Fix the sales-side status filter to `status IN ("paid","due")`, matching every sibling endpoint — do this in the *same* change as #1, not after, so the "fixed" report doesn't ship still wrong.
3. Add a permission gate to `GET /reports/gst` (and the rest of `reports.py`'s currently-ungated 10 endpoints) using the real `has_permission()` catalog.

**Batch 2 — the fake "Stock" tab**
4. Decide with Abinash: wire it to a real inventory-summary endpoint, or remove the tab (real inventory reporting already exists at `/inventory`) — currently actively misleading, not just missing.

**Batch 3 — export correctness**
5. Fix `excelExport.js`'s `formatLowStockReport`/`formatExpiryReport` field names.
6. Add a real Excel/portable export to the GST report once #1-3 land.

**Batch 4 — real gaps, prioritize with Abinash**
7. HSN-wise GST grouping (competitor-validated, schema already supports it).
8. Wire or delete the 4 dead backend endpoints (`/reports/sales`, `/reports/dashboard`, `/analytics/summary`, `/analytics/daily`).
9. Fix `docs/21_FEATURES.md`'s stale "HSN-wise" claim to match real behavior.
10. Item-wise margin report, price-variation report, Tally export, HSN/date index on `SalesReturn`/`PurchaseReturn` — genuinely new work, sequence by what a real pharmacist/accountant would ask for first.

Everything in the recommended batches was verified via direct code reads,
a live zero-data browser walkthrough, and a real API call — not inferred
from a variable name or docstring.

---

## PRE-BUILD RESEARCH — FEATURES, FLOW, VISUAL DESIGN, USE CASES

> Added Sep 12, 2026, before any Batch 1-4 work starts, per direct request
> ("before building let's research on what all features should be there
> how the flow should be, visual design and use cases to cover"). This
> section decides *what Reports should become*; the batches above are
> *what's currently broken*. Bug fixes (Batch 1) proceed regardless of
> this section's answer — a crash is a crash. Anything that reshapes a
> screen or adds a new report type waits for a plain-language go-ahead
> per report, not a blanket "build all of this."

### Why this section exists, not just a feature list

Per Manifesto #15 and the "product manager first" rule: a feature list
built only from competitor names is a checklist, not reasoning. For each
report below, the question answered first is *what does the pharmacist
literally lose if this doesn't exist*, then what competitors named prove
it's a real, standard expectation — not a nice-to-have invented for
completeness.

### Design-system constraint (checked first, per the design HARD STOP)

No dedicated Reports/GST preview exists in `PharmaCare Design System/
preview/` (only generic `data-table.html` and `design-dashboard-zero.html`)
— so nothing below invents new visual language. Every proposal reuses
components that already exist and are already documented in
`docs/06_COMPONENTS.md`:

- **`DateRangePicker`** (`components/shared/DateRangePicker.jsx`) — Today/
  This Month/Last Month/Financial Year presets, defaults to the current
  Indian FY. **`ScheduleH1Register.jsx` already uses this correctly**
  (confirmed live: "01 Apr 2026 — 31 Mar 2027" button). **Both the Reports
  landing page and `GSTReport.js` use raw native `<input type="date">`
  pairs instead** — a real "one component, one way" violation (Manifesto
  #1) independent of the field-mapping bugs already found, and worse UX
  for the exact accountant use case this module exists for: Meena files
  monthly/quarterly, so "This Month"/"Last Month" presets save her from
  hand-picking two dates every single time. **Recommendation: replace
  both raw date-input pairs with `DateRangePicker` as part of the GST
  fix batch — same component Schedule H1 already proves works here.**
- **`DataCard`** — already used correctly for GST's 3-tile summary
  (Output Tax / Input Tax Credit / Net Payable) and should also back any
  new summary tiles (e.g. a margin report's Gross Margin/Margin % tiles).
- **`FilterPills`** — not currently used anywhere in Reports; worth
  considering for a future HSN-code or product-category filter on the GST
  report, not for this batch.
- **`TableSkeleton`** — Manifesto #16 requires this on every loading
  state; confirmed present already on the Reports landing page's table
  fetch (not separately audited for GSTReport.js/H1 in this pass — check
  before shipping the GST rebuild).

### 1. GST Report — the module's core promise, researched in most depth

**Business reasoning:** Meena visits specifically to file GSTR-1/GSTR-3B.
Her job needs two things the current report can't give her even once
Batch 1 lands: a number she can trust, and a shape she can actually use
for filing (real GSTR-1 filing is done **HSN-wise**, per
[ClearTax](https://docs.cleartax.in/product-help-and-support/for-large-businesses/cleargst/generate-reports/sales-and-g1/gstr-1-hsn-summary-report)/
[Tally](https://help.tallysolutions.com/export-gstr-1-in-ms-excel-csv-formats-update-rate-wise-hsn-sac-summary/),
not just rate-wise). Without HSN-wise output, Meena has to manually
re-derive the HSN breakdown from raw bills before she can file — the
report doesn't actually save her the work it exists to save.

**Competitor-validated use cases** (Marg ERP/eVitalRx/Pharmasoft, researched
Sep 12, 2026 — see Competitor Benchmark above and `docs/01_PRODUCT.md` §10):
- HSN-wise summary, not just rate-wise (Marg ERP's headline GST feature).
- **B2B vs. B2C bifurcation** — real GSTR-1 Table 12 requires this split
  today ([ClearTax](https://cleartax.in/s/gstr-1)); PharmaCare has no
  concept of a B2B sale at all yet (no GSTIN captured on `Customer` for
  invoicing purposes) — a genuine schema gap, not just a report gap.
- Export in a **filing-ready format** (Marg ERP: "GST-portal-ready";
  Pharmasoft: "CA/filing-ready"; Tally: real GSTR-1 JSON upload) — today's
  CSV/Excel export is a plain dump of internal numbers, not shaped for
  the actual GST portal or a CA's working file.
- Item-wise margin report, price-variation report (eVitalRx) — related to
  GST tangentially (same Reports section) but not GST-report scope
  itself; listed separately below.

**Proposed flow** (fix-then-extend, not a rewrite):
1. Replace both raw date inputs with `DateRangePicker` (Today/This Month/
   Last Month/FY presets) — cheap, matches Schedule H1's proven pattern.
2. Fix the field-mapping crash and the `status IN ("paid","due")` filter
   (Batch 1 — already scoped, proceeds regardless of this section).
3. Add a permission gate (Batch 1).
4. *Then*, as a separate, explicitly-approved follow-on: add an HSN
   column/grouping toggle ("by rate" / "by HSN") over the existing
   rate-bucket data — `hsn_code` already exists on both `BillItem` and
   `PurchaseItem`, so this is additive, not a schema change.
5. B2B/B2C bifurcation and a real GSTR-1-shaped export are bigger
   scope (B2B needs a GSTIN-capture flow on Customer that doesn't exist
   today) — flagged as a real gap, explicitly **not** proposed for this
   batch; needs its own go/no-go conversation given the schema work involved.

**Visual design:** Keep the existing 2-table + 3-tile layout (Sales GST /
Purchase GST tables + Output/ITC/Net Payable summary cards) — it already
matches `DataCard`/table conventions correctly once the field names are
fixed. Add a "Group by: GST Rate | HSN Code" toggle above the Sales GST
table for step 4 above, using the same segmented-control pattern
`PageTabs` already establishes elsewhere, not a new control type.

### 2. Sales Report — mostly solid, one real use-case gap

**Business reasoning:** Rajesh checks this for day-to-day sales visibility
between Dashboard glances; Suresh uses it to spot slow periods.

**Use cases already covered, confirmed live:** date-range sales list with
bill#/date/customer/items/payment/amount, correct CSV/Excel export.

**Gap vs. competitors:** no payment-method breakdown (cash vs. UPI vs.
credit totals), no customer-type segmentation. Lower priority than GST —
not proposed for the current batch, named here so it isn't lost.

### 3. Purchase Report — structural gap, already named in the Purchases spec

**Business reasoning:** Suresh needs to see purchase volume/spend by
supplier/date without leaving Reports. Today this only exists on the
Purchases list page itself (`docs/23_PURCHASES_ACCEPTANCE_SPEC.md` P33-P43) —
**there is no Purchases tab on the Reports landing page at all**, a real
structural absence `docs/21_FEATURES.md` doesn't document either.

**Recommendation:** don't build a new, separate Purchases report here —
`docs/23`'s Batch 5 already prioritizes wiring the frontend to the
existing, already-correct `GET /analytics/purchases` endpoint (currently
dead code, per this spec's UC-R15). Cheapest real win: surface that
endpoint's data as a 4th tab on the Reports landing page instead of
building anything new. Flagged here for sequencing awareness, not
re-scoped into this batch — belongs to the Purchases spec's own batch order.

### 4. "Stock"/Inventory Report — decide: fix or remove

Already covered in UC-R04 above. Two honest options, not a recommendation
to pick one without you: **(a)** wire it to a real inventory-summary
endpoint (current stock value, category breakdown, dead-stock list — none
of which exist as an endpoint today, real new work), or **(b)** remove
the tab entirely, since real inventory reporting already lives at
`/inventory` and this tab currently actively misleads (wrong numbers, dead
link). Given Batch 2 already flags this as a decision point, this section
adds the competitor angle: none of eVitalRx/Marg/Pharmasoft's "reports"
lists include a bare "Stock" report separate from their Inventory module
either — their inventory reporting lives inside Inventory, same as
PharmaCare's `/inventory` page already does. **This weakly favors (b),
remove it** — but it's your call, not assumed.

### 5. Margin/Profitability Report — real, named competitor gap, not built at all

**Business reasoning:** Rajesh's #1 stated fear-driver per
`docs/01_PRODUCT.md` persona notes is not knowing which products actually
make money. Nothing in PharmaCare answers this today at the report level
(Dashboard shows top-selling by revenue, not margin).

**Competitor-validated:** eVitalRx names this explicitly ("Item-wise
Margin Reports"). Real gap, zero existing endpoint or UI.

**Not scoped into the current fix batch** — flagged as the clearest
"genuinely new work" candidate for after Batch 1-3 land, since
`cost_price_paise`/`mrp_paise`/`sale_price_paise` already exist per-batch
and per-bill-item, so the data to compute this already exists; it's a new
aggregation endpoint + a new report tab, not a schema change.

### 6. Schedule H1 Register — no changes proposed

Already the one clean surface in this module (UC-R11-R13). Only open item
is UC-R12 (hardcoded role check vs. the real permission catalog) —
consistent with Batch 1's permission-gate work, worth doing in the same
pass since it's the same class of fix.

### What this section is NOT proposing

No new pages, no new navigation structure, no new component types. Every
proposal above either fixes a bug already in Batch 1-3, swaps a
wrong-component-choice for an existing correct one (`DateRangePicker`), or
is explicitly named as bigger, separately-approved future work (HSN
grouping, B2B/B2C, margin report, Purchase report tab). Nothing here
should be read as "go build all of this" — each bigger item needs its own
plain-language go-ahead per the Research→Build→Test→Review→Feedback→Loop
rule, not a blanket approval from this document existing.
