# PharmaCare — Roadmap
# Version: 2.44 | Last updated: September 12, 2026
# Type: Living Status
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

> **V1 launch scope confirmed with Abinash, Aug 23, 2026.** Inventory
> (add/upload/bulk-update/filter), Purchases + Returns, Billing + Returns,
> Reports (CSV/Excel downloads), Analytics, Settings — all at "good enough
> for a real single pharmacy" depth, advanced features deferred to V2.
> Forgot-password + admin-reset-password pulled into V1 from Auth Overhaul
> below (a locked-out cashier stops billing — that's a launch blocker, not
> a nice-to-have). Session management (force-logout) stays V2.

### Core Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| JWT authentication | ✅ | Login, register, token refresh |
| Forgot password / reset flow | 📋 | V1-required — see Auth Overhaul #6 for design notes |
| Admin reset password for other users | 📋 | V1-required — see Auth Overhaul #8 for design notes |
| Multi-tenancy (pharmacy_id isolation) | 🔄 | Enforced on the paths that have been audited; a real signup-flow bug (fixed) proved the pattern "forgot to scope by pharmacy_id" exists — full query audit not yet done. See `13_DEPLOYMENT.md` PRE-LAUNCH BLOCKERS #2. |
| Soft deletes | ✅ | `is_deleted` + `deleted_at` on all tables |
| Audit logging | ✅ | All state changes logged |
| PostgreSQL + SQLAlchemy async | ✅ | Migrated from MongoDB |
| Alembic migrations | ✅ | Schema version controlled |
| Design system (tokens, shared components) | ✅ | AppButton, PageHeader, PageTabs, FilterPills, etc. |
| 300-line file rule enforced | ✅ | All oversized pages split into folder/index.jsx + components/ |
| Zero raw `<button>` tags | ✅ | Fixed Sep 6, 2026 — last 21 violations (BillingWorkspace/Dashboard) replaced with AppButton. `scripts/design-guard.sh` Rule 1 now passes repo-wide. See RULE MISSES LOG. |
| Zero Shadcn `<Button>` in pages | ✅ | Fixed Sep 6, 2026 — `ScheduleHWarning.jsx`/`FinaliseModal.jsx` now use AppButton. Rule 5 passes repo-wide. |
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
| As a cashier, I want to sell 5 loose tablets from a 10-tablet strip, not the whole strip. | ✅ **Fixed for real Sep 11, 2026** | `StockBatch` quantities are real units (migration `a343c922f896`) — this row previously said "units_per_pack conversion, used consistently," which was the bug, not the fix: a loose-unit sale smaller than one pack floor-divided to 0 and silently never deducted stock. See RULE MISSES LOG. | — |
| As a pharmacist, I want to record exactly which rack/shelf/bin a medicine sits on so staff can find it fast. | 🔄 **Half-built** | A single free-text `storage_location` string exists and is now actually settable — Add Medicine and both Edit Product modals gained a Storage Location field August 23, 2026 (previously nothing in the UI wrote to it at all, so it was always null; see the live-caught bug in the findings table below). Now also **displayed** on the Medicine Detail page (August 23, 2026) — a pin icon + the location text next to the manufacturer/pack-info line, only shown when set. A separate `location_id` param appears on 3 endpoints but is always `"default"` — vestigial, not wired to anything. | Still no structured rack/shelf/aisle/bin fields — one free-text string per product. No support for one product's stock being split across multiple physical spots. `location_id` is still misleading dead weight — either build it properly or remove it. |
| As a pharmacist, I want the system to suggest how much to reorder when a medicine runs low. | 🔄 **Half-built** | `reorder_quantity` column exists and is stored per product. | Nothing reads it — no "suggested purchase quantity" appears anywhere (not in Purchases, not in the low-stock alert). The field is write-only today. |
| As a pharmacist, I want to flag a medicine as needing refrigerated storage. | ✅ **Fixed August 22, 2026** | `requires_refrigeration` in `ProductCreate`/`ProductUpdate`, Add/Edit Medicine forms (a real checkbox), a ❄️ badge on the Inventory table row and Medicine Detail header, a "Requires Refrigeration only" filter (`GET /inventory?cold_chain_only=true`), and a bulk-update field. | No dedicated Reports/Analytics view for cold-chain stock — checked, genuinely not needed yet (nothing there currently depends on this field being wrong the way the low-stock definitions did); would be new scope, not a gap in what exists today. |
| As a pharmacist, I want to record a medicine's strength (e.g. 500mg) separately from its name. | ✅ **Fixed August 22, 2026** | `strength` in `ProductCreate`/`ProductUpdate`, Add/Edit Medicine forms, shown inline next to the name on the Inventory table and Medicine Detail header, and now searchable (see search row above). Also now a real Excel bulk-upload column (`utils/excel.py` — auto-detected keywords, template, sample data), alongside `dosage_form`, which was in the same position (a real optional `ProductCreate` field the bulk-upload path silently never mapped). | Bulk-upload still doesn't map every optional field that exists (e.g. `barcode`) — narrower gap than before, not fully closed. |

**B. Batch & Stock Tracking** — `backend/routers/batches.py`, `models/products.py::StockBatch`

| User story | Status | Fields / rules involved | Limitations |
|---|---|---|---|
| As a pharmacist, I want to manually add a stock batch (not via a purchase) — e.g. opening stock when first setting up. | ✅ `POST /stock/batches` | `product_sku`, `batch_no`, `expiry_date`, `qty_on_hand`, `cost_price_per_unit`, `mrp_per_unit`, plus optional `manufacture_date`, `supplier_name`, `supplier_invoice_no`, `received_date`, `location`, `free_qty_units`, `notes`. Rejects a duplicate batch number for the same product. Rejects an expiry date already in the past. Auto-records an `opening_stock` movement. | `supplier_name`/`supplier_invoice_no` here are **free-text strings**, not linked to the real `Supplier` table — inconsistent with the Purchases flow, which links a real `supplier_id`. Same real-world concept, two different representations depending on entry path. |
| As a pharmacist, I want to edit a batch's details (cost, MRP, expiry, quantity). | ✅ `PUT /stock/batches/{id}`, admin-only | Any field from create, partial update. Expiry can't be moved into the past. | **Fixed Aug 24, 2026** — a `qty_on_hand` change now records a `"batch_edit"` `StockMovement` row, same as every other quantity-mutating endpoint. `POST /stock-movements` also used to log a movement without ever applying it to the batch (the ledger and the real balance could silently diverge) — now actually applies the delta, with the same negative-stock guard `/adjust` uses. Neither path is reachable from any current frontend screen (grep-confirmed) — fixed to make each endpoint's own contract true, not exercised in the live app today. |
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
| As a pharmacist, I want a running "short book" / demand list that auto-fills with medicines at or below reorder level, so I know what to order without checking every product. | ✅ **Built Sep 12, 2026** | New `GET /inventory/reorder-list` (reuses `get_inventory_with_health`'s exact `stock<=reorder_level` comparison, not a new one) + `/inventory/reorder` page (3rd Inventory tab), sorted most-urgent-first. `reorder_quantity` (dead since the schema's creation — default 100, never read or written anywhere) is now a real, editable field (`reorder_quantity_units` on Create/Update), inline-editable on the new page alongside `reorder_level` itself. ACL-gated the same as any other product edit (`inventory:edit`). 8 pytest tests (membership boundaries, editability, global sort-order invariant); live-verified as both a blocked cashier (403, real reason) and an admin (edit persists, list re-sorts). | No purchase-order integration yet (deliberately — see Limitations). |
| As a pharmacist, I want tiered expiry warnings (e.g. 90/60/30 days out), not just one single "near expiry" cutoff. | ❌ **Not built** | Marg broadcasts alerts at 30/60/90 days automatically. PharmaCare has exactly one configurable `near_expiry_threshold_days` value — a batch is either "near expiry" or it isn't, no escalating urgency. | — |
| As a pharmacist, I want to return near-expiry or expired stock to the supplier for a credit note, before it becomes a total write-off. | 🔄 **Possible but not discoverable where it matters** | `PurchaseReturn` exists and could carry this, but it's always initiated from a specific past Purchase (`GET /purchases/{id}/items-for-return`) — there is no "return this batch" action from the Inventory health screen or the near-expiry alert itself. | A pharmacist looking at a near-expiry batch on the Inventory page has no path from there to returning it — they'd have to know and find the original purchase order first. |
| As a pharmacist receiving a distributor's invoice, I want to import that purchase bill directly from Excel/CSV/email instead of retyping every line into a new Purchase. | ❌ **Not built** | Pharmasoft supports one-click purchase-bill import from Excel/CSV/email. PharmaCare's only Excel import is the product-catalog bulk-upload (section A) — it does not create a `Purchase` record from a supplier's invoice file. | Distinct feature from catalog bulk-upload — don't conflate the two when scoping this. |
| As a pharmacist, I want to compare prices for the same medicine across my suppliers before ordering. | ❌ **Not built** | Not present in PharmaCare in any form — no per-supplier price history view. | — |
| As a pharmacist, I want to see which supplier I usually buy a medicine from right on its detail page, so I know who to reorder from without digging through Purchases. | ❌ **Not built** | Flagged in the Aug 23, 2026 Medicine Detail audit. `Product` has no `default_supplier_id`; `Supplier` model exists and is used in Purchases, but nothing links a product to a preferred/last supplier. | Would need a new FK column + a way to set it (auto-infer from most recent Purchase, or an explicit field on Add/Edit Medicine) — a real design decision, not a one-line fix. |
| As a pharmacist, I want to see substitute brands with the same salt/composition, so I can offer an alternative when a specific brand is out of stock. | ❌ **Not built** | Flagged in the Aug 23, 2026 Medicine Detail audit. Marg ERP ships salt-based substitute lookup as a core feature (5 lakh+ medicine database, searchable by salt). PharmaCare has `generic_name` per product but no cross-product lookup by matching generic_name/composition. | Would need a query grouping products by `generic_name` within the pharmacy's own catalog at minimum; a real "substitute" feature (different brand, same salt, from a wider database) is a bigger scope than that. |
| As a pharmacist, I want to attach a photo to a medicine so staff can visually confirm they've picked the right pack. | ❌ **Not built** | Flagged in the Aug 23, 2026 Medicine Detail audit. `product.image_url` is already read in `MedicineDetailHeader.jsx` (falls back to a package icon) and in Add Medicine's preview circle, but there is no upload endpoint or UI control anywhere that ever sets it — a dead field on the read side only. | Needs real file upload/storage (not yet decided where — S3-equivalent, or local disk) before the existing `image_url` display code becomes useful. |

