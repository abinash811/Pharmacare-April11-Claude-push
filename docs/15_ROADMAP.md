# PharmaCare — Roadmap
# Version: 2.10 | Last updated: August 23, 2026
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
| As a pharmacist, I want to add a new medicine to the catalog. | ✅ `POST /products` | Required: `name`. Optional: `sku` (auto-generated `SKU-XXXXXXXX` if left blank), `manufacturer`, `brand`, `generic_name`, `strength`, `dosage_form`, `pack_size`, `units_per_pack` (default 1), `category`, `barcode`, `gst_percent` (default 5%, must be one of the valid GST slabs), `schedule` (OTC/H/H1/X, default OTC), `low_stock_threshold_units` (→ `reorder_level`, default 10), `requires_refrigeration` (default false). HSN code is auto-derived from category, not typed. SKU must be unique per pharmacy. | `strength`/`requires_refrigeration` fixed August 22, 2026 (were dead columns — see below). `reorder_quantity` is still settable but nothing downstream reads it. Photo/image field doesn't exist. No default-supplier link at the product level. |
| As a pharmacist, I want to edit an existing medicine's details. | ✅ **Fixed August 22, 2026** — `PUT /products/{id}` | Same field set as create, all optional/partial. Changing `category` silently re-derives `hsn_code`. | **Both real "Edit Product" screens (Inventory list and Medicine Detail) called the wrong URL and 500'd on every single save, for every field, always** — see the Rule Misses Log entry below; this is separate from and larger than the strength/refrigeration gap. Fixed. Still admin-only — a manager or cashier cannot fix a typo themselves. |
| As a pharmacist, I want to remove a medicine that's no longer stocked. | ✅ `DELETE /products/{id}` (soft delete, sets `deleted_at`) | Admin-only. Blocked with a 400 if any batch still has `quantity_on_hand > 0` — "Write off batches first." | No reason/note is captured for the deletion itself (unlike stock adjustments, which require a reason) — there's no audit trail answering "why was this removed." |
| As a pharmacist, I want to search for a medicine by name, SKU, brand, manufacturer, generic name, or strength. | ✅ **Fixed August 22, 2026** — `GET /products?search=`, `GET /inventory?search=` | Matches all six fields now (`ilike`, partial match) — the search box's own placeholder ("name, generic, strength…") is now actually true. | — |
| As a cashier, I want to scan a barcode and instantly find the medicine and its stock. | ✅ `GET /products/barcode/{barcode}` | Falls back to matching on `sku` too if barcode isn't found. Returns available batches + suggested (FEFO) batch. | — |
| As a pharmacist, I want to view one medicine's full detail — batches, stock ledger, sales/purchase history. | ✅ `pages/MedicineDetail` (tabs: Batches, Ledger, Transactions) | — | — |
| As a pharmacist, I want to change the GST rate, category, schedule, discount, location, or cold-chain flag on many medicines at once instead of one by one. | ✅ `POST /products/bulk-update` | Allowed fields: `gst_percent`, `category`, `schedule`, `discount_percent`, `location`, `brand`, and `requires_refrigeration` (added August 22, 2026). Admin/manager only. | `brand`/`requires_refrigeration` are allowed by the backend but **not offered** in `BulkUpdateModal.jsx`'s field dropdown yet — a real but minor UI gap (backend-only for now, callable directly). No bulk delete. No validation warning if a bulk change conflicts with existing stock (e.g. bulk-changing schedule to H1 on products already mid-sale). |
| As a pharmacist onboarding a new pharmacy, I want to upload my whole existing medicine catalog from an Excel/CSV file instead of typing each one in. | ✅ `POST /inventory/bulk-upload/parse` → `/validate` → `/import`, plus `GET /template` and `/progress/{job_id}` | 4-step wizard: upload file → map columns (auto-detects SKU/name/price/quantity/expiry/batch/brand/category columns by keyword) → preview & validate → import with a progress bar. Downloadable template. Error report available per failed row. | Job state is stored **in-memory** (`bulk_upload_jobs: Dict`) — a backend restart mid-import loses job/progress state. Not yet confirmed whether a partially-failed import is fully atomic or can leave a mix of imported/skipped rows without a clear "what actually landed" summary — worth a dedicated test before relying on it for a large real catalog. |
| As a pharmacist, I want to print a barcode label for a medicine that doesn't have one yet. | ❌ **Not built** | — | No label-printing code anywhere in the repo. |
| As a cashier, I want to sell 5 loose tablets from a 10-tablet strip, not the whole strip. | ✅ | `units_per_pack` conversion, used consistently in `billing.py` and `batches.py`. | — |
| As a pharmacist, I want to record exactly which rack/shelf/bin a medicine sits on so staff can find it fast. | 🔄 **Half-built** | A single free-text `storage_location` string exists and is now actually settable — Add Medicine and both Edit Product modals gained a Storage Location field August 23, 2026 (previously nothing in the UI wrote to it at all, so it was always null; see the live-caught bug in the findings table below). A separate `location_id` param appears on 3 endpoints but is always `"default"` — vestigial, not wired to anything. | Still no structured rack/shelf/aisle/bin fields — one free-text string per product. No support for one product's stock being split across multiple physical spots. `location_id` is still misleading dead weight — either build it properly or remove it. |
| As a pharmacist, I want the system to suggest how much to reorder when a medicine runs low. | 🔄 **Half-built** | `reorder_quantity` column exists and is stored per product. | Nothing reads it — no "suggested purchase quantity" appears anywhere (not in Purchases, not in the low-stock alert). The field is write-only today. |
| As a pharmacist, I want to flag a medicine as needing refrigerated storage. | ✅ **Fixed August 22, 2026** | `requires_refrigeration` in `ProductCreate`/`ProductUpdate`, Add/Edit Medicine forms (a real checkbox), a ❄️ badge on the Inventory table row and Medicine Detail header, a "Requires Refrigeration only" filter (`GET /inventory?cold_chain_only=true`), and a bulk-update field. | No dedicated Reports/Analytics view for cold-chain stock — checked, genuinely not needed yet (nothing there currently depends on this field being wrong the way the low-stock definitions did); would be new scope, not a gap in what exists today. |
| As a pharmacist, I want to record a medicine's strength (e.g. 500mg) separately from its name. | ✅ **Fixed August 22, 2026** | `strength` in `ProductCreate`/`ProductUpdate`, Add/Edit Medicine forms, shown inline next to the name on the Inventory table and Medicine Detail header, and now searchable (see search row above). Also now a real Excel bulk-upload column (`utils/excel.py` — auto-detected keywords, template, sample data), alongside `dosage_form`, which was in the same position (a real optional `ProductCreate` field the bulk-upload path silently never mapped). | Bulk-upload still doesn't map every optional field that exists (e.g. `barcode`) — narrower gap than before, not fully closed. |

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
| As a pharmacist, I want to set the quantity that counts as "low stock." | ✅ **Fixed August 22, 2026** | Every endpoint now uses the same definition: a product's own `reorder_level` against its summed active-batch stock. See detail below. | — |

