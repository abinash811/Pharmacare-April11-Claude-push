# PharmaCare — Roadmap
# Version: 1.8 | Last updated: August 22, 2026
# Audience: Claude, all developers
# Rule: Before building anything, check here first. If it's planned, follow the agreed design.
#        If it's Phase 2+, do NOT build it now — no premature architecture.

---

## STATUS LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ | Built and working |
| 🔄 | In progress — partially built |
| 📋 | Planned — design agreed, not yet built |
| 💡 | Idea — under consideration, not confirmed |
| 🚫 | Out of scope for Phase 1 |

---

## PHASE 1 — SINGLE STORE (Current)

### Core Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| JWT authentication | ✅ | Login, register, token refresh |
| Multi-tenancy (pharmacy_id isolation) | 🔄 | Enforced on the paths that have been audited; a real signup-flow bug (fixed) proved the pattern "forgot to scope by pharmacy_id" exists — full query audit not yet done. See `13_DEPLOYMENT.md` PRE-LAUNCH BLOCKERS #2. |
| Soft deletes | ✅ | `is_deleted` + `deleted_at` on all tables |
| Audit logging | ✅ | All state changes logged |
| PostgreSQL + SQLAlchemy async | ✅ | Migrated from MongoDB |
| Alembic migrations | ✅ | Schema version controlled |
| Design system (tokens, shared components) | ✅ | AppButton, PageHeader, PageTabs, FilterPills, etc. |
| 300-line file rule enforced | ✅ | All oversized pages split into folder/index.jsx + components/ |
| Zero raw `<button>` tags | 🔄 | Not actually true — `scripts/design-guard.sh` Rule 1 currently finds 38 violations across the app. Rule enforced on new/changed code via pre-commit; existing violations are unfixed tech debt. |
| Zero Shadcn `<Button>` in pages | 🔄 | Not actually true — Rule 5 currently finds 2 (`ScheduleHWarning.jsx`, `FinaliseModal.jsx`). Same as above — enforced going forward, not yet cleaned up. |
| Consistent page layout | ✅ | All list pages use `px-8 py-6 min-h-screen bg-page` + PageHeader |
| Consistent filter pills | ✅ | All pages use shared FilterPills component |
| Subtitles removed from all PageHeaders | ✅ | April 19, 2026 |

### Billing (Sales)

| Feature | Status | Notes |
|---------|--------|-------|
| Create draft bill | ✅ | DRAFT- prefix, no stock deducted |
| Settle bill (paid / due / partial) | ✅ | Sequential INV- number, stock deducted |
| Bill number — atomic sequential | ✅ | DB sequence, no gaps, no duplicates |
| Snapshot billing | ✅ | Name, MRP, GST stored at time of sale |
| GST calculation (integer paise) | ✅ | CGST + SGST, 0/5/12/18% |
| Schedule H1 validation | ✅ | HTTP 400 without doctor name |
| Schedule H1 register auto-create | ✅ | On every H1 settlement |
| Sales return (RTN- prefix) | ✅ | Stock restored, GST reversed |
| Credit / due bills | ✅ | balance_paise tracking |
| Record payment on due bill | ✅ | `POST /api/payments` |
| Bill PDF download | 🔄 | Endpoint exists, PDF template WIP |
| Bill print (browser) | ✅ | Thermal (80mm/58mm) + A4/A5, default set in Settings → Receipt & Print — was listed 📋 here, already built; moved here from the stale CLAUDE.md status list |
| Discount at bill level | ✅ | Bill-level discount_paise |
| Discount at line item level | ✅ | Per-item disc_percent |
| Patient search — add-new inline | ✅ | PatientCombobox: typeahead, /customers endpoint, walk-in + add-new mini-form |
| Doctor search — add-new inline | 🔄 | DoctorDropdown has typeahead + DB suggestions; needs the same "type a name with no match → Add [name]" inline flow PatientCombobox already has |
| Batch selection UX in medicine row | 📋 | Not discoverable today — needs a visual cue (chip with chevron) |
| WhatsApp — add custom number | 🔄 | Button exists; "Add custom number" flow incomplete |
| Split payment (cash + UPI on one bill) | 📋 | |
| Day-end closing / Z-report | 📋 | |

**Billing — competitor-validated gaps** — per Manifesto rule 15, checked against Marg ERP and eVitalRx (see `docs/01_PRODUCT.md` §10). Verified against real code (`BillingOperations.js`, `backend/routers/billing.py`), not guessed.