**G. Live-verified findings** — found by actually running the app (backend + frontend, real login, real product created), not by reading code. This is exactly why "run it" is a different check than "read it": a bug can look correct in the source and still be wrong at runtime.

| Finding | Severity | Detail |
|---|---|---|
| `GET /reports/dashboard` — the Dashboard's main stat cards — was **completely broken, silently, for every pharmacy, all the time** | ✅ **Fixed August 22, 2026** | Every field it returned (`today_sales`, `total_sales`, `total_medicines`, `low_stock_count`, `expiring_soon_count`, `total_stock_value`) was hardcoded to `0` because the endpoint threw on *every* call. Root cause in the `uvicorn` log: `Dashboard stats error: Function.__init__() got an unexpected keyword argument 'else_'` — the code called `func.case((...), else_=0)`, but `func.case` (the generic SQL-function proxy) doesn't accept `else_`; that's only valid on SQLAlchemy's real `case()` construct. A broad `except Exception` swallowed this and returned an all-zero dict instead of erroring. Fixed by importing and using the real `case()` (3 call sites in this function). Verified live: created a real product+batch, endpoint now returns `total_medicines: 1`, `total_stock_value: 60.0` matching it exactly. Regression test added: `test_dashboard_analytics.py::TestReportsDashboardAndAnalyticsSummary::test_reports_dashboard_reflects_real_stock` — proven to fail against the pre-fix code, passes against the fix. |
| `GET /analytics/summary` had the **exact same bug** | ✅ **Fixed August 22, 2026** | Same `func.case(..., else_=...)` misuse (3 more call sites), same silent-zero fallback. Fixed the same way. Verified live: created a real ₹80 paid bill, endpoint now returns `gross_sales: 80.0` correctly. Regression test added: `test_analytics_summary_reflects_real_sale` — same fail-then-pass verification. |
| `GET /analytics/dashboard` (the *other* dashboard endpoint) does **not** have this bug | ✅ confirmed | Live-tested: correctly returned the test product in its `low_stock` list. This is the one this doc's earlier passes had verified correctly — that verification holds. |
| All 6 `func.case(..., else_=...)` call sites in the codebase — searched exhaustively via grep, not guessed | ✅ **All fixed** | All 6 live inside `get_dashboard_stats` and `get_analytics_summary` in `backend/routers/reports.py` — no other router uses this pattern. Correction to this doc's own earlier entry: it had guessed one might be in `get_expiry_report` — traced precisely this pass and that guess was wrong; `get_expiry_report` and `get_low_stock_report` never used `func.case` at all, which is exactly why they tested clean live earlier. |
| A **fourth** low-stock definition exists: `GET /reports/low-stock` | ⚠️ New | Not in this doc's earlier 3-definitions writeup. Uses per-product `reorder_level` (agrees with `/inventory`, at least) — but it's still a separate, independent implementation, not a shared one. |
| Search bar placeholder promises more than the backend delivers | ✅ **Fixed August 22, 2026** | Inventory search box reads "Search medicine by name, generic, strength…" — `GET /products?search=` and `GET /inventory?search=` now actually match `generic_name` and `strength` too, live-verified: a product findable only by its strength text (not present anywhere in its name) now shows up in real UI search results. |
| Two Radix `DialogContent` accessibility warnings | ✅ | Fixed Sep 7, 2026 — re-checked live first per Rule 14 rather than trusting this note: Add Medicine already had a real `DialogTitle`, only `ExcelBulkUploadWizard` was missing one. Fixed by wrapping its existing visible `<h2>` in `DialogTitle asChild` (keeps the exact same visual header, adds the real ARIA semantics). Live-verified: the "Missing DialogTitle" console warning is gone; the dialog's accessible name now reads "Excel Bulk Upload". |
| 28 `DialogContent` usages missing a `Description`/`aria-describedby` | Low | Found live Sep 7, 2026 while fixing the DialogTitle warning above — a separate Radix a11y warning ("Missing `Description` or `aria-describedby`"), same root cause class (no automated check for it). Not fixed here: a real fix needs a short, meaningful description written per dialog, not generic filler text across 28 files — real scope, do with Abinash's input on priority. |
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
| Medicine Detail page audit (Aug 23, 2026, requested as a PM-style review + competitor research) found 3 real issues | ✅ All 3 fixed same day | **(1) Dead Bell/Clock icons** in `MedicineDetailHeader.jsx` — neither had an `onClick`, pure dead UI. **Fixed**: removed. **(2) Batches table's "Prev. MRP" and "PTR" columns were fabricated** — `Prev. MRP = mrp × 1.05` and `PTR = costPrice × 1.1`, hardcoded formulas with zero backing data (no price-history table exists anywhere). Worse than merely missing: styled identically to the real columns (₹, right-aligned), so they read as real business figures a pharmacist could price off. Confirmed `PTR` is actually the same value as the already-real `LP` column under a different name (`PurchaseNew`'s `ptr_per_unit` is stored directly as `cost_price_paise` — the same column `LP` already shows), so removing it loses no real distinct data. **Fixed**: both fabricated columns removed; the table's 7 remaining columns (Batch ID, Qty., Exp. Date, MRP, Disc. %, LP, Margin%) are all real, non-fabricated data. **(3) The header's MRP stat card always showed ₹0** — read `product.default_mrp_per_unit`, a field that has never existed on any product API response (MRP is per-batch, not per-product; researched how pharmacy software elsewhere handles this — MRP is batch-level everywhere, no product-master screen tries to force a single number). First fix picked the FEFO batch's MRP alone, but the product owner pushed back: silently picking one batch when others in stock disagree on price hides that a difference exists at all. **Fixed properly**: shows a single value (`₹100.00`) when all batches in stock agree, or a range (`₹100.00–150.00`) when they don't, with a hover-only info icon (Radix `Tooltip`, not always visible — confirmed on request) explaining why and pointing at the Batches tab for the exact per-batch breakdown. Shows "–", never a fake ₹0, when there's no batch in stock. The range string is long enough to truncate at the card's original font size, so `StatCard` drops to a smaller size once a value passes 10 characters. Live-verified all cases: single batch → `₹100.00`, no icon; two batches at different MRPs → `₹100.00–150.00` with a visible, un-truncated icon whose tooltip only appears on hover (confirmed empty/absent before hover, present after); zero batches → "–". **Storage Location display** — fixed August 23, 2026: a pin icon + the location text now shows next to manufacturer/pack-info on this page, only when set (see the updated row in §A above). Also flagged, not yet fixed: product name's inline `style={{fontFamily:'Manrope'}}` (only 2 files in the app do this instead of a design-system class). Supplier link, substitute/salt lookup, and image upload — real feature gaps, not bugs — moved to §F Competitor-validated gaps as their own tracked rows for later, at the user's request. |

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

**Full acceptance spec (Aug 25, 2026)**: `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`
— all 73 use cases from Abinash's spec mapped against real code, every row
evidenced. Supersedes the summary table below for anything more than a
quick status check. Headline: 5 live bugs found (not just gaps) —
overpayment isn't rejected and corrupts the payment ledger; a blank-batch
double-submit can create duplicate stock; the GST report page is broken
(field-name mismatch, throws on render); the Purchases list's Cash/Credit/
Due filter pills send params the backend ignores; stock-adjust has zero
permission check. See that doc's Executive Summary for the full ranked list
and the recommended build-batch order.