**Low-stock gap — fixed August 22, 2026 (verified live, not just by reading code):**
Three implementations used to disagree: `GET /inventory` used each product's own `reorder_level`; `GET /analytics/dashboard` used the pharmacy-wide `PharmacySettings.low_stock_threshold_days` setting checked **per batch**, not per product's summed stock; `GET /reports/dashboard` **hardcoded `10`**. A product with `reorder_level = 50` could show "low stock" on the Inventory page while the Dashboard stat card — same product, same moment — used a hardcoded 10 and showed nothing wrong.

Fixed by making every endpoint (`/inventory`, `/reports/low-stock`, `/analytics/dashboard`, `/reports/dashboard`) compare a product's summed active-batch stock against its own `reorder_level` — no more hardcoded numbers or per-batch/pharmacy-wide shortcuts. `PharmacySettings.low_stock_threshold_days` is no longer read as an alert threshold anywhere (it never functioned as one correctly to begin with — despite its name, it was always a raw unit-quantity, not a day count). Verified live: a product with `reorder_level=20` and 15 units on hand — below its own threshold, but *not* below the old hardcoded `10` — now shows as low stock consistently across all four endpoints; a product well above its threshold shows as low stock nowhere. Regression tests: `backend/tests/test_inventory_safety_settings.py::TestLowStockDefinitionAgreement`.