| User story | Status | Detail |
|---|---|---|
| As a pharmacist, I want to generate an e-invoice (IRN via the GST e-invoice portal) for B2B bills above the mandatory turnover threshold. | ❌ **Not built** | Grepped the whole backend for `irn`/`e-invoice`/`einvoice` — zero hits outside unrelated matches in `seed_admin.py`/`migrations/env.py`. Marg ERP ships this as a core, not optional, feature. Real compliance exposure once a pharmacy crosses the e-invoicing turnover threshold, not just a nice-to-have. |
| As a pharmacist, I want to generate an e-way bill for a high-value shipment. | ❌ **Not built** | Same grep, same result — no e-way bill generation anywhere in the codebase. |
| As a pharmacist, I want to WhatsApp a bill to my customer. | 🔄 **Exists, but minimal** | `BillingOperations.js::handleWhatsApp` opens a `wa.me` link with the bill total as plain text — works, but only for a customer who already has `customer_mobile` on file; no custom-number entry (already tracked above), no PDF/receipt image attached (text summary only), no payment-reminder or "bill is due" follow-up message — Marg ERP's WhatsApp billing sends the actual invoice and can auto-remind on dues. |
| As a pharmacist, I want to accept a payment gateway (UPI QR / card) at the counter, reconciled automatically against the bill. | ❌ **Not built** | Grepped for `razorpay`/`cashfree`/`paytm`/`payment_gateway` — zero hits. Payment method today is a manual label (`cash`/`upi`/`due`), not a real integration; nothing confirms a UPI payment actually landed. |
| As a pharmacist, I want my billing data to sync to Tally for my accountant. | ❌ **Not built** | No `tally` reference anywhere in the backend. Standard Marg/eVitalRx integration; PharmaCare has no export in a Tally-importable format at all (not even a generic ledger CSV). |

### Inventory

> Rewritten August 22, 2026 as a complete, code-verified use-case checklist —
> every row checked against the real router/model code, not memory. Each
> feature is broken into its actual sub-use-cases (not one summary line),
> written as a user story, with the real fields/rules it involves and any
> limitation found. Work this list top to bottom, one row at a time.
>
> **Correction to this doc's own previous pass:** it had claimed "Bulk import
> via Excel/CSV — ❌ Not built." That was wrong — a full, working feature
> exists (`backend/utils/excel.py`, 6 endpoints; `ExcelBulkUploadWizard/`, a
> 4-step frontend wizard; `test_excel_bulk_upload.py`). The first pass
> grepped only two frontend page folders and missed `backend/utils/` and
> `frontend/src/components/` entirely. Fixed below. Flagging this here
> because it's the exact kind of miss Manifesto rule 14 exists to catch —
> including when it's this document's own.