**Build progress against that spec:**
- ✅ Fixed a live, wide-reaching bug found resuming this session's live
  testing (Sep 7, 2026): **every `PurchaseDetail`, `PurchaseReturnCreate`,
  `PurchaseReturnDetail`, `SalesReturnCreate`, `SalesReturnDetail`, and
  `ExcelBulkUploadWizard` API call 404'd** whenever `REACT_APP_BACKEND_URL`
  is unset — which is the documented normal local setup since the Aug 20
  craco-proxy change (see this file's PROJECT SNAPSHOT). Root cause: these
  7 files each kept their own local `API` constant (falling back to `/api`
  when the env var is unset) left over from before the shared `api` axios
  instance existed (`lib/axios.js`, whose own `baseURL` is already `/api`)
  — combining both doubled every URL to `/api/api/...`. First reproduced
  live by navigating straight to
  Purchase Detail: a "Failed to load purchase" toast, network tab showing
  `GET /api/api/purchases/...`. Fixed by dropping the dead `const API` and
  the `${API}` prefix from all 20 call sites across the 7 files — `api`'s
  own baseURL already supplies `/api`. Live-verified both `PurchaseDetail`
  and `PurchaseReturnCreate` load correctly post-fix. `npx tsc --noEmit`
  clean, no jest tests existed for these files to break. See RULE MISSES
  LOG below for why this sat live-broken since Aug 20 undetected.
- ✅ UC-P02 (add a new distributor inline during purchase entry) — Aug 25,
  2026. `SupplierFormModal` moved from `pages/Suppliers/components/` to
  `components/shared/` (now used by both Suppliers and Purchases — was
  previously owned by one page). Full detail + a real bug caught during
  the build in `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`'s UC-P02 entry.
- ✅ UC-P10/UC-P11 (add medicine by search or barcode) — Aug 26, 2026.
  Search moved off a 500-product client-side name/SKU filter onto the
  already-existing `GET /products?search=` (matches brand/manufacturer/
  generic/strength server-side, previously unused by this page). Barcode
  scan reuses Billing's exact `BarcodeScannerModal`/USB-scanner hook —
  same component, one behavior change: never rejects a zero-stock match,
  since a purchase is how stock gets added in the first place. Full detail
  in `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`'s UC-P10/UC-P11 entries.
- ✅ UC-P12 (add a new medicine inline during purchase entry) — Aug 26,
  2026. Same shape as UC-P02: a "no results" search state now offers
  "+ Add '<name>' as new medicine", opening the real Add Medicine form
  (`AddMedicineModal` moved from `pages/InventorySearch/components/` to
  `components/shared/`, now used by both pages — same precedent as
  `SupplierFormModal`) prefilled with the typed name; the created product
  is added straight to the purchase's line items. Unlike UC-P02's
  simplified inline form, this reuses the full standalone form as-is —
  a medicine carries real compliance data (Schedule, HSN, GST) a supplier
  record doesn't. Root-caused and fixed a real regression while building
  this: adding `AddMedicineModal` (which calls `@/lib/axios` directly) to
  the `components/shared` barrel made every test importing anything from
  that barrel transitively load the real, unmocked `axios` package, which
  jest couldn't parse (ESM-only entry point) — two previously-green test
  suites broke. Fixed at the root by adding `axios` to jest's
  `transformIgnorePatterns` exception list (`package.json`) instead of
  mocking `@/lib/axios` in every affected file — the same class of fix
  already applied to `zod`/`@hookform`/`react-router` for the same reason.
  Full detail in `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`'s UC-P12 entry.

| Feature | Status | Notes |
|---------|--------|-------|
| Create purchase (draft) | ✅ | |
| Confirm purchase (stock in) | ✅ | Creates batches, stock movements |
| Purchase number (PUR-YYYYMMDD-XXXX) | ✅ | |
| Purchase return | ✅ | Stock deducted, GRN reversed |
| Supplier management (CRUD) | ✅ | |
| Link purchase to supplier | ✅ | |
| Purchase history per supplier | ✅ | |

**Purchases — August 24, 2026 audit fixes.** User directive: fix every gap
from the rigorous Purchases/Inventory audit one at a time, except
IGST/intra-inter-state (deferred — single-state sale only for now).
- Invoice breakdown modal (Total Discount, CESS, Adjusted CN, TCS, Extra
  Charges, Adjustment Amount) was decorative — none of it reached the
  backend; grand total silently discarded whatever the pharmacist
  confirmed on screen. Fixed: 6 new `Purchase` columns, backend now
  applies the exact formula the frontend already showed.
- `order_type`/`with_gst`/`purchase_on` were accepted by the API but
  `Purchase` had no columns for them — editing a draft silently reset
  all three to defaults every time. Fixed: 3 new columns, persisted on
  create/update, returned in the response.
- `usePurchaseItems.js` read `product.default_mrp_per_unit` /
  `default_ptr_per_unit` / `landing_price_per_unit` — none exist on
  `GET /api/products`. New lines always defaulted MRP/PTR to 0 via dead
  reads; the product-search dropdown showed literal "MRP ₹undefined".
  Fixed: dead reads removed (defaults unchanged, still 0), dropdown now
  shows real `gst_percent` instead.
- Edit button/menu item was offered on confirmed purchases even though
  `update_purchase` has always rejected non-draft edits (400) — a
  guaranteed dead-end click. Fixed: hidden in the list unless the row is
  a draft; removed entirely from `PurchaseDetail` (which only ever
  renders for non-draft purchases, so its own Edit entry was 100% dead).
- List had no Paid/Balance columns despite the backend already
  returning both; no working supplier filter despite `supplier_id`
  already being a real, working query param; the search box's own
  placeholder promised supplier-name search but the backend never
  matched supplier name. Fixed: added the 2 columns, wired a supplier
  filter dropdown, added a pharmacy-scoped supplier-name subquery to
  search.
- MRP=0/negative was confirmable — nothing validated it client or
  server side, despite it being required for `mrp_paise`. Fixed: guard
  in `_create_stock_for_items` (confirm-time only, drafts still
  allowed to save with it blank) plus matching frontend validation.
- Two independently-built Purchase payment modals consolidated into
  one (`PurchaseDetail/components/PurchasePayModal.jsx`, imported by
  both List and Detail) — union of both originals' fields (Amount,
  Method, Date, Reference #, Notes), payment methods centralized in
  `PURCHASE_PAYMENT_METHOD` (`domainConstants.js`).
- `payment_date` picked in the modal was silently discarded — the
  column existed since the initial schema migration but the router
  never read or forwarded it. Fixed: persisted, surfaced as
  `last_payment_date` on the purchase detail response, displayed in
  PurchaseDetail ("Paid on `<date>`" / "Last paid on `<date>`").
- `purchase_returns.py` had zero audit logging (create immediately
  confirms + deducts stock; financial edits mutate stock further) —
  fixed, mirrors `purchases.py`'s existing `_record_audit` pattern.
- The permission system (roles, per-module view/create/edit rules,
  `has_permission()`) existed since the app's seed data but was wired
  into zero endpoints anywhere in the app — not Purchases-specific,
  app-wide. Scoped fix, discussed with Abinash first: enforced on
  every Purchases/Purchase-Returns **write** endpoint only (GET/list/
  detail left ungated); every other module remains unenforced for now
  — a deliberate, known inconsistency, not a decided final state.
- Dead `POST /purchase-returns/{id}/confirm` removed — unreachable,
  `create_purchase_return` already sets `status="confirmed"` and
  deducts stock in the same request. Removing it surfaced a real bug
  it was masking: `_generate_debit_number` was only ever called from
  that dead handler, so `debit_note_number` was always null on every
  real return despite the field existing and being returned in every
  response. Fixed: number generation moved into `create_purchase_return`
  itself, alongside `return_number`.
- Duplicate-invoice-number warning: `GET /purchases/check-duplicate-invoice`
  (case-insensitive, scoped to distributor, excludes the purchase being
  edited) — advisory only, never blocks save, per the literal word
  "warning" in the request.
- Invoice attachment upload: `Purchase.invoice_attachment_data`/`_name`,
  base64 `data:` URL client-side (same pattern as `LogoUpload.tsx` — no
  S3/upload infra exists or was justified for one file per purchase).
  Backend validates data-URL shape, mime type (jpeg/png/webp/pdf), and
  5MB decoded size cap. Excluded from the list response, included in
  detail — same reasoning as `last_payment_date`.
- Purchase Returns had zero happy-path module coverage — every existing
  test was a narrow single-bug regression test. Added a
  create→list→detail→edit walkthrough suite (list + its 3 filters,
  items-for-return before/after a return, both edit types verified via
  a follow-up GET, not just response status).
- Explicitly deferred, not forgotten — raised and the user chose not
  to act now: **Tally sync** (skip for now); **LIFA/LILA batch
  priority** (existing UI dead — leave as-is, not removed, not wired
  up).
- Still queued from the same audit (excluding IGST/intra-inter-state):
  cancellation/reversal for confirmed purchases, Card/Other payment
  methods, frontend float math on money, locked read-only view for
  confirmed-purchase edit attempts, narrower product search (name+SKU
  only), last-purchased-price hint, stock ledger schema gaps, remaining
  `Purchase`/`PurchaseItem`/`Supplier` schema gaps, app-wide permission
  rollout beyond Purchases/Purchase Returns.

**Purchases + Purchase Returns — Aug 25, 2026 design-system audit.** Full
pass against `docs/05_DESIGN_SYSTEM.md`/`docs/06_COMPONENTS.md`, two
rounds (first pass missed files invisible in a stale local checkout;
caught and re-audited once the checkout was corrected — see chat, not
worth a full writeup here). All findings fixed:
- Raw `<button>` tags (PurchaseHeader, PurchaseSettingsModal,
  SupplierDropdown) → AppButton; Material Symbols icon → Lucide.
- Hand-rolled status pills → `StatusBadge` (PurchaseReturnDetail's was
  hardcoded literal text `"CONFIRMED"`, not reading real status — fixed).
- ~25 raw `.toFixed(2)` money renders (missing Indian digit grouping) →
  shared `formatCurrency`, across nearly every Purchases/Returns file.
- Wrong typography tokens (`font-bold`/`text-[10px]` table headers,
  `tracking-wide` typo, invented form-label style) → the documented
  tokens.
- `AppButton` `className` color/padding overrides → removed; the
  Bill Date/Due Date buttons needed a real fix, not just removal — see
  the new `chip` variant below.
- `bg-gray-50` → `bg-page` token; plain-text empty states → `EmptyState`.
- Purchase Returns list's table density aligned with the Purchases list
  (same tab bar, was visibly different).
- New: `AppButton` `variant="chip"` (+ `tone="neutral"|"warning"`) — an
  inline, borderless, paddingless trigger for "here's a value, click it
  to change it" (a date under a `DATE` label). Documented in
  `docs/05_DESIGN_SYSTEM.md`/`docs/06_COMPONENTS.md`. `FilterPills` also
  gained an opt-in `activeColor` per option, used to migrate
  PurchaseSettingsModal's 9 raw-button toggles and the payment-method
  selector in the consolidated `PurchasePayModal`.
- Not fixed, out of scope: `scripts/design-guard.sh` Rule 7's
  `"top-full mt-1"` literal-string check is trivially evaded by
  reordering classes (confirmed on 3 files this session) — hardening it
  would newly surface pre-existing BillingWorkspace violations outside
  this audit's scope.

**Purchases — competitor-validated gaps** — per Manifesto rule 15, checked against Marg ERP, eVitalRx, and Pharmasoft. Verified against real code (`backend/routers/purchases.py` — every endpoint grepped and listed: list/create/update/get/pay, no others exist), not guessed.

| User story | Status | Detail |
|---|---|---|
| As a pharmacist receiving a distributor's invoice, I want to import that bill directly from a CSV/Excel file the distributor sends, instead of typing every line item by hand. | ❌ **Not built** | Already flagged once under Inventory §F (don't duplicate the fix there) — restating here because it's really a Purchases-flow gap: `purchases.py` has no upload/parse/import endpoints, only manual `PurchaseCreate` entry. Pharmasoft ships one-click CSV/Excel/email invoice import as a named feature. |
| As a pharmacist, I want a running auto-generated purchase list ("digital shortbook") built from products at or below reorder level, that I can turn directly into a purchase order. | ❌ **Not built** | Same root gap as the Inventory §F "short book" entry — `reorder_level`/`reorder_quantity` exist on `Product` but nothing in `purchases.py` reads them to seed a draft purchase. eVitalRx's flagship ordering feature; here it would also finally make the currently-dead `reorder_quantity` column do something. |
| As a pharmacist, I want to compare a medicine's price across my different suppliers before creating a purchase order. | ❌ **Not built** | No per-supplier price history endpoint or view — confirmed via the full endpoint list above. |
| As a pharmacist, I want automatic highlighting when a purchase order line item is for a product that's already expired or near-expiry in my catalog, so I don't reorder something with a stock problem by accident. | ❌ **Not built** | `create_purchase`/`update_purchase` in `purchases.py` do not cross-check `Product`/`StockBatch` expiry state at all — a standard Indian-pharmacy-software convention (auto-flagging near-expiry/expired items in PO review), absent here. |
| As a pharmacist, I want my confirmed purchases to sync to Tally for accounting. | ❌ **Not built** | Same `tally` grep as Billing above — zero hits repo-wide, applies equally to the purchase side. |
| As a pharmacist entering a distributor's bill for the first time, I want to add a new distributor or a new medicine right there in New Purchase if it isn't in my system yet, instead of being blocked until I go add it in Suppliers/Inventory first. | ✅ **Built** — corrected Sep 12, 2026, was stale | This line said "Not built" since Aug 25, 2026, but the actual code already has it: `SupplierDropdown.jsx`'s `allowCreate` prop (`PurchaseSubbar.jsx` passes it) shows "+ Add '<search>' as new distributor" and opens `SupplierFormModal` inline; `PurchaseItemsTable.jsx` shows "+ Add '<search>' as new medicine" and opens `AddMedicineModal` inline — both select the new record immediately, no page leave, both covered by existing jest tests. Caught only because a later session (Sep 12, ACL work) checked the real code instead of trusting this doc — see Manifesto rule 14. What genuinely WAS missing until Sep 12: any permission check on either create path — see the RULE MISSES LOG entry same date. |

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