**E. Settings → Inventory tab enforcement** — `frontend/src/pages/Settings/components/InventoryTab.jsx`, `backend/routers/settings.py`, `backend/routers/billing.py`

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want to stop expired stock from ever being sold. | ✅ **Fixed August 22, 2026** | Real `PharmacySettings.block_expired_stock` column (migration `d81f3b0c6a4e`, default `True`), enforced in both `create_bill` and `update_bill`'s finalize paths — same pattern as the existing MRP/H1 checks. | Not separately covered by an HTTP integration test: `POST`/`PUT /stock/batches` both reject an `expiry_date` in the past by design, so there's no HTTP-reachable way to create an already-expired fixture batch without bypassing the API. Verified by code inspection — the two checks are structurally identical, one line apart. |
| As a pharmacist, I want to allow selling near-expiry stock but with a warning shown at billing. | 🔄 **Enforcement fixed August 22, 2026 — warning UI not built** | Real `PharmacySettings.allow_near_expiry_sale` column, enforced the same way: `False` blocks finalizing a sale on a near-expiry batch in both create_bill and update_bill. | The toggle now genuinely gates the sale (tested: `TestNearExpirySaleEnforcement`), but the "(with warning)" half of its own label isn't built — when the toggle is `True` (default), a near-expiry sale goes through with no warning shown anywhere in the billing UI. Scoped out of this pass; a real, separate frontend task. |
| As a pharmacist, I want to turn dashboard low-stock alerts on/off. | ✅ **Fixed August 22, 2026** | `InventoryTab.jsx`'s checkbox used a key (`low_stock_alert_enabled`) `GET /settings` never returned and `PUT /settings` silently dropped — a third, disconnected fake toggle alongside the two above, found while fixing them. Now reads/writes the same real `alert_low_stock_enabled` column `NotificationsTab.tsx` already used correctly, shown consistently in both tabs (same pattern already used for `near_expiry_days`). | — |
| As a pharmacist, I want to set the near-expiry alert window in days. | ✅ | `near_expiry_threshold_days` column, persisted and read correctly. | — |