**A. Product Catalog** — `backend/routers/inventory.py`, `models/products.py::Product`

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want to add a new medicine to the catalog. | ✅ `POST /products` | Required: `name`. Optional: `sku` (auto-generated `SKU-XXXXXXXX` if left blank), `manufacturer`, `brand`, `generic_name`, `dosage_form`, `pack_size`, `units_per_pack` (default 1), `category`, `barcode`, `gst_percent` (default 5%, must be one of the valid GST slabs), `schedule` (OTC/H/H1/X, default OTC), `low_stock_threshold_units` (→ `reorder_level`, default 10). HSN code is auto-derived from category, not typed. SKU must be unique per pharmacy. | Three real DB columns have **no field to set them anywhere** — `strength` (e.g. "500mg"), `requires_refrigeration` (cold-chain flag), and `reorder_quantity` is settable but nothing downstream reads it. Photo/image field doesn't exist. No default-supplier link at the product level. |
| As a pharmacist, I want to edit an existing medicine's details. | ✅ `PUT /products/{id}` | Same field set as create, all optional/partial. Changing `category` silently re-derives `hsn_code`. | **Admin-only** — a manager or cashier cannot fix a typo in a medicine name themselves; every correction needs an admin. Same missing-fields limitation as above (`strength`, `requires_refrigeration`). |
| As a pharmacist, I want to remove a medicine that's no longer stocked. | ✅ `DELETE /products/{id}` (soft delete, sets `deleted_at`) | Admin-only. Blocked with a 400 if any batch still has `quantity_on_hand > 0` — "Write off batches first." | No reason/note is captured for the deletion itself (unlike stock adjustments, which require a reason) — there's no audit trail answering "why was this removed." |
| As a pharmacist, I want to search for a medicine by name, SKU, brand, or manufacturer. | ✅ `GET /products?search=` | Matches any of the four fields (`ilike`, partial match). | Doesn't search `generic_name`/composition in the same box — a pharmacist searching by salt name gets no results unless it happens to also be in the brand/name field. |
| As a cashier, I want to scan a barcode and instantly find the medicine and its stock. | ✅ `GET /products/barcode/{barcode}` | Falls back to matching on `sku` too if barcode isn't found. Returns available batches + suggested (FEFO) batch. | — |
| As a pharmacist, I want to view one medicine's full detail — batches, stock ledger, sales/purchase history. | ✅ `pages/MedicineDetail` (tabs: Batches, Ledger, Transactions) | — | — |
| As a pharmacist, I want to change the GST rate, category, schedule, discount, or location on many medicines at once instead of one by one. | ✅ `POST /products/bulk-update` | Allowed fields: `gst_percent`, `category`, `schedule`, `discount_percent`, `location`, and `brand`. Admin/manager only. | `brand` is allowed by the backend but **not offered** in `BulkUpdateModal.jsx`'s field dropdown — a real but minor UI gap. No bulk delete. No validation warning if a bulk change conflicts with existing stock (e.g. bulk-changing schedule to H1 on products already mid-sale). |
| As a pharmacist onboarding a new pharmacy, I want to upload my whole existing medicine catalog from an Excel/CSV file instead of typing each one in. | ✅ `POST /inventory/bulk-upload/parse` → `/validate` → `/import`, plus `GET /template` and `/progress/{job_id}` | 4-step wizard: upload file → map columns (auto-detects SKU/name/price/quantity/expiry/batch/brand/category columns by keyword) → preview & validate → import with a progress bar. Downloadable template. Error report available per failed row. | Job state is stored **in-memory** (`bulk_upload_jobs: Dict`) — a backend restart mid-import loses job/progress state. Not yet confirmed whether a partially-failed import is fully atomic or can leave a mix of imported/skipped rows without a clear "what actually landed" summary — worth a dedicated test before relying on it for a large real catalog. |
| As a pharmacist, I want to print a barcode label for a medicine that doesn't have one yet. | ❌ **Not built** | — | No label-printing code anywhere in the repo. |
| As a cashier, I want to sell 5 loose tablets from a 10-tablet strip, not the whole strip. | ✅ | `units_per_pack` conversion, used consistently in `billing.py` and `batches.py`. | — |
| As a pharmacist, I want to record exactly which rack/shelf/bin a medicine sits on so staff can find it fast. | ❌ **Not built as a real feature** | Only a single free-text `storage_location` string exists (used by bulk-update as "location"). A separate `location_id` param appears on 3 endpoints but is always `"default"` — vestigial, not wired to anything. | No structured rack/shelf/aisle/bin fields. No support for one product's stock being split across multiple physical spots. Either build this properly or remove the misleading `location_id` param. |
| As a pharmacist, I want the system to suggest how much to reorder when a medicine runs low. | 🔄 **Half-built** | `reorder_quantity` column exists and is stored per product. | Nothing reads it — no "suggested purchase quantity" appears anywhere (not in Purchases, not in the low-stock alert). The field is write-only today. |
| As a pharmacist, I want to flag a medicine as needing refrigerated storage. | ❌ **Not built** | `requires_refrigeration` column exists on the `Product` table. | Not exposed in `ProductCreate`/`ProductUpdate` at all — dead column, unreachable from the API or UI. |
| As a pharmacist, I want to record a medicine's strength (e.g. 500mg) separately from its name. | ❌ **Not built** | `strength` column exists on the `Product` table. | Same as above — not in `ProductCreate`/`ProductUpdate`, dead column. |

**B. Batch & Stock Tracking** — `backend/routers/batches.py`, `models/products.py::StockBatch`

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want to manually add a stock batch (not via a purchase) — e.g. opening stock when first setting up. | ✅ `POST /stock/batches` | `product_sku`, `batch_no`, `expiry_date`, `qty_on_hand`, `cost_price_per_unit`, `mrp_per_unit`, plus optional `manufacture_date`, `supplier_name`, `supplier_invoice_no`, `received_date`, `location`, `free_qty_units`, `notes`. Rejects a duplicate batch number for the same product. Rejects an expiry date already in the past. Auto-records an `opening_stock` movement. | `supplier_name`/`supplier_invoice_no` here are **free-text strings**, not linked to the real `Supplier` table — inconsistent with the Purchases flow, which links a real `supplier_id`. Same real-world concept, two different representations depending on entry path. |
| As a pharmacist, I want to edit a batch's details (cost, MRP, expiry, quantity). | ✅ `PUT /stock/batches/{id}`, admin-only | Any field from create, partial update. Expiry can't be moved into the past. | Directly editing `qty_on_hand` here **bypasses the stock-movement audit trail** — no `StockMovement` row is created, no reason is required, unlike the dedicated `/adjust` endpoint. Two paths change the same number; only one is audited. |
| As a pharmacist, I want to remove a batch that's fully used up or was entered by mistake. | ✅ `DELETE /stock/batches/{id}`, admin-only (soft: `is_active=False`) | Blocked if `quantity_on_hand > 0`. | — |
| As a cashier, when billing, I want the system to automatically pick the batch that expires soonest. | ✅ FEFO, ordered by `expiry_date` | Only batches with `is_active=True` and `quantity_on_hand > 0` are offered. | — |
| As a pharmacist, I want to see every batch of a medicine, current and historical. | ✅ `MedicineDetail → BatchesTab` | — | — |