## AUTH OVERHAUL

> #6 and #8 moved into Phase 1 (V1 launch scope, confirmed Aug 23, 2026) —
> they don't strictly need the full DB-backed-sessions rework #7 does; a
> simple reset-token table is enough on top of today's stateless JWT.
> #7 (session management) stays `📋 Planned` for V2.

### 6. Forgot password / reset flow — `📋 Planned` — V1

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

### 8. Admin reset password for other users — `📋 Planned` — V1

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
| Sep 12, 2026 | `docs/14_SECURITY.md`'s multi-tenancy expectation — same class as the Sep 12 fix above, found again in a query shape the automated check doesn't cover | - Found while starting the Reports & Compliance use-case research (Audit Log is part of that module): `get_entity_audit_trail` (`GET /audit-logs/entity/{entity_type}/{entity_id}`, `routers/billing.py`) had **zero** `pharmacy_id` filter — proved live, pharmacy B pulled pharmacy A's real audit trail for A's bill (customer name, totals, old/new values) by knowing the id. <br>- Tooling gap: `scripts/check_tenant_isolation.py` (built earlier the same day for the by-id-lookup class) only flags a bare `Model.id ==` — this endpoint filters on `entity_id`, a different attribute name, and it's a *list* query (can return many rows) rather than a single-row `get_owned_or_404` lookup, so neither the checker's pattern nor the helper's shape caught it. Confirms the earlier fix pass closed the *by-id-lookup* class specifically, not "every unscoped query" — a narrower win than it looked like at the time. | - Added `AuditLog.pharmacy_id == pharmacy_id` to the query. <br>- Added `TestAuditLogIsolation` (2 tests) to `backend/tests/test_multi_tenancy_isolation.py` — confirmed it fails pre-fix (real cross-tenant data returned) and passes post-fix. <br>- No new automated gate added for this broader "any list query missing pharmacy_id" class yet — it's a strictly harder static check than the by-id case (would need to reason about every `select(Model).where(...)` in every router, not just ones containing `.id ==`, with a much higher false-positive risk against legitimate non-tenant-scoped tables). Flagged here rather than silently left as a known gap; a full audit of every `select(...)` in `backend/routers/*.py` for a missing `pharmacy_id` filter is real follow-up work, not done in this pass. |
| Sep 12, 2026 | CLAUDE.md's "HOW TO BUILD" mandatory order (read the real backend router before writing frontend) + Manifesto rule 9 (no unverified routes/fields) — `GSTReport.js` | - Found during a `product-review` audit of the Reports module: every top-level field `GSTReport.js` reads (`sales_gst.breakup`, `purchase_gst.breakup`, `net_gst_liability`) does not exist anywhere on what `GET /reports/gst` actually returns (`sales`, `purchases`, `sales_summary`, `purchases_summary`, `net_liability`) — confirmed live, a genuinely fresh pharmacy's first real bill crashed the page with a full React error boundary the instant "Generate Report" was clicked. Already flagged as a known bug in `docs/23_PURCHASES_ACCEPTANCE_SPEC.md` from an earlier pass, but never fixed or logged with a root cause here. <br>- Execution gap, not (only) tooling: this is exactly the class step 1-2 of "HOW TO BUILD" exist to prevent (read the DB model/backend router before writing the frontend) — whoever wrote `GSTReport.js` was working against a response shape that was never real, or the backend was reshaped later without the frontend being updated; either way nobody re-verified the fields before shipping. Zero test coverage on this endpoint or component the whole time it's existed. <br>- Same audit also found a second, independent bug in the same endpoint: the sales-side GST query filters `BillORM.status == "paid"` only (`reports.py:292`), silently excluding every confirmed-but-unpaid credit sale from output tax — every sibling endpoint in the same file correctly includes `status IN ("paid","due")`. And a third: 10 of `reports.py`'s 12 endpoints (including GST) have no permission gate at all — live-confirmed a plain cashier account can pull the full GST report. | - Full findings, evidence, and a recommended fix-order batched by severity are written up in the new `docs/24_REPORTS_ACCEPTANCE_SPEC.md` (same template as the Purchases spec) — not yet fixed, this entry is the research/find, not the fix. <br>- No new automated gate proposed for the field-mismatch class specifically — same reasoning as the Aug 23 Batches tab entry below: a lint rule can't verify a frontend field maps to a real backend response shape without a contract/schema layer neither side has today. The real fix is the "HOW TO BUILD" habit itself (already written) plus `pharmacare-testing`'s requirement that a feature ship with a test proving the real response shape — closing that gap here means adding a real test for `GET /reports/gst` and `GSTReport.js` as part of the actual fix, not just documenting the miss. <br>- `docs/01_PRODUCT.md`'s Phase-1-built table and competitive-landscape section corrected in the same change (previously claimed Reports/GST Report were both ✅ built and HSN-wise — neither is true). |
| Sep 12, 2026 | `docs/14_SECURITY.md`'s multi-tenancy expectation (every pharmacy's data is isolated from every other pharmacy's) — no written CLAUDE.md rule ever spelled this out as a per-endpoint requirement, and nothing enforced it | - Found while auditing `docs/13_DEPLOYMENT.md` PRE-LAUNCH BLOCKERS item #2 ("multi-tenancy isolation needs a full audit") ahead of V1 readiness. <br>- Grepped every router for `select(Model).where(Model.id ==` and found almost none also checked `pharmacy_id` — proved live, not just by pattern match: registered two genuinely separate pharmacies via the real `/api/auth/register` flow, then used pharmacy B's own session to `GET`/`PUT /suppliers/{id}` against pharmacy A's real supplier id — got a 200 back both times, full data returned, and the tampered value persisted (confirmed by A's own session afterward). <br>- Root cause of scale: this exact class had already been found and fixed once before, on the bill-PDF endpoint (`generate_bill_pdf`) — its own comment said so — but the fix was never generalized into a shared helper or a check, so the same bug independently reappeared in ~25 sibling endpoints across `suppliers.py`, `customers.py`, `inventory.py`, `batches.py`, `billing.py`, `purchases.py`, `purchase_returns.py`, `sales_returns.py`, `users.py`, and `settings.py` — get/update/delete-by-path-id endpoints, and several places that trusted a caller-supplied id from a request body (a bill's `customer_id`/`doctor_id`, a purchase's `supplier_id`, a return's `batch_id`) without checking it belonged to the caller's own pharmacy. <br>- This is a tooling gap, not a one-off execution slip: nothing short of a human independently re-reading every router would have caught the ~25 recurrences, and that's exactly the kind of check a human reliably stops doing after the first few files. | - Added `get_owned_or_404()` (`routers/auth_helpers.py`) — the one sanctioned way to fetch a pharmacy-owned row by id anywhere in this codebase; always scopes by `pharmacy_id`, always returns 404 (never 403) for a row that exists but belongs to someone else, so a caller can't use the response to enumerate valid ids in other tenants. <br>- Replaced every unscoped by-id lookup found across the 10 router files with it (or added `pharmacy_id` directly to the same query where the helper's shape didn't fit, e.g. `_resolve_batch`'s FEFO lookup). Lookups that were already safe because their id came from an already-scoped parent row (e.g. `batch.product_id` after `_get_batch`) are left as direct queries with a `# tenant-safe: <reason>` comment explaining why, so the new check below doesn't have to guess. <br>- **Gate closed, automated first**: `scripts/check_tenant_isolation.py` (new) statically scans every `backend/routers/*.py` file for a `select(Model).where(...)` containing a bare `Model.id ==` with no `pharmacy_id` in the same statement and no `# tenant-safe:` comment — wired in as `design-guard.sh` Rule 13 (CI) and a matching pre-commit check gated on staged files under `backend/routers/`. <br>- **Gate closed, regression test**: `backend/tests/test_multi_tenancy_isolation.py` (new, 46 tests) — registers two real, independent pharmacies via the actual signup flow (no shared fixtures) and asserts pharmacy B gets a 404, never data, from every by-id GET/PUT/DELETE/POST-action endpoint across suppliers, customers, doctors, products, batches, purchases, purchase returns, sales returns, bills, users, and roles, plus that a caller-supplied foreign id (customer/doctor/supplier/batch/bill) from another tenant is rejected rather than silently accepted. Confirmed the suite actually catches the regression, not just passes: reverted `suppliers.py`'s fix via `git stash` and reran — 3 of the 3 supplier tests failed with real 200s and real data back, exactly reproducing the original live exploit; restored the fix, all 46 pass again. Full 358-test backend suite passes unaffected (1 unrelated pre-existing flake — `test_purchase_mrp_must_be_positive.py`'s `search-with-batches` assertion, caused by 60+ accumulated same-named test products tripping that endpoint's 50-row limit on the shared dev DB, not a security-fix regression). <br>- `docs/13_DEPLOYMENT.md` PRE-LAUNCH BLOCKERS item #2 updated to reflect the audit + fix. |
| Sep 12, 2026 | No written rule required ACL on Suppliers/Products creation, but the real permissions system (roles table, `has_permission()`, `ALL_PERMISSIONS` catalog) already existed — it was just never wired in for these two modules. Also Manifesto rule 9 ("no magic strings") — `update_product`/`delete_product` used a hardcoded `role != "admin"` string check instead of the real catalog. | - Found while building ACL for Purchases' already-existing inline "+ Add new distributor/medicine" feature (see corrected Purchases row above): `routers/suppliers.py`'s create/update/delete and `routers/inventory.py`'s create_product had ZERO permission check — any logged-in role, cashier included, could create or edit a distributor or medicine. <br>- `update_product`/`delete_product` had a permission check, but a hardcoded `if current_user.role != "admin"` — bypassing the real catalog entirely and blocking manager/inventory_staff even though `constants.py` already granted them `inventory:edit`. <br>- Separately found: `constants.py`'s `DEFAULT_ROLES` (used by every real pharmacy signup, `services/provisioning.py`) was missing `purchases:edit` for manager — the exact bug `test_purchase_permissions.py::test_manager_can_create_and_edit_purchase` was already failing on, caused by `seed_admin.py` keeping its own separate, drifted copy of role permissions instead of importing the one real source. | - Added `_require_suppliers_permission`/`_require_inventory_permission` helpers (same pattern as `purchases.py`'s existing one) to `suppliers.py` (create/edit/deactivate) and `inventory.py` (create/edit/delete, replacing the hardcoded admin-only checks). <br>- `constants.py`: added `purchases:edit` to manager; added `suppliers:view/create/edit/deactivate` to manager and `suppliers:view/create` to inventory_staff (needed now that enforcement exists for the first time — without this, enabling the check would have locked out roles that should keep access). <br>- `seed_admin.py` now imports `DEFAULT_ROLES` from `constants.py` instead of keeping its own duplicate dict — single source of truth, so this class of drift can't recur. <br>- Migration `25ea9247b0c3` syncs the new permissions into already-seeded `roles` rows (editing the Python constant alone doesn't touch rows already in Postgres). <br>- Added `test_suppliers_inventory_permissions.py` (11 tests: cashier blocked, inventory_staff/manager allowed per catalog, admin unaffected, delete still admin-only) — confirmed all 5 that should fail against pre-fix code do fail via `git stash`, pass after. `test_purchase_permissions.py`'s previously-failing manager test now passes too, as a side effect of the same constants.py fix. Live-verified: a real cashier account got "Your role does not have permission to create suppliers"/"...create products" toasts with the modal staying open, no data lost, confirmed via the network tab (403, real `detail` message) — not a hypothetical, a real logged-in session. |
| Sep 11, 2026 | Manifesto rule 10 ("every error notification must say why" — same principle applies to a total that silently doesn't reconcile) + rule 11 (cross-cutting) | - Same live walkthrough, found while checking Billing's Finalise modal after the stock fix above. `create_bill` rounds `grand_total_paise` to the nearest rupee (Indian retail convention) — matching Sales Return's own rounding — but `_bill_response` never exposed that delta, and the frontend's Finalise modal hardcoded `"Round off: ₹0.00"` while showing the raw, *unrounded* total as "Net Payable" — a figure that didn't match what `create_bill` actually charged (₹7.87 shown, ₹8.00 actually charged and stored). <br>- Not caught earlier because Sales Return's own Finalise modal (built correctly) was never used as the reference pattern when Billing's modal was written — the same rounding math existed on both, only one side displayed it honestly. <br>- Checking rule 11's cross-cutting angle surfaced the same gap one layer further: the saved Bill Detail page and printed receipt also had no "Round off" line, so the same silent non-reconciliation was visible post-sale too, not just at creation time. | - `useBillItems.js`: `grandTotal` is now rounded once at the source (`Math.round`), matching Sales Return's `netAmount` pattern — the same rounded figure now flows to the live footer, the Finalise modal, and print. <br>- `FinaliseModal.jsx`: "Round off" now shows the real delta (rounded total minus the raw pre-round total), not a hardcoded 0. <br>- `_bill_response()` (`backend/routers/billing.py`): added a derived `round_off` field (`grand_total_paise - (subtotal_paise + total_gst_paise - bill_discount_paise)`), same derivation `purchases.py`'s `_purchase_response` already uses. <br>- `BillTotals.jsx` (Bill Detail / print view): added a "Round off" row alongside Subtotal/GST/Total. <br>- Added `test_billing_round_off.py` (2 tests: a real fractional-paise sale reconciling exactly, and a whole-rupee sale correctly showing 0) — confirmed both fail against pre-fix code (`KeyError: round_off`) via `git stash`, pass after. Full 292-test backend suite passes (same 1 unrelated pre-existing failure). Live-verified: a real ₹7.87 raw total showed "Round off ₹0.13 / Net Payable ₹8.00" in the modal, saved as ₹8.00, and the Bill Detail page shows Subtotal ₹7.50 + GST ₹0.37 + Round off ₹0.13 = Total ₹8.00, fully reconciled. <br>- No automated gate proposed — a lint rule can't verify a displayed total matches what the backend will actually round to; the fix is the same "verify against the real backend response, don't trust a hardcoded 0" habit rule 14 already covers. |
| Sep 11, 2026 | Manifesto rule 14 ("no assumptions, verify every time") + rule 11 (cross-cutting changes ship as one) — `StockBatch.quantity_on_hand` (and 4 sibling `quantity_*` columns) stored whole PACKS while every sale/purchase/return/adjustment quantity is expressed in loose UNITS | - Continuing the same live walkthrough that found the MRP bug above: selling 2 tablets from a 10-tablet strip left stock completely unchanged. Root cause: every write site (`billing.py`, `sales_returns.py`, `purchase_returns.py`, `purchases.py`, `batches.py` ×4 spots) independently floor-divided `qty_units // units_per_pack` before storing — for any quantity smaller than one pack, that's 0. <br>- Not one bug, six: the identical pattern was independently reimplemented at 9 separate write sites across 5 files, plus a 6th latent inconsistency (the audit ledger's movement-quantity disagreeing with the batch's own stored field for manually-created batches) and a 7th (`reports.py` never applied the conversion at all, so stock-valuation reports were silently *understated* by a factor of `units_per_pack` the whole time). <br>- No test ever exercised a non-pack-multiple quantity through any of these paths — every existing purchase/adjustment test used either `units_per_pack=1` or an exact pack multiple, so floor-division never visibly lost anything. | - Proposed two options in plain language before building (per rule 13): store stock in real units everywhere (chosen) vs. keep packs + a remainder counter. Migration `a343c922f896` reinterprets all 5 `quantity_*` columns from packs to units (multiply by each batch's product's `units_per_pack`); `Product.reorder_level` deliberately left unchanged, since its own API field name (`low_stock_threshold_units`) was already units-based, so leaving it alone makes that comparison correct for the first time. <br>- Removed the pack↔unit conversion at all 9 write sites; `total_units`/`qty_on_hand` responses are now plain aliases, never multiplied. <br>- Rewrote/added regression tests exercising the exact previously-broken scenario (a non-pack-multiple quantity) across purchase confirm, purchase return, `/stock-movements`, free-qty, and a new `test_stock_units_loose_quantity.py` covering billing sale + `/adjust`; full 291-test backend suite passes (1 unrelated pre-existing failure, confirmed via `git stash` to fail identically without this change). <br>- Live-verified end-to-end: a real 1000-unit batch (units_per_pack=10) sold 3 loose units through the actual Billing UI → stock correctly dropped to 997 (would have stayed at 1000 pre-fix). Frontend (`MedicineDetail`'s header + Batches tab) updated to show real units as the primary figure with a packs-equivalent shown alongside, since packs are no longer the stored unit. <br>- No automated gate proposed for the class itself (a lint rule can't tell a legitimate unit conversion from a lossy one); the real fix is what rule 11 already asks for — checking every consumer of a touched domain, which is what surfaced all 9 sites instead of just the entry point (Billing) that was reported. |
| Sep 11, 2026 | Manifesto rule 14 ("no assumptions, verify every time") + Rule 12 (test what you build) — every medicine with `units_per_pack > 1` (i.e. almost every real tablet/capsule strip) sold in Billing for **MRP ÷ units_per_pack**, silently, on every sale | A live, from-zero walkthrough (Supplier → Customer → Inventory → Billing, requested directly, not a code read) created a real ₹2.50/tablet, 10-tablet-strip medicine and billed it — the app showed and charged ₹0.25. Root cause: `_batch_for_billing()` (`backend/routers/inventory.py`) divided `mrp_paise` by `units_per_pack` a second time — `mrp_paise` is already a per-unit price (confirmed against `batches.py`'s own batch endpoint, which returns it undivided). `create_bill` only rejects a submitted price that *exceeds* the real MRP, never one that's suspiciously low, so the wrong price wasn't just displayed — it was actually charged and stock was actually deducted, on both the typed-search and barcode-scan billing paths (both share the buggy helper). No test ever exercised a `units_per_pack > 1` product through the real billing-search response shape — every existing purchases/billing test either used `units_per_pack=1` or asserted against the create/edit response (`batches.py`), which was never bugged. | Removed the extra division (`mrp_per_unit` now equals `mrp`, both `b.mrp_paise / 100`, matching how `batches.py` already treats it) — `backend/routers/inventory.py`. Added `backend/tests/test_billing_price_unit_conversion.py` (3 tests: search-with-batches, barcode lookup, and a full create_bill charging the real MRP for real quantity) — confirmed each one fails against the pre-fix code (0.25/0.6 instead of 2.50/9.00) and passes after, via `git stash`. Live-verified in a real bill: MRP now shows/charges ₹2.50, not ₹0.25; GST and NET PAYABLE recompute correctly from it. Also found and fixed in the same walkthrough: the Inventory **list table's** Location column always showed "Default" regardless of what was set — reads `item.location`/`item.product.location`, neither of which `GET /inventory` returns; the real field is `item.product.storage_location` (Medicine Detail already read it correctly, so this was isolated to one table). Fixed in `InventoryTable.jsx`; live-verified the same product now shows "Rack B, Shelf 2" in the list. |
| Sep 8, 2026 | `docs/17_ACCESSIBILITY.md` (WCAG AA / keyboard access) — 9 real clickable-`<div>`/`<tr>`-without-keyboard-handler bugs shipped, plus 88 `<label>`s never linked to their input (`label-has-associated-control`) and 3 modal inputs using `autoFocus` with no accessibility review | A tooling gap, not an execution gap: `eslint-plugin-jsx-a11y@6.10.2` was an installed devDependency since the project's start but was never actually added to `eslint.config.js` — zero of its rules ever ran. `design-guard.sh` Rule 11 (added this same session, Sep 7, to try to catch the keyboard-access class) is grep/line-proximity based and produced ~30 false positives against the already-fixed codebase, so it had to ship as advisory/warn-only rather than a hard gate — a real AST-based tool was needed but sat unused the whole time. | Wired `jsx-a11y` into `eslint.config.js`'s `plugins`/`rules`, spreading its `recommended` rule set. Of the 108 new findings: the 88 `label-has-associated-control` + 3 `no-autofocus` are real, unaudited backlog — downgraded to `warn`, same precedent as the `react-hooks` rules in the same file (surface, don't block). 2 were false positives from the plugin's static-AST limits, not real bugs — `heading-has-content`/`anchor-has-content` fired on Shadcn/UI wrapper primitives (`alert.jsx`, `pagination.jsx`) that spread `{...props}` onto a native element, so real content (always supplied by the call site) is invisible to the check; disabled both rules for `src/components/ui/**`, where every primitive follows the same spread pattern. 2 more fired only inside a test file's mock markup (`interactive-supports-focus`); disabled for `src/**/*.test.*` since a test double isn't shipped UI. Raised the CI lint ceiling `ci.yml` → `--max-warnings 175` (was 68) to match the real, now-visible count — see `docs/11_TESTING.md` CI STATUS. Gate closed: this class of bug can no longer ship silently — a new violation shows up as a real `npx eslint` warning on every PR, not something that depends on someone remembering to check. |
| Sep 7, 2026 | Manifesto rule #9 (no magic strings/unverified data — `formatCurrency` exists precisely to be the one place money is formatted) — 62 raw `.toFixed(2)` money renders across 16 files, missing Indian digit grouping | A tooling gap: nothing lints for a raw `.toFixed(2)` next to a `₹` literal versus the shared `formatCurrency` helper, so each new file could silently reintroduce the pattern. Found by grep while auditing formatters as part of a broader design-system pass, not by a user report. While fixing `SupplierDetailPanel.jsx`'s purchase-history amount, found a **second, real bug underneath the formatting one**: it read `p.net_amount \|\| p.total_amount`, neither of which `GET /purchases` actually returns (the real field is `total_value`) — so every purchase in a supplier's history showed ₹0.00 regardless of its real amount, formatting bug or not. | Replaced all 62 call sites with `formatCurrency` (added the import where missing); fixed the `SupplierDetailPanel.jsx` field-name bug in the same change (now reads `total_value` first). Live-verified: MedSupply Distributors' purchase history went from every row showing ₹0.00 to real amounts (₹1,050.00, ₹8,400.00, etc.) with correct Indian grouping. No automated gate proposed — same class as the API-prefix bug above; a lint rule can't distinguish legitimate non-money `.toFixed(2)` (e.g. a percentage calc) from a missed money render without false positives. |
| Sep 7, 2026 | Manifesto rule #14 ("no assumptions, verify every time") — `PurchaseDetail`/`PurchaseReturnCreate`/`PurchaseReturnDetail`/`SalesReturnCreate`/`SalesReturnDetail`/`ExcelBulkUploadWizard` (2 files), 7 files total, 20 API call sites — every one 404'd whenever `REACT_APP_BACKEND_URL` is unset | An execution gap, not (only) a tooling gap: the Aug 20, 2026 commit (`dba464b`) that introduced this bug touched exactly these 7 files and its own commit message claimed "Verified end-to-end with a real browser session... Inventory add/search both succeed" — but Inventory doesn't use the `const API` pattern these 7 files do, so the verification covered a different page than the one actually changed. Also a tooling gap: no jest test exists for any of these 7 files, and no lint rule catches a local `API` constant duplicating an axios instance's own `baseURL`. This sat live-broken for ~7 weeks (Aug 20 → Sep 7) because REACT_APP_BACKEND_URL was still commonly set in local `.env` files until the "no longer needed locally" doc update, at which point every purchase/return/bulk-upload page silently broke for anyone following the current documented setup. | Removed the dead `const API` prefix and all 20 `${API}` template-literal usages across the 7 files — `api`'s own `baseURL` already supplies `/api`, so paths are now plain relative paths (`/purchases/${id}`, not `${API}/purchases/${id}`). Live-verified `PurchaseDetail` and `PurchaseReturnCreate` both load correctly post-fix, `npx tsc --noEmit` clean. No automated gate proposed — an ESLint rule can't distinguish a legitimate local constant from this specific footgun without false positives; the real fix is the habit this rule already states: when a fix touches N files, verify N files, not a different one that happens to be easier to click through. |
| Sep 6, 2026 | Manifesto rule #1 (AppButton only) — 21 raw `<button>` tags across BillingWorkspace/Dashboard, some written April 2026, before AppButton existed | A tooling gap, not an execution gap: `design-guard.sh` Rule 1 has caught these on every run since it existed, but (a) it was never run as a full-repo sweep after being added, only against new/changed files via pre-commit, and (b) `main` had zero branch protection until Sep 6, 2026 — a red CI check never actually blocked a merge, so a violation sitting in CI's output was purely informational, not a stop-sign. | Replaced all 21 buttons + 2 direct Shadcn imports with AppButton (see commit `6289d38`). Gate: `main` branch protection (added same day) now requires CI to pass before merge, so a new violation can't sit unenforced the way this one did — closing the actual root cause, not just the symptom. |
| Sep 6, 2026 | Session's own "verify, don't assume it works" discipline — playwright/chrome-devtools MCP tools reported "connected" during initial setup but had never actually launched a browser | Tooling gap: `claude mcp add` only confirms the MCP handshake succeeds and tools get listed — it doesn't exercise the tool. Nobody called a real browser action (`new_page`/`navigate`) against either server until this session's live verification, which is when it surfaced that this container has no Chrome binary at the default path and Chrome refuses to launch as root without `--no-sandbox`. The postgres MCP got an actual test query at setup time; these two didn't get the equivalent live check. | Pointed both servers at the pre-installed Chromium build with `--no-sandbox --headless` in `.mcp.json` (commit `8894f72`). No automated gate proposed — this class of gap (mistaking "connects" for "works") is closed by habit: any newly-added MCP tool should be exercised with one real action before being called verified, not just checked for a successful handshake. |
| Aug 26, 2026 | "HOW TO BUILD" mandatory order step 1 ("Read the DB model first") — Supplier `notes` field | `SupplierCreate`/`SupplierUpdate` Pydantic schemas and the `SupplierFormModal` UI textarea were both built with a working `notes` field, but nobody had confirmed a `notes` column actually existed on `Supplier`'s table before wiring the schema/UI to it — it didn't, so every save silently dropped the value. Existed undetected until CI's `test_edit_supplier` (asserting the round-trip) went red on the first real auto-triggered run. | Added migration `6f51c99eca91` (nullable `notes` Text on `suppliers`), added `notes` to `_supplier_response()` and `create_supplier()`'s ORM constructor. `update_supplier()`'s existing generic field-map loop needed no change. `test_edit_supplier` + full 13-test supplier suite pass. No new automated gate — a lint rule can't verify a Pydantic field maps to a real column; this is the same class the "HOW TO BUILD" order already exists to prevent by habit (step 1, before step 3/4), not by tooling. |
| Aug 25, 2026 | Rule 14 ("verify, every time") + the Aug 25 "product manager first" rule — `docs/23_PURCHASES_ACCEPTANCE_SPEC.md`'s UC-P08 (Edit draft purchase) marked "✅ Built" from a code read alone, same day the rule requiring a live zero-data walkthrough was written | - Claude read `update_purchase`/`get_purchase` and judged the edit flow correct without opening a draft and actually saving it. <br>- Real bug the read missed: `_purchase_item_response()` hardcoded every item's `product_sku` to `""` (comment admitted "filled by caller if needed" — nothing did). The edit flow loads a purchase via `GET`, keeps unchanged items' fields as loaded, resends them on save; `update_purchase` looks up each item by `product_sku` to rebuild it — so any untouched line item round-tripped a blank SKU and 404'd. Editing and saving a draft with any pre-existing item — the single most ordinary case — was completely broken. <br>- Only surfaced because the user's own build-order ("User should edit draft purchases") prompted an actual live walkthrough this time, not another read. | - `_purchase_response()` now resolves each item's real SKU via `product_id` (the actual FK) instead of a hardcoded blank — fixed in all 4 places that build a purchase response (create/update/get/mark-paid), not just the one that broke the UI. <br>- 5 new regression tests (`test_purchase_edit_draft_item_roundtrip.py`); full 124-test purchases suite unaffected. <br>- No new automated gate — this is the same class Rule 14 already covers by habit (read the real response shape, don't trust a hardcoded placeholder with a comment promising someone else fills it in); the fix was caught and verified the same way it always should be, by driving the real page. |
| Aug 23, 2026 | Rule 14 ("no assumptions, verify every time") — Medicine Detail → Batches tab | A full row-by-column audit of the Batches tab (requested directly: "tell me the whole Batches tab rows and columns are working properly. is the logic, code everything is good") found four real defects that had shipped and gone unnoticed: (1) **Disc. (%) always showed 0** — the cell read `batch.discount_percent`, a field that has never existed on any `StockBatch`/batches API response (discount is a **product**-level field, set via Bulk Update, and lives on `Product.discount_percent`); every pharmacy using per-product discounts saw a permanently-wrong 0% in this column. (2) **"Print QR" button was dead UI** — rendered with no `onClick` at all, same class of bug as the earlier Bell/Clock icons on the Medicine Detail header. (3) **Near-expiry highlighting was hardcoded to 90 days** — `isExpiringSoon(batch.expiry_date)` called with no `days` argument, silently ignoring the pharmacy's actual configured `PharmacySettings.near_expiry_threshold_days` (Settings → Inventory); a pharmacy that changed this setting saw no change in this table. (4) Dead fallback code — `batch.mrp \|\| product.default_mrp_per_unit` and `batch.cost_price` fallbacks referenced fields that don't exist/are unreachable, since the real fields (`mrp_paise`/`cost_price_paise` → `mrp_per_unit`/`cost_price_per_unit`) are NOT NULL on `StockBatch`. None of these were caught at review time because nobody had cross-checked each rendered column against its real source field/route — the same gap Rule 14 exists to close. | `frontend/src/pages/MedicineDetail/components/BatchesTab.jsx`: Disc.(%) now reads `product.discount_percent`; removed the entire dead "Print QR" button; `isExpiringSoon(batch.expiry_date, nearExpiryDays)` now takes the real threshold; simplified `mrp`/`costPrice` to their real single source fields. `frontend/src/pages/MedicineDetail/hooks/useMedicineDetail.js`: added `nearExpiryDays` state (90 fallback, matching `PharmacySettings`' own DB default) + `fetchNearExpiryDays()` reading `GET /settings`'s `inventory.near_expiry_days`. `frontend/src/pages/MedicineDetail/index.jsx`: fetches it on mount, passes it down to `BatchesTab`. Live-verified end-to-end against local backend+frontend: bulk-updated a real product's discount to 12.5% → Disc.(%) column showed 12.5 (was 0); confirmed zero `[data-testid="print-qr-btn"]` elements in the DOM; created a batch expiring in 30 days — with the pharmacy's near-expiry setting at 90 days it was highlighted orange, then after changing the setting to 10 days (re-fetched, no reload) the same row's highlight correctly disappeared, proving the column now genuinely tracks the configured setting rather than a fixed number. Same class of hardcoded-90-days bug also exists in `BillingTable.jsx` — noted, not fixed here (out of the requested scope, which was the Batches tab specifically). No automated gate proposed — this is the same "looks right, never verified against the real field/route" class Rule 14 already covers by habit, not by tooling; the fix was caught and verified the same way, by driving the real page. |
| Aug 25, 2026 | Rule 14 ("verify, every time") + Manifesto item 15 ("think like a product manager") — Claude called Purchases "solid, no further feature needed for V1" earlier the same session | - The claim came from reading `docs/15_ROADMAP.md`'s status tables and auditing individual screens (design tokens, routes, buttons) — never from walking the actual use case a pharmacist has on day one: new distributor, new medicine, first bill, zero starting data. <br>- That's exactly where it broke: New Purchase's Distributor/product search only matches existing Suppliers/Products records — there is no way to add either inline, so the flow is uncompletable for a real first-time bill without a separate, undocumented trip to Suppliers/Inventory first. <br>- Docs review couldn't have caught this — nobody had ever walked that specific zero-data path, in this session or before it; a passing screen-level audit and a seeded-fixture test both stay green regardless. | - Added a standing rule (`CLAUDE.md`, "HOW CLAUDE WORKS WITH ABINASH") — a section isn't "done" because its screens pass review or a seeded-fixture test passes; it's done when walked as one continuous use case starting from zero prior data for that flow. <br>- No automated gate proposed — this class of gap (a flow that works once fixture data exists, but is uncompletable from empty) is a semantic/product judgment call, not a lint-able pattern; catching it depends on the habit above, not tooling. <br>- The gap itself (no inline "add new distributor"/"add new medicine" during Purchase entry) is logged separately in the Purchases section above, not yet built. |
| Aug 25, 2026 | Manifesto item 1 ("no hand-rolled top-full mt-1 popover anywhere") — `SupplierDropdown.jsx` (Distributor field, New Purchase page) | - Written April 16, 2026 (Phase 7), 4+ months **before** design-guard.sh's Rule 7 (`grep "top-full mt-1"`) existed (added Aug 21, 2026 for a different bug, MoreMenu duplication) — the check is generic enough to also catch this pattern, but nothing ever re-swept pre-existing files against a rule added after they were written. A tooling gap, not an execution gap. <br>- Real user impact: `PurchaseSubbar`'s row is `overflow-x-auto` (needed for horizontal scroll on narrow viewports); per the CSS spec, setting only `overflow-x` also clips `overflow-y`, so the hand-rolled `absolute top-full` panel rendered correctly in the DOM (confirmed: all suppliers present, click handlers fired) but was 100% invisible — reported as "Distributor is not even opening." | - Rewrote `SupplierDropdown.jsx` to use the shared `Popover` (Radix, portals to `document.body`) — same pattern already used for Date/Due Date in the same file — escaping the clip entirely. <br>- Gate: none added — Rule 7 already generically covers this string pattern going forward; the real fix is running `bash scripts/design-guard.sh` (full repo, not just staged files) at least once after any new Rule is added to design-guard.sh, to catch pre-existing violations, not just new ones. Not automated here — flagged as a manual habit since a full-repo sweep on every rule addition has no obvious CI trigger. <br>- Also found while verifying: `node_modules/react-day-picker` was v8.10.1 despite `package.json`/lockfile correctly pinning v10.0.1 (dependency drift, not a code bug) — v8's classNames keys don't match v10's, so the shared `Calendar` component's Tailwind styling silently no-opped, and its `nav` prev/next buttons' `absolute left-1/right-1` had no correctly-positioned ancestor under v10's actual DOM structure (Nav renders once, as a sibling before `month_caption`, not nested inside it like v8). Both fixed in `calendar.tsx`; verified via Playwright screenshots. |
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
| AppButton primary variant (white on brand blue #4682B4) fails WCAG AA text contrast — 4.11:1, needs 4.5:1 | Low | Found Sep 7, 2026 via a real Lighthouse/axe audit — the one contrast violation left unfixed out of 17 found. Deliberate: fixing it means darkening the primary brand color's resting state everywhere (not just a badge), so asked Abinash first. Decision: leave as-is for now. Revisit if this becomes a real complaint or a stricter compliance need arises. |
| `/login` Lighthouse performance score is 0.60, against the documented ≥90 target | Medium | Found Sep 8, 2026 wiring up Lighthouse CI (`docs/19_PERFORMANCE.md` LIGHTHOUSE CI section). Likely drivers: 623KB gzipped main JS bundle (target is 250KB) and no route-level code splitting yet (`docs/19_PERFORMANCE.md` already documents lazy-loading routes as the fix, just not done). CI gate set to the real 0.60 baseline with buffer, not the 90 target, so it can't silently regress further — but closing the actual gap (code-split routes, trim the bundle) is separate, larger work not done in this pass. |
| Lighthouse CI only audits `/login` | Low | The only page reachable with zero auth state for a static `lhci` run. Auditing authenticated pages (Dashboard, BillingWorkspace) needs a `puppeteerScript` login step wired into `lighthouserc.js` — not built yet. |
| No visual-regression tool (e.g. Chromatic) | Low | Asked Abinash Sep 8, 2026, same pattern as the `ANTHROPIC_API_KEY` ask — needs an external Chromatic.com account + project token, so surfaced as a decision rather than assumed. **Decision: skipped for now.** Revisit only if he brings it up again — don't re-ask each session. |
| No component state matrix; inconsistent micro-interactions | ✅ | Fixed Sep 11, 2026. Real gaps found by reading the actual component code (not guessed): (1) no button anywhere had a pressed/press-down state — fixed once in `ui/button.tsx` (`active:scale-[0.98]`), cascades to every `AppButton`/`MoreMenu`. (2) An invalid form field never looked different from a valid one — `aria-invalid` was already being set (shadcn `FormControl`, or manually) but no CSS reacted to it, since Tailwind's default `aria` variant list doesn't include `invalid`. Added it in `tailwind.config.js`, wired `aria-invalid:border-red-500` into `ui/input.tsx`/`textarea.jsx`/`select.jsx`, retrofitted `SupplierFormModal.tsx` as the live reference (regression test added). (3) 21 table-row hover states across 18 files (`hover:bg-brand-tint`) had no `transition-colors`, so the hover snapped instantly while every other interactive element faded — added the missing class mechanically across all 18. Full state-by-state comparison now documented in `docs/06_COMPONENTS.md`'s new COMPONENT STATE MATRIX section. Verified live (Suppliers page: empty-name submit now shows a red-bordered input, not just a message below it) and via `npx tsc --noEmit` + full jest suite (142/142) + `design-guard.sh`. |
| No formal root-cause-before-fix skill; no post-merge health check | ✅ | Fixed Sep 11, 2026 — added `.claude/skills/pharmacare-investigate` and `.claude/skills/pharmacare-canary`. Prompted by reviewing Garry Tan's `gstack` (a viral, controversial open-source Claude Code skill pack — verified real via web search, not installed wholesale: most of it overlaps what PharmaCare already has, and its self-updating unvendored install pattern is a real supply-chain trust question for a compliance app). Adapted just the two genuinely missing ideas as PharmaCare-specific skills instead of importing the toolkit: `pharmacare-investigate` formalizes Manifesto rule 14 (no assumptions) as an enforced trace-before-fix workflow, citing 3 real past bugs from this log that were guesses, not verified root causes; `pharmacare-canary` is a post-merge smoke-test workflow (real browser + Lighthouse regression check), scoped honestly to local/CI since no live staging/production exists yet (see PRE-LAUNCH BLOCKERS item 5) — written to point at a real URL once one exists, no rewrite needed. |
| `frontend/src/constants/api.js` and `api.ts` (also `routes.js`/`routes.ts`) are duplicate files that have already drifted apart | Medium | Found Sep 12, 2026 while adding the reorder-list endpoint to `api.js`: CRA's default webpack resolve order picks `.js` over `.ts` for a bare `@/constants/api` import, so `api.ts` is dead code nobody actually loads — but it still gets hand-edited sometimes (has `purchaseReturnConfirm`/`CONFIRM` that `api.js` lacks; `api.js` has `purchaseCheckDuplicateInvoice` that `api.ts` lacks). Not fixed in this pass — real fix is deleting one and finishing the other's TS migration, real scope, not a side effect of an unrelated feature. Same class of duplicate-source-of-truth risk as the seed_admin.py/constants.py role-permissions drift fixed Sep 12, 2026 (RULE MISSES LOG). |
| Team's member list shows nothing while loading | ✅ | Fixed Sep 5, 2026 — `MembersTable.jsx` swapped `if (loading) return null` for `TableSkeleton` (Manifesto rule #16). Found as part of a full-app skeleton audit that also fixed `PurchaseReturnCreate` (plain-text loading string) and `SalesReturnCreate` (no loading state at all — form flashed empty before the original bill loaded). |
| Sheets not implemented — forms use centered modals | High | Next sprint |
| Zod not on all forms — some use uncontrolled inputs | High | Next sprint |
| Bill PDF template incomplete | Medium | Renderer exists, layout WIP |
| Low stock / expiry alerts surfaced in Dashboard AlertsPanel | ✅ | Done — thresholds read from PharmacySettings |
| Bulk upload UX incomplete | Medium | Backend done |
| Margin report UI WIP | Low | Data available via API |
| No CI/CD pipeline | Medium | Manual deploys today |
| No staging environment | Medium | Dev → prod directly today |
| Feature flags not connected to Roadmap items | Medium | All 📋 items should ship behind a flag |
| Permission system (`role.permissions`, `has_permission()`) unenforced app-wide | High | Found Aug 24, 2026 auditing Purchases — the roles/permissions data and checker function exist and are seeded, but were called from zero endpoints anywhere. Enforced for Purchases/Purchase Returns writes only (deliberate, scoped, discussed with Abinash first); every other module (Billing, Inventory, Customers, Suppliers, Reports, Settings) remains fully open to any authenticated user regardless of role. Needs an explicit decision on the app-wide rollout, not silent module-by-module fixes. |
| `npx tsc --noEmit` fails — `SupplierDropdown.test.tsx` (7 errors: implicit `any` params, mock typing on the real `api.post` signature) | ✅ | Fixed Sep 5, 2026 as part of wiring `tsc --noEmit` into `design-guard.sh` Rule 10 + a matching pre-commit check — fixed the pre-existing errors first, same order as the skeleton rule (fix what's broken before turning on a new blocking gate). |
| `main` branch protection doesn't require "PharmaCare Design System Checks" (design-guard CI job) | Medium | Deliberately left out Sep 6, 2026 when branch protection was enabled — the job was red at the time (21 Rule 1 + 2 Rule 5 violations). Those are now fixed (Sep 6) and the job is green — add it to the required-checks list in GitHub branch protection settings next. |
| `design-guard.yml`'s separate `ESLint`/`TypeScript` jobs use plain `npm ci` (no `--legacy-peer-deps`) | Low | Fails on a pre-existing ERESOLVE conflict between `typescript@5.9.3` and `react-scripts@5.0.1`'s peer dependency. Pre-existing, unrelated to any specific feature; `ci.yml` and the `design-guard` job in the same file already use `--legacy-peer-deps` correctly — just these two jobs need the same fix. |

---

*Update this file when a feature ships (✅) or a new item is confirmed (📋).*
*Owner: developer who builds the feature updates the status row.*