**A note on `NotificationsTab.tsx`'s old "low stock — N days" input:** removed in the same pass. It read as a genuine days-of-stock-remaining prediction ("Only N days of stock remaining. Reorder soon.") but nothing in the codebase ever computed sales velocity — it silently applied its number as a raw unit-quantity cutoff instead, one of the three disagreeing definitions above. Replaced with a note pointing to each medicine's own `reorder_level` field, which is the real, working mechanism.

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
| Search bar placeholder promises more than the backend delivers | ✅ **Fixed August 22, 2026** | Inventory search box reads "Search medicine by name, generic, strength…" — `GET /products?search=` and `GET /inventory?search=` now actually match `generic_name` and `strength` too, live-verified: a product findable only by its strength text (not present anywhere in its name) now shows up in real UI search results. |
| Two Radix `DialogContent` accessibility warnings | 🟡 Minor | Add Medicine and Bulk Upload modals both throw "`DialogContent` requires a `DialogTitle`... to be accessible for screen reader users" in the browser console. Real, live, unaudited a11y gap — see `docs/17_ACCESSIBILITY.md`. |
| Bulk Excel upload has an undocumented **5,000-row cap** | ℹ️ Info | Visible in the wizard's own UI copy ("Supported formats: .xlsx, .xls (Max 5,000 rows)") — not previously documented anywhere in this doc. Worth confirming this is a deliberate, communicated limit for a pharmacy with a larger catalog. |
| Add Medicine → opening stock in one step | ✅ Positive finding | The modal combines product creation and first-batch entry into a single form (Category/GST/Schedule fields alongside Batch Number/Expiry/Quantity/MRP) — good UX, matches the "zero cognitive load" manifesto rule. Not a gap, noting it because static code reading undersold how well this flow is put together. |
| End-to-end add-and-see-it-in-the-list loop works correctly | ✅ Confirmed | Created a real product with a 15-day-out expiry batch → `GET /inventory` correctly computed `status: "near_expiry"`, `severity: 2` (near-expiry correctly outranks low-stock in the severity order, as documented) → appeared correctly in the Inventory list UI. |
| Both "Edit Product" screens' Save button 500'd on every field, always | ✅ **Fixed August 22, 2026** | See the RULE MISSES LOG entry above — wrong URL (`PUT /products/{sku}` instead of `/products/{id}`), plus a permanently-blank `required` MRP field that would have kept blocking saves even after the URL fix. Live-verified fixed end to end: add a medicine → search finds it by strength alone → edit its strength and cold-chain flag → "Product updated successfully" toast → hard page reload → change persisted. |
| `FilterDrawer.jsx` offered 6 filters; only 2 actually filtered anything | ✅ **Fixed August 22, 2026** | All 6 now wired for real: `GET /inventory` gained `dosage_form_filter`, `schedule_filter`, `gst_filter`, `location_filter` (alongside the existing `category_filter`/`status_filter`/the new `cold_chain_only`); `GET /inventory/filters` now returns real `dosage_forms`/`schedules`/`gst_rates`/`locations` instead of the frontend always using hardcoded defaults regardless of what the backend sent — which also silently included a fictional 28% GST slab that was never a real rate (`VALID_GST_RATES` = 0/5/12/18). Live-verified: filtering by Dosage Type "Syrup / Liquid" correctly isolates only syrup-form products. Regression tests: `test_product_strength_refrigeration.py::TestInventoryFilterDrawerWiring`. |
| Bulk update (GST/category/schedule/discount/location on many medicines) | ✅ Confirmed already built, then extended | Core 5-field bulk update was already live and working — verified end to end (create 2 products → bulk-change GST → toast success → both products' `gst_percent` confirmed via API). Extended August 22, 2026 with `brand` and `requires_refrigeration` as two more bulk-editable fields in `BulkUpdateModal.jsx`, matching the same strength/refrigeration work done elsewhere this session. |
| `_filterCache` (module-level cache in `useInventorySearch.js`) never actually refreshed in a live session | ✅ **Fixed August 22, 2026** | Found while live-testing the new Brand bulk-update field: `refetch()` (called after every add/edit/adjust) only did `_filterCache = null`, which busts the cache for some *future* component mount — but this is a single-page app, so that mount never happens again in the same session. A brand/category/location added mid-session never appeared in `FilterDrawer` or `BulkUpdateModal` dropdowns until a hard page reload. Fixed by extracting the mount-time fetch into a reusable `loadFilterOptions(force)`, called with `force=true` from `refetch()` instead of nulling the cache. Live-verified: created a product with a brand new to the pharmacy, immediately bulk-updated 2 products to that exact brand with no reload in between. |
| `storage_location` had no field anywhere to set it — Bulk Update's Location dropdown was permanently empty | ✅ **Fixed August 23, 2026** | Real, live-caught user report: Add Medicine's "location" value was only ever sent to `POST /stock/batches` (a hardcoded `'Default'` string on the *batch*), never to the *product's* `storage_location` column that `GET /inventory/filters` and Bulk Update actually read from — so `storage_location` was null on every product ever created through the UI, meaning Location's "existing values" list had nothing to list. Fixed: `storage_location` added to `ProductCreate`/`ProductUpdate`, a real Storage Location field added to Add Medicine and both Edit Product modals. Live-verified: added a medicine with a brand-new location, it appeared immediately in Bulk Update's Location dropdown with no reload. Regression tests: `test_product_strength_refrigeration.py::TestStorageLocationAndCanonicalCategories`. |
| Bulk Update's Category dropdown only ever showed categories already in use — a pharmacy with only `medicine` products could never bulk-assign `surgical`/`first_aid`/`device` | ✅ **Fixed August 23, 2026** | `GET /inventory/filters`'s `categories` was distinct-from-data like brand/location, but category is a constrained enum like dosage_form/gst_rate (`VALID_CATEGORIES` in `constants.py`) — every valid choice should be offered regardless of what's used yet, same reasoning as the dosage-form/GST-rate fix above. Now returns the canonical `PRODUCT_CATEGORIES` list (same source Add Medicine already used correctly via `/products/meta`). `FilterDrawer.jsx`/`BulkUpdateModal.jsx` updated to render the `{value,label}` shape. Live-verified: Bulk Update's Category dropdown now always shows all 4 (Medicine/Surgical/First Aid/Medical Device) regardless of what the pharmacy has used. |
| Edit Product modal (Inventory list's Edit button) dropped keyboard focus after every single character typed, in every field | ✅ **Fixed August 23, 2026** | Real, live-caught user report ("arrow doesn't stay in the field, have to click again for each letter"). Root cause: `EditProductModal.jsx` defined its `F` field-wrapper component *inside* the modal's own function body. A component defined inside a parent's render creates a brand-new function identity every render, so React treats `<F>` as a different component type each time and unmounts/remounts every field's DOM node — including the focused `<input>` — on every keystroke. Fixed by moving `F` to module scope (outside `EditProductModal`), same as every other field-wrapper component in this codebase already correctly does. Grepped the rest of `pages/` for the same pattern — no other file has it. Live-verified with real sequential keystrokes (Playwright `pressSequentially`, 60ms/key): both Brand and Storage Location fields now retain the full typed string instead of only the last character. |
| Edit Product's Medicine Name was a plain input; Add Medicine's was a suggest-dropdown sourced from the same seed list — inconsistent, and a live-caught user request to make them match | ✅ **Fixed August 23, 2026** | Extracted `SuggestField` (AddMedicineModal.tsx's local suggest-input) into a real shared component, `frontend/src/components/shared/SuggestField.tsx`, and refactored `AddMedicineModal.tsx` to import it instead of keeping its own duplicate — one fewer copy of a component to independently pick up bugs like the focus-loss one above. Both Edit Product modals (Inventory list and Medicine Detail) now use the same `SuggestField` + the same `SEED_MEDICINES` list for Medicine Name, matching Add Medicine's suggestions exactly. Selecting a suggestion only fills Category/Generic Name if they're currently blank — never silently overwrites a value the product already has. Live-verified: typing "Dolo" in Edit Product's Medicine Name shows the same "Dolo 650" suggestion Add Medicine shows. |
| Batch Number was optional in Add Medicine's opening-stock step, silently falling back to a fabricated `INIT-<timestamp>` string if left blank | ✅ **Fixed August 23, 2026** | Researched against Rule 65, Drugs and Cosmetics Rules 1945 (batch number required on the sale invoice, explicitly for Schedule H/H1) and how Marg ERP/Vyapar treat batch-wise tracking as core, not optional. Decision, made with the product owner: batch number is required for **every** medicine, not just H/H1 — every unit of stock in this system lives inside a batch record regardless of schedule, and expiry tracking/FEFO/recall lookups all depend on it being real, not fabricated. This also closes a real inconsistency already in the codebase: Purchases already hard-required batch number for received stock; Add Medicine's opening stock did not. Fixed: the frontend fallback is gone, the field is now `required` (matching Purchases' UX); `POST`/`PUT /stock/batches` gained a real backend validator (`_validate_batch_no` in `batches.py`) rejecting a blank/whitespace batch number regardless of which client calls the API, not just the UI. `frontend/e2e/inventory.spec.ts`'s two Add Medicine flows updated to supply a real batch number (previously relied on the fallback). Regression tests: `test_batch_number_required.py` (create rejected without one, create rejected with whitespace-only, create succeeds with a real one, update cannot clear it back to blank). |
| Medicine Detail page audit (Aug 23, 2026, requested as a PM-style review + competitor research) found 3 real issues | ✅ All 3 fixed same day | **(1) Dead Bell/Clock icons** in `MedicineDetailHeader.jsx` — neither had an `onClick`, pure dead UI. **Fixed**: removed. **(2) Batches table's "Prev. MRP" and "PTR" columns were fabricated** — `Prev. MRP = mrp × 1.05` and `PTR = costPrice × 1.1`, hardcoded formulas with zero backing data (no price-history table exists anywhere). Worse than merely missing: styled identically to the real columns (₹, right-aligned), so they read as real business figures a pharmacist could price off. Confirmed `PTR` is actually the same value as the already-real `LP` column under a different name (`PurchaseNew`'s `ptr_per_unit` is stored directly as `cost_price_paise` — the same column `LP` already shows), so removing it loses no real distinct data. **Fixed**: both fabricated columns removed; the table's 7 remaining columns (Batch ID, Qty., Exp. Date, MRP, Disc. %, LP, Margin%) are all real, non-fabricated data. **(3) The header's MRP stat card always showed ₹0** — read `product.default_mrp_per_unit`, a field that has never existed on any product API response (MRP is per-batch, not per-product; researched how pharmacy software elsewhere handles this — MRP is batch-level everywhere, no product-master screen tries to force a single number). First fix picked the FEFO batch's MRP alone, but the product owner pushed back: silently picking one batch when others in stock disagree on price hides that a difference exists at all. **Fixed properly**: shows a single value (`₹100.00`) when all batches in stock agree, or a range (`₹100.00–150.00`) when they don't, with a hover-only info icon (Radix `Tooltip`, not always visible — confirmed on request) explaining why and pointing at the Batches tab for the exact per-batch breakdown. Shows "–", never a fake ₹0, when there's no batch in stock. The range string is long enough to truncate at the card's original font size, so `StatCard` drops to a smaller size once a value passes 10 characters. Live-verified all cases: single batch → `₹100.00`, no icon; two batches at different MRPs → `₹100.00–150.00` with a visible, un-truncated icon whose tooltip only appears on hover (confirmed empty/absent before hover, present after); zero batches → "–". Also flagged, not yet fixed: product name's inline `style={{fontFamily:'Manrope'}}` (only 2 files in the app do this instead of a design-system class); no supplier link, substitute/salt lookup, image upload, or Storage Location display on this page — real feature gaps, not bugs, logged for the backlog. |

---

### Inventory's cross-cutting dependents

> Per Manifesto rule 11: these are the sections that read or are shaped by
> Inventory data. Any change to Inventory's schema or business rules must be
> checked against every row here in the same change, not after.

**Dashboard / Analytics** (`GET /reports/dashboard`, `GET /analytics/dashboard`, `pages/Dashboard`)
- `GET /reports/dashboard` (total product count, total stock value, low-stock count, expiring-soon count, today/total sales) — ✅ **fixed August 22, 2026** (was silently returning all zeros — see section G above). Now has a regression test.
- `GET /analytics/dashboard`'s `low_stock`/`expiring_soon` lists — ✅ live-verified correct; `low_stock` now uses the same reorder_level-based definition as every other low-stock screen (was per-batch against a pharmacy-wide setting — fixed August 22, 2026)
- AlertsPanel (low stock + near expiry + drug license expiry) — 🔄 data side confirmed correct via `/analytics/dashboard`; still need to verify the frontend gates on `low_stock_enabled`/`near_expiry_enabled` flags
- Sales charts / insights — not inventory-dependent, out of scope here; also likely affected if they read `/reports/dashboard`, not yet checked

**Settings** (`pages/Settings/components/InventoryTab.jsx`, `GeneralTab`, `GSTTab`)
- Near-expiry day threshold — ✅ wired end-to-end
- Low-stock threshold — ✅ **fixed August 22, 2026**: no longer a pharmacy-wide day/quantity setting at all — every screen now reads each product's own `reorder_level` (see gap-fix above). `NotificationsTab.tsx`'s old numeric input was removed rather than left pointing at a dead setting.
- Block-expired-stock / allow-near-expiry-sale toggles — ✅ **fixed August 22, 2026**: real `PharmacySettings` columns, enforced in `billing.py` (see below)
- Default GST rate / HSN mapping (Tax & GST tab) — ✅ applied at product-create time via `CATEGORY_HSN_MAP`

**Billing** (already covered in depth in `docs/07_BUSINESS_LOGIC.md` and `docs/08_ARCHITECTURE.md`'s cross-cutting map — cross-referenced, not repeated here)
- FEFO batch consumption, MRP-vs-batch check, H1 doctor-required check, stock-oversell guard — ✅ all built and verified this session
- Expired-batch sale blocking — ✅ **fixed August 22, 2026**, enforced in both `create_bill` and `update_bill`, same pattern as the MRP/H1 checks. Near-expiry blocking enforced the same way; the "with warning" UI half of that setting's own label is still not built (see Settings → Inventory tab table above)

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

## RULE MISSES LOG
> Added August 22, 2026, in response to a direct question: "how will I be
> highlighted which rule was violated and why, and how do we update that so
> it doesn't happen again?" This section is the answer — a standing habit,
> not a one-time fix.

**The habit, every time a real bug is found that a written CLAUDE.md/docs
rule should have prevented** (not a typo, a genuine gap between documented
behavior and real behavior):
1. Name the exact rule (number + one line) **in the chat response**, not
   just in a commit message — you shouldn't have to go looking for it.
2. State plainly why it didn't catch the bug: was the rule not
   automatically enforced (a gap in tooling), or was it enforced but I
   missed following it (a gap in execution)? These need different fixes.
3. Fix the bug.
4. Close the gap that let it through — **in this order of preference**:
   a) an automated CI/pre-commit gate (like the `definition-of-done` job
      added today for rule 12) — the only kind of fix that doesn't depend
      on anyone remembering; b) only if no automated check is realistically
      possible, tighten the rule's wording so the next miss is less likely.
5. Log it below, dated, so there's one place to scan instead of hunting
   through chat history or commit messages.

| Date | Rule violated | Why it wasn't caught | Fix applied |
|------|---------------|----------------------|--------------|
| Aug 22, 2026 | Rule 12 ("every feature/fix ships with the tests that prove it") | Written, but nothing enforced it — a fix could merge with zero test coverage and nobody would know until it broke again. Root cause of the `func.case` dashboard bug shipping silently in the first place. | Added the `definition-of-done` CI job (`.github/workflows/ci.yml`) — blocks a PR that changes `backend/routers\|models\|utils` or `frontend/src/pages\|components\|hooks` with no matching test file changed. Documented in `docs/11_TESTING.md`. Still unproven on a real PR as of this entry — first real PR is the real test of this gate. |
| Aug 22, 2026 | Rule 14 ("no assumptions, verify every time") | Both real Edit Product screens (Inventory list and Medicine Detail) called `PUT /products/{sku}` — a string that was never a valid route, since the only real route takes a UUID `product_id`. `uuid.UUID(sku)` always raised, so **every save on every field, for every pharmacy, always 500'd** — not a strength/refrigeration-specific bug, a total break of "edit a medicine" itself. It read as correct in both files (a plausible-looking `apiUrl.productBySku()` call) and was never caught because nobody had actually clicked Save and watched it fail — found only while live-testing the unrelated strength/refrigeration addition in the same modal. A real `PUT /products/{id}` helper (`apiUrl.product(id)`) already existed and was already used correctly elsewhere in the codebase. | Fixed both modals to call `apiUrl.product(product.id)`. Also found and fixed a second bug in the same flow while there: the "MRP per Unit" field was marked `required` but is never populated (MRP lives per-batch, not per-product, in this schema) — blocking every save behind a permanently-blank required field even after the URL fix. Regression tests: `test_product_strength_refrigeration.py::test_update_by_real_id_saves_strength_and_refrigeration`, `::test_put_by_sku_is_not_a_valid_route`. No automated gate proposed for this class of bug — an E2E test that actually clicks "Edit → change a field → Save → reload → confirm it stuck" is the real fix, and one now exists for Inventory (`inventory.spec.ts`) but not yet for this specific edit flow — flagged as a follow-up, not built here to avoid scope creep beyond what this pass already covers. **Update, same day:** the deferred "real redesign" mentioned above was done in a follow-up pass — both modals now send only real `ProductUpdate` fields; HSN shows read-only/derived (matching Add Medicine), Composition is properly bound to `generic_name`, and the non-functional Status dropdown was removed rather than left showing a state (`is_active`) nothing in the codebase can ever set to false. |
| Aug 22, 2026 | Rule 14 ("no assumptions, verify every time") | `useInventorySearch.js`'s `refetch()` busted the filter-options cache with `_filterCache = null` — code that reads correct (a comment literally said "bust filter cache so categories refresh") but was never actually true in a single-page app: nulling a module variable doesn't make the already-mounted component re-fetch, so a brand/category/location added mid-session silently never appeared in `FilterDrawer`/`BulkUpdateModal` until a hard reload. Written, looked deliberate, never verified live — found only because this pass's own Playwright script tried to select a just-created brand from the Bulk Update dropdown and it wasn't there. | Extracted the fetch into a reusable `loadFilterOptions(force)`; `refetch()` now calls `loadFilterOptions(true)` for a real re-fetch instead of an inert cache-null. Live-verified: create a product with a brand new to the pharmacy → immediately open Bulk Update → new brand is selectable, no reload. No automated gate proposed — this class of bug (a cache invalidation that looks right but never fires because of SPA lifetime assumptions) is caught by actually driving the UI, not by a unit test; the fix was verified the same way it was found. |

**Rules known to still be manual-only (flagged proactively, not yet
violated in a way that's been caught)** — these are the honest candidates
for the next entry in this table if they slip:
- Rule 11 (cross-cutting consumers) — no automated check that every linked
  domain in `docs/08_ARCHITECTURE.md`'s cross-cutting map was actually
  verified before calling a change done.
- Rule 9 (no unverified routes / magic strings) — nothing lints that a
  called API route or a hardcoded status string actually exists/matches
  `constants/domainConstants.js`.

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