**C. Stock Movements & Adjustments**

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want every stock change traced — what happened, when, by whom, why. | ✅ `StockMovement` model, `_record_movement()` | Records `movement_type`, `quantity`, `quantity_before/after`, `reference_type/id`, `user_id`, `notes`, timestamp. Covers opening/sale/purchase/adjustment/writeoff/return. | The batch-edit gap in section B means not every stock change actually goes through this — direct `PUT /stock/batches/{id}` quantity edits skip it. |
| As a pharmacist, I want to see the full movement history for a medicine or batch. | ✅ `GET /stock-movements`, `MedicineDetail → LedgerTab` | Filterable by product SKU, batch, movement type. Paginated. | — |
| As a pharmacist, I want to manually correct stock (damage, loss, found extra) with a reason on record. | ✅ `POST /batches/{id}/adjust` | `adjustment_type` (add/remove), `qty_units`, `reason` (required), optional `reference_number`/`notes`. Blocks a result below 0. | — |
| As a pharmacist, I want to write off a batch that's expired and unsellable. | ✅ `POST /batches/{id}/writeoff-expiry` | Only allowed if `expiry_date < today`. Zeroes the batch, deactivates it, records the write-off amount. | — |
| As a pharmacist, I want to periodically count physical stock and reconcile it against what the system shows, recording the variance. | ❌ **Not built** | — | No stock-take / cycle-count feature exists anywhere. This is normally how shrinkage, theft, and counting errors get caught in a compliance-driven business — currently the only way to correct a mismatch is the generic `/adjust` endpoint, one batch at a time, with no "count session" concept. |

**D. Inventory Health / Alerts** — `GET /inventory`, `GET /inventory/filters`

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want one screen showing which medicines are out of stock, expired, near expiry, low stock, or healthy. | ✅ `GET /inventory` | Severity-ranked (1=critical → 3=healthy), sorted by severity then nearest expiry then name. Paginated, with summary counts. | — |
| As a pharmacist, I want to filter that list by category, brand, or status. | ✅ `GET /inventory/filters` | Returns the real distinct categories/brands present, plus the 5 fixed status values. | — |
| As a pharmacist, I want to set how many days before expiry counts as "near expiry." | ✅ `PharmacySettings.near_expiry_threshold_days` | Read consistently by both `/inventory` and `/analytics/dashboard` — verified the same value both places. | — |
| As a pharmacist, I want to set the quantity that counts as "low stock." | ❌ **Real gap — three disagreeing definitions** | See detail below. | Not one bug — three separate implementations disagree right now. |

**Low-stock gap, in detail (verified, not yet fixed):**
1. `GET /inventory` (Inventory list) uses each **product's own** `reorder_level`.
2. `GET /analytics/dashboard` (Dashboard alerts) uses the **pharmacy-wide** `PharmacySettings.low_stock_threshold_days` setting, checked **per batch**, not per product's summed stock.
3. `GET /reports/dashboard` (Dashboard stat cards) **hardcodes `10`**, ignoring both of the above.

A product with `reorder_level = 50` can show "low stock" on the Inventory page while the Dashboard stat card — same product, same moment — uses a hardcoded 10 and shows nothing wrong. Needs one decision (which definition is *the* definition) before any fix.

**E. Settings → Inventory tab enforcement** — `frontend/src/pages/Settings/components/InventoryTab.jsx`, `backend/routers/settings.py`

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want to stop expired stock from ever being sold. | ❌ **Not enforced, not even persisted** | Toggle exists in `InventoryTab.jsx`. `GET /settings` returns it **hardcoded to `True`** (`settings.py:207`) — no DB column backs it. | Flipping this toggle does nothing either way. `billing.py` never checks a batch's `expiry_date` before allowing a sale, regardless of the toggle. |
| As a pharmacist, I want to allow selling near-expiry stock but with a warning shown at billing. | ❌ **Not enforced, not even persisted** | Same as above — hardcoded `True` (`settings.py:208`). | No warning exists anywhere in the billing flow. |
| As a pharmacist, I want to turn dashboard low-stock alerts on/off. | 🔄 | `alert_low_stock_enabled` column, persisted and read by `/analytics/dashboard`, returned alongside the alert data. | Server does the storage/read correctly; whether `AlertsPanel` on the frontend actually checks this flag before rendering hasn't been confirmed — verify before calling this fully done. |
| As a pharmacist, I want to set the near-expiry alert window in days. | ✅ | `near_expiry_threshold_days` column, persisted and read correctly. | — |

**F. Competitor-validated gaps** — per Manifesto rule 15. These are use cases PharmaCare doesn't have, checked against what eVitalRx, Marg ERP, and Pharmasoft actually ship (see `docs/01_PRODUCT.md` §10 for sources). Not internal guesses — named, standard features in this market.

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want a running "short book" / demand list that auto-fills with medicines at or below reorder level, so I know what to order without checking every product. | ❌ **Not built** | Marg calls this "smart ordering," eVitalRx a "digital shortbook." PharmaCare has the raw ingredient (`reorder_level`, `reorder_quantity` columns) but nothing assembles them into a list or feeds a purchase order. | Directly ties to the already-flagged dead `reorder_quantity` field — this is the feature that would make it alive. |
| As a pharmacist, I want tiered expiry warnings (e.g. 90/60/30 days out), not just one single "near expiry" cutoff. | ❌ **Not built** | Marg broadcasts alerts at 30/60/90 days automatically. PharmaCare has exactly one configurable `near_expiry_threshold_days` value — a batch is either "near expiry" or it isn't, no escalating urgency. | — |
| As a pharmacist, I want to return near-expiry or expired stock to the supplier for a credit note, before it becomes a total write-off. | 🔄 **Possible but not discoverable where it matters** | `PurchaseReturn` exists and could carry this, but it's always initiated from a specific past Purchase (`GET /purchases/{id}/items-for-return`) — there is no "return this batch" action from the Inventory health screen or the near-expiry alert itself. | A pharmacist looking at a near-expiry batch on the Inventory page has no path from there to returning it — they'd have to know and find the original purchase order first. |
| As a pharmacist receiving a distributor's invoice, I want to import that purchase bill directly from Excel/CSV/email instead of retyping every line into a new Purchase. | ❌ **Not built** | Pharmasoft supports one-click purchase-bill import from Excel/CSV/email. PharmaCare's only Excel import is the product-catalog bulk-upload (section A) — it does not create a `Purchase` record from a supplier's invoice file. | Distinct feature from catalog bulk-upload — don't conflate the two when scoping this. |
| As a pharmacist, I want to compare prices for the same medicine across my suppliers before ordering. | ❌ **Not built** | Not present in PharmaCare in any form — no per-supplier price history view. | — |

**G. Live-verified findings** — found by actually running the app (backend + frontend, real login, real product created), not by reading code. This is exactly why "run it" is a different check than "read it": a bug can look correct in the source and still be wrong at runtime.

| Finding | Severity | Detail |
|---|---|---|
| `GET /reports/dashboard` — the Dashboard's main stat cards — was **completely broken, silently, for every pharmacy, all the time** | ✅ **Fixed August 22, 2026** | Every field it returned (`today_sales`, `total_sales`, `total_medicines`, `low_stock_count`, `expiring_soon_count`, `total_stock_value`) was hardcoded to `0` because the endpoint threw on *every* call. Root cause in the `uvicorn` log: `Dashboard stats error: Function.__init__() got an unexpected keyword argument 'else_'` — the code called `func.case((...), else_=0)`, but `func.case` (the generic SQL-function proxy) doesn't accept `else_`; that's only valid on SQLAlchemy's real `case()` construct. A broad `except Exception` swallowed this and returned an all-zero dict instead of erroring. Fixed by importing and using the real `case()` (3 call sites in this function). Verified live: created a real product+batch, endpoint now returns `total_medicines: 1`, `total_stock_value: 60.0` matching it exactly. Regression test added: `test_dashboard_analytics.py::TestReportsDashboardAndAnalyticsSummary::test_reports_dashboard_reflects_real_stock` — proven to fail against the pre-fix code, passes against the fix. |
| `GET /analytics/summary` had the **exact same bug** | ✅ **Fixed August 22, 2026** | Same `func.case(..., else_=...)` misuse (3 more call sites), same silent-zero fallback. Fixed the same way. Verified live: created a real ₹80 paid bill, endpoint now returns `gross_sales: 80.0` correctly. Regression test added: `test_analytics_summary_reflects_real_sale` — same fail-then-pass verification. |
| `GET /analytics/dashboard` (the *other* dashboard endpoint) does **not** have this bug | ✅ confirmed | Live-tested: correctly returned the test product in its `low_stock` list. This is the one this doc's earlier passes had verified correctly — that verification holds. |
| All 6 `func.case(..., else_=...)` call sites in the codebase — searched exhaustively via grep, not guessed | ✅ **All fixed** | All 6 live inside `get_dashboard_stats` and `get_analytics_summary` in `backend/routers/reports.py` — no other router uses this pattern. Correction to this doc's own earlier entry: it had guessed one might be in `get_expiry_report` — traced precisely this pass and that guess was wrong; `get_expiry_report` and `get_low_stock_report` never used `func.case` at all, which is exactly why they tested clean live earlier. |
| A **fourth** low-stock definition exists: `GET /reports/low-stock` | ⚠️ New | Not in this doc's earlier 3-definitions writeup. Uses per-product `reorder_level` (agrees with `/inventory`, at least) — but it's still a separate, independent implementation, not a shared one. |
| Search bar placeholder promises more than the backend delivers | 🟡 Minor, user-visible | Inventory search box reads "Search medicine by name, generic, strength…" — but `GET /products?search=` only matches `name`/`sku`/`brand`/`manufacturer` (confirmed both in code and via this doc's section A). A pharmacist searching by generic name or strength, exactly as the placeholder invites, gets nothing. |
| Two Radix `DialogContent` accessibility warnings | 🟡 Minor | Add Medicine and Bulk Upload modals both throw "`DialogContent` requires a `DialogTitle`... to be accessible for screen reader users" in the browser console. Real, live, unaudited a11y gap — see `docs/17_ACCESSIBILITY.md`. |
| Bulk Excel upload has an undocumented **5,000-row cap** | ℹ️ Info | Visible in the wizard's own UI copy ("Supported formats: .xlsx, .xls (Max 5,000 rows)") — not previously documented anywhere in this doc. Worth confirming this is a deliberate, communicated limit for a pharmacy with a larger catalog. |
| Add Medicine → opening stock in one step | ✅ Positive finding | The modal combines product creation and first-batch entry into a single form (Category/GST/Schedule fields alongside Batch Number/Expiry/Quantity/MRP) — good UX, matches the "zero cognitive load" manifesto rule. Not a gap, noting it because static code reading undersold how well this flow is put together. |
| End-to-end add-and-see-it-in-the-list loop works correctly | ✅ Confirmed | Created a real product with a 15-day-out expiry batch → `GET /inventory` correctly computed `status: "near_expiry"`, `severity: 2` (near-expiry correctly outranks low-stock in the severity order, as documented) → appeared correctly in the Inventory list UI. |

---

### Inventory's cross-cutting dependents

> Per Manifesto rule 11: these are the sections that read or are shaped by
> Inventory data. Any change to Inventory's schema or business rules must be
> checked against every row here in the same change, not after.

**Dashboard / Analytics** (`GET /reports/dashboard`, `GET /analytics/dashboard`, `pages/Dashboard`)
- `GET /reports/dashboard` (total product count, total stock value, low-stock count, expiring-soon count, today/total sales) — ✅ **fixed August 22, 2026** (was silently returning all zeros — see section G above). Now has a regression test.
- `GET /analytics/dashboard`'s `low_stock`/`expiring_soon` lists — ✅ live-verified correct (this is the endpoint whose settings-driven logic was already documented correctly)
- AlertsPanel (low stock + near expiry + drug license expiry) — 🔄 data side confirmed correct via `/analytics/dashboard`; still need to verify the frontend gates on `low_stock_enabled`/`near_expiry_enabled` flags
- Sales charts / insights — not inventory-dependent, out of scope here; also likely affected if they read `/reports/dashboard`, not yet checked

**Settings** (`pages/Settings/components/InventoryTab.jsx`, `GeneralTab`, `GSTTab`)
- Near-expiry day threshold — ✅ wired end-to-end
- Low-stock day threshold — 🔄 wired to `/analytics/dashboard` only, not to `/inventory` or `/reports/dashboard` (see gap above)
- Block-expired-stock / allow-near-expiry-sale toggles — ❌ UI-only, no backend column, no enforcement (see above)
- Default GST rate / HSN mapping (Tax & GST tab) — ✅ applied at product-create time via `CATEGORY_HSN_MAP`

**Billing** (already covered in depth in `docs/07_BUSINESS_LOGIC.md` and `docs/08_ARCHITECTURE.md`'s cross-cutting map — cross-referenced, not repeated here)
- FEFO batch consumption, MRP-vs-batch check, H1 doctor-required check, stock-oversell guard — ✅ all built and verified this session
- Expired-batch sale blocking — ❌ **not built**, ties directly to the Settings gap above: even if the toggle worked, nothing downstream would enforce it

**Purchases** (`routers/purchases.py`, cross-referenced in the table below)
- Confirming a purchase creates `StockBatch` rows and `StockMovement` entries — ✅

**Reports** (`docs/07_BUSINESS_LOGIC.md`'s GST report section)
- GST report reads `Product.gst_rate`/`hsn_code` at time of sale (frozen on the bill/purchase line item, not live-joined) — ✅, already documented
- Schedule H1 register reads `Product.drug_schedule` — ✅, already documented

### Purchases

| Feature | Status | Notes |
|---------|--------|-------|
| Create purchase (draft) | ✅ | |
| Confirm purchase (stock in) | ✅ | Creates batches, stock movements |
| Purchase number (PUR-YYYYMMDD-XXXX) | ✅ | |
| Purchase return | ✅ | Stock deducted, GRN reversed |
| Supplier management (CRUD) | ✅ | |
| Link purchase to supplier | ✅ | |
| Purchase history per supplier | ✅ | |

**Purchases — competitor-validated gaps** — per Manifesto rule 15, checked against Marg ERP, eVitalRx, and Pharmasoft. Verified against real code (`backend/routers/purchases.py` — every endpoint grepped and listed: list/create/update/get/pay, no others exist), not guessed.

| User story | Status | Detail |
|---|---|---|
| As a pharmacist receiving a distributor's invoice, I want to import that bill directly from a CSV/Excel file the distributor sends, instead of typing every line item by hand. | ❌ **Not built** | Already flagged once under Inventory §F (don't duplicate the fix there) — restating here because it's really a Purchases-flow gap: `purchases.py` has no upload/parse/import endpoints, only manual `PurchaseCreate` entry. Pharmasoft ships one-click CSV/Excel/email invoice import as a named feature. |
| As a pharmacist, I want a running auto-generated purchase list ("digital shortbook") built from products at or below reorder level, that I can turn directly into a purchase order. | ❌ **Not built** | Same root gap as the Inventory §F "short book" entry — `reorder_level`/`reorder_quantity` exist on `Product` but nothing in `purchases.py` reads them to seed a draft purchase. eVitalRx's flagship ordering feature; here it would also finally make the currently-dead `reorder_quantity` column do something. |
| As a pharmacist, I want to compare a medicine's price across my different suppliers before creating a purchase order. | ❌ **Not built** | No per-supplier price history endpoint or view — confirmed via the full endpoint list above. |
| As a pharmacist, I want automatic highlighting when a purchase order line item is for a product that's already expired or near-expiry in my catalog, so I don't reorder something with a stock problem by accident. | ❌ **Not built** | `create_purchase`/`update_purchase` in `purchases.py` do not cross-check `Product`/`StockBatch` expiry state at all — a standard Indian-pharmacy-software convention (auto-flagging near-expiry/expired items in PO review), absent here. |
| As a pharmacist, I want my confirmed purchases to sync to Tally for accounting. | ❌ **Not built** | Same `tally` grep as Billing above — zero hits repo-wide, applies equally to the purchase side. |

### Customers

| Feature | Status | Notes |
|---------|--------|-------|
| Customer CRUD | ✅ | |
| Customer purchase history | ✅ | |
| Credit limit per customer | 💡 | Not yet designed |
| Loyalty / points | 🚫 | Phase 2 |

### Reports

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard analytics | ✅ | Revenue, bills, top products, dynamic thresholds from settings |
| Drug license expiry banner | ✅ | Amber strip above metrics, dismissible, links to Settings |
| GST report (GSTR-1 summary) | ✅ | Grouped by HSN, date range |
| Sales report | ✅ | By date range |
| Margin report | 🔄 | Data exists, UI WIP |
| Stock valuation report | 📋 | Cost × qty on hand |
| Purchase report | ✅ | By date range, supplier |
| Expiry report | 📋 | Batches expiring in N days |
| Schedule H1 register | ✅ | Read-only compliance view |
| Audit log viewer | ✅ | Read-only, all actions |

### Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Pharmacy profile (name, address, GSTIN, logo, DL, FSSAI, PAN) | ✅ | Drag & drop logo, inline validation, DL expiry warning |
| Receipt & Print settings | ✅ | Live bill preview, paper size (A4/A5/58mm/80mm), show/hide toggles, header/footer |
| Tax & GST settings | ✅ | Composition scheme, IGST toggle, default rate, HSN defaults, round off |
| Notifications settings | ✅ | Low stock, near expiry, drug license alerts — toggle + threshold stepper |
| Bill number prefix + sequence config | ✅ | |
| Inventory settings | ✅ | Near expiry days, low stock threshold |
| Billing settings | ✅ | Draft bills, auto-print |
| Returns settings | ✅ | Return window, partial returns |
| Team management (add/remove users) | ✅ | |
| Role assignment | ✅ | admin / manager / cashier / inventory_staff |

---

## MANIFESTO ITEMS NOT YET BUILT

These are confirmed requirements from CLAUDE.md `WHAT'S NEXT`. Build in this order:

### 1. Sheets (right-side drawers) — `📋 Planned`

Replace all centered modals for data-entry forms.

- **What:** Shadcn `<Sheet side="right">`, 480px wide
- **Where:** New bill form, new purchase form, add/edit medicine, add supplier
- **Why:** Industry standard (Linear, Notion) — better for complex forms than centered modals
- **Rule:** All new data-entry forms must use Sheet. No new centered modals.

### 2. Zod + react-hook-form on all forms — `📋 Planned`

- **What:** Every form uses `zodResolver` with a schema
- **Where:** All forms in Billing, Purchases, Inventory, Settings
- **Why:** Consistent validation, type-safe, eliminates uncontrolled inputs
- **Rule:** No new form without a Zod schema

### 3. Error retry states — `📋 Planned`

- **What:** Network errors show Shadcn `<Alert variant="destructive">` + Retry button
- **Where:** Every page that fetches data
- **Why:** No silent failures
- **Rule:** Every `catch` block must display something. See `12_ERROR_HANDLING.md`.

### 4. Command Palette — `📋 Planned`

- **What:** `Cmd+K` opens global search
- **Searches:** Bills (by number/customer), medicines, customers, suppliers
- **UI:** Shadcn `<Command>` component
- **Rule:** Does not block any current work. Build after Sheets + Zod.

### 5. Speed keys — `📋 Planned`

- `n` = new (context-aware — new bill on billing page, new product on inventory)
- `f` = open filter panel
- `/` = focus search
- `Esc` = close sheet/modal
- `Enter` = confirm primary action

---

## AUTH OVERHAUL — `📋 Planned` (build as one sprint)

All auth improvements must be built together — they share the same architectural change (stateless JWT → DB-backed sessions).

### 6. Forgot password / reset flow — `📋 Planned`

- **What:** "Forgot password?" on login → email with reset link → user sets new password
- **Why:** Currently no self-service recovery. If a user forgets their password, they are locked out.
- **Needs:** Email infrastructure (SMTP / SendGrid), password reset token table in DB
- **Rule:** Reset tokens expire in 1 hour. Single use only.

### 7. Admin force-logout / session management — `📋 Planned`

- **What:** Admin can see all active sessions per user (device, IP, last seen) and remotely log them out
- **Where:** Team → Members → click member → Sessions panel
- **Why:** Staff leave, devices go missing, suspicious after-hours logins. Pharmacy handles PII + financial data — session control is a compliance requirement.
- **Needs:** `user_sessions` table (user_id, device, ip, last_seen, token_ref), token blacklist or DB-backed refresh tokens, `GET /users/{id}/sessions`, `DELETE /sessions/{id}` endpoints
- **Rule:** Logging out a session must take effect within seconds — not at next JWT expiry.

### 8. Admin reset password for other users — `📋 Planned`

- **What:** Admin sets a temporary password for any user from Team → Members
- **Why:** Cashier forgets password → billing counter stops. Admin must be able to unblock them instantly.
- **Needs:** Shares infra with #6 and #7. Build in same sprint.

---

## PHASE 2 — MULTI-STORE CHAINS `🚫 Do not build now`

| Feature | Notes |
|---------|-------|
| Chain / HQ account | One account, multiple store locations |
| Store switcher in sidebar | |
| Cross-store stock transfer | |
| Centralized purchase orders | HQ orders for all stores |
| Chain-level GST reports | |
| Store-level P&L | |

> **Do not add `chain_id`, `store_id`, or any multi-store column to Phase 1 tables.** It creates premature complexity. Phase 2 will be a migration sprint.

---

## PHASE 3 — PLATFORM `🚫 Do not build now`

| Feature | Notes |
|---------|-------|
| Patient app (prescription refills) | |
| Doctor portal (e-prescriptions) | |
| Distributor integration (live price lists) | |
| Government reporting API (CDSCO) | |
| WhatsApp / SMS reminders (refills, dues) | |
| Accounting integration (Tally, Zoho Books) | |

---

## WHAT NOT TO BUILD (ever, in Phase 1)

| Request | Why not |
|---------|---------|
| IGST support | All sales are intra-state in Phase 1 |
| Multi-currency | Indian market only |
| Online pharmacy (sell to patients online) | Regulatory complexity, out of scope |
| Controlled substance (Schedule X) billing | Requires different compliance system |
| Insurance claims / CGHS | Phase 3+ |
| AI drug interaction checker | Not a pharmacy management feature |
| Hard delete anything | Compliance — forever forbidden |

---

## KNOWN ISSUES / TECH DEBT

| Issue | Priority | Notes |
|-------|----------|-------|
| Sheets not implemented — forms use centered modals | High | Next sprint |
| Zod not on all forms — some use uncontrolled inputs | High | Next sprint |
| Bill PDF template incomplete | Medium | Renderer exists, layout WIP |
| Low stock / expiry alerts surfaced in Dashboard AlertsPanel | ✅ | Done — thresholds read from PharmacySettings |
| Bulk upload UX incomplete | Medium | Backend done |
| Margin report UI WIP | Low | Data available via API |
| No CI/CD pipeline | Medium | Manual deploys today |
| No staging environment | Medium | Dev → prod directly today |
| Feature flags not connected to Roadmap items | Medium | All 📋 items should ship behind a flag |

---

*Update this file when a feature ships (✅) or a new item is confirmed (📋).*
*Owner: developer who builds the feature updates the status row.*
