# PharmaCare — Purchases & Purchase Returns Acceptance Spec
# Version: 1.7 | Last updated: August 26, 2026
# Source: full use-case spec provided by Abinash, mapped against real code
# (not assumptions) via direct reads + 3 parallel research passes + one
# live zero-data browser walkthrough. Every row below cites evidence.

---

## HOW TO READ THIS

- ✅ Built — verified against real code/tests, matches the use case.
- 🔄 Partial — built but missing something specific, named per row.
- ❌ Missing — searched, confirmed absent.
- 🐛 flags a **live bug**, not a missing feature — something currently shipped that is actively wrong.

This is the acceptance spec going forward. When work closes a gap, update its
row here (status + evidence), not just in `docs/15_ROADMAP.md`.

---

## EXECUTIVE SUMMARY — READ THIS FIRST

18 real findings, ranked by how badly they hurt a real pharmacy today.

### 🐛 Live bugs (shipped, currently wrong — not just missing)

1. **Overpayment corrupts the ledger.** Paying more than the outstanding
   balance isn't rejected anywhere (frontend or backend). The purchase's
   `amount_paid_paise` gets silently capped at the total, but the
   `PurchasePayment` row inserted still stores the full, uncapped amount —
   so the sum of individual payments can permanently exceed what the
   purchase says is paid. This is a real accounting bug, not a UX gap.
   (`backend/routers/purchases.py:735-772`, `PurchasePayModal.jsx:34-37`)
2. **A genuine double-submit with no batch number creates duplicate stock.**
   The duplicate-batch guard only fires if two submissions share the exact
   same explicit `batch_no`. Leave it blank and a real double-click/retry
   can create two full purchases and double the stock. Frontend disables
   the button during `loading`, but that's same-tab only.
   (`backend/routers/purchases.py:288-305`)
3. **The GST report page is broken.** `GSTReport.js` reads response fields
   (`sales_gst.breakup`, `total_taxable`, etc.) that don't exist on what
   `GET /reports/gst` actually returns (`sales`, `purchases`,
   `net_liability`). It throws on render. Zero test coverage caught this.
4. ~~The Purchases list's Cash/Credit/Due filter pills do nothing.~~ —
   ✅ **Fixed Aug 26, 2026.** `GET /purchases` now declares and applies
   `purchase_on`/`payment_status`; also found and fixed a second bug in
   the same endpoint while there — the list response never included
   `purchase_on` at all, so the frontend's own "Cash" badge was
   independently broken too. Rebuilt the filter as a single dropdown
   (was 4 pills), matching the Distributor filter's style, per direct
   UI feedback.
5. **Stock adjustment has no permission check at all.** `POST
   /batches/{id}/adjust` only requires being logged in — a cashier can
   adjust any stock quantity. Every other purchase-related write endpoint
   got gated in the Aug 24 permission pass; this one was missed.

### ❌ The one remaining structural gap (down from two)

6. ~~No way to add a new medicine during purchase entry~~ — ✅ done, Aug 26
   (UC-P12). Was confirmed live: typing a never-seen-before name showed
   "not found" with zero path forward. Fixed the same day as UC-P10/UC-P11
   (search by brand/generic/strength/barcode) and reusing UC-P02's
   (Aug 25) add-new-distributor pattern — all three legs of "find or
   create any medicine, from any known field, without leaving the
   purchase" are now built.
7. **Purchase Returns has no accept/reject/credit-pending workflow —
   creating a return is one atomic "confirmed" action.** The spec assumes
   a multi-stage supplier-approval process (9 possible statuses); the code
   only ever produces one. This reshapes nearly every UC-PR item below —
   read the Returns section's headline note before the table.

### Everything else worth knowing before you plan work

8. Confirmed purchases can never be corrected — no reversal, no adjustment
   path, only "blocked from editing." A genuine mistake is permanent.
9. Payments can never be edited or reversed once recorded — same problem.
10. 4 of 5 spec'd entry points to start a return are broken or missing —
    including a header button that shows a toast instead of navigating.
11. Return reason is never actually sent to the backend — every return
    silently gets `reason="return"` regardless of what (if anything) the
    user typed.
12. No way to distinguish free vs. paid quantity in a return.
13. Zero purchase-return reports or analytics exist — not partial, zero.
14. Backdating a purchase has no authorization gate — anyone can.
15. Pulling the GST report has no permission gate — a cashier can export it.
16. Audit log's `old_values` and `ip_address` columns are defined but
    never populated — every audit row has them permanently `NULL`.
17. MRP-below-purchase-cost is never warned, frontend or backend.
18. The backend has real pack/strip/tablet unit-conversion logic
    (`units_per_pack`), tested and working — but the Purchase entry screen
    never exposes a field for it. A real feature nobody can reach.

---

## 1. PURCHASE SETUP

### UC-P01: Select existing supplier — 🔄 Partial
- Search matches **name only** (`SupplierDropdown.jsx:28-30`) — not phone, GSTIN, or licence number as spec'd.
- Dropdown shows name + GSTIN only (`SupplierDropdown.jsx:80-83`) — missing drug licence, address, payment terms, outstanding balance.
- Inactive suppliers are silently **excluded** from the list (`active_only: true`, `PurchaseNew/index.jsx:73`), not shown-with-warning as spec'd — a real design difference, not a bug.
- No link to open supplier detail from the picker at all.

### UC-P02: Add supplier during purchase — ✅ Built (Aug 25, 2026)
Fixed. `SupplierDropdown` now shows "+ Add '<name>' as new distributor" whenever `allowCreate` is on and the search box has text (whether or not there are other matches) — opt-in via a prop so `PurchasesList`'s read-only filter usage of the same component doesn't get a create option. Clicking it opens the existing Supplier form (moved to `components/shared/SupplierFormModal.tsx` so both Suppliers and Purchases share one implementation — was previously owned solely by the Suppliers page), prefilled with the typed name, validated with the same GSTIN/phone rules as the standalone Suppliers page. On save: posts to `POST /suppliers` (existing endpoint — already blocks duplicate names with a 400), auto-selects the new supplier, and adds it to the in-memory `suppliers` list so it's immediately searchable again without a refetch. Verified live end-to-end (zero-data: a genuinely new name, never in the system) and via 5 new component tests (`PurchaseNew/components/__tests__/SupplierDropdown.test.jsx`) plus 2 new tests on the moved form (`components/shared/__tests__/SupplierFormModal.test.jsx`).
Real bug caught during this build (not shipped): the initial implementation read the typed name from the same state the search-popover clears on close, so the create form opened blank — fixed by capturing the name into dedicated state at click time, before the popover's close handler could clear it. Caught by live verification, not by the type-checker or lint.

### UC-P03: Upload supplier bill — 🔄 Partial, scope confirmed with Abinash (Aug 25, 2026)
Scope decision: "upload and create a purchase" means attach-a-file-for-reference, **not** AI/OCR auto-extraction of line items from the bill — that would be new architecture and real ongoing cost, and was explicitly declined for now (offered as the bigger option, not chosen).

Within that scope: image (jpeg/png/webp) or PDF only — no Excel/CSV import, no distinct camera-capture flow, single attachment only (not multiple, would need a backend schema change — bigger than this batch). 5MB cap + mime validation enforced both client and server (`InvoiceAttachmentUpload.tsx`, backend `_validate_invoice_attachment`). Stored as base64 in a Postgres TEXT column, no dedicated secure file store or access control beyond normal purchase-record permissions.
**New, Aug 25**: the attached file can now be previewed before confirming the purchase — click the chip to open it in a new tab, same pattern the already-working "view later" link on a confirmed purchase uses (`PurchaseDetail/index.jsx:128-140`, confirmed already built). Closes the "preview the file" / "view or download it later" gaps.

### UC-P04: Create purchase manually — ✅ Built
Full flow verified end-to-end: draft → supplier → invoice# → date → due date → items/batches → totals review → save/confirm. Live-tested this session.

---

## 2. PURCHASE DOCUMENT DETAILS

### UC-P05: Enter invoice information — 🔄 Partial
- `Purchase.supplier_invoice_date` exists as its own DB column (`models/purchases.py:33`) but **the frontend never sends it** — only `purchase_date` (entry date) is captured. Invoice date and entry date are conflated into one field. "Show the difference" is impossible today.
- Drug licence number and payment terms exist on the Supplier record but are never displayed anywhere in the Purchase UI.
- `created_by` is captured; **no `confirmed_by`/`confirmed_at`** — only a generic `updated_at` timestamp shifts on confirm.
- Duplicate invoice number: warned only, never blocked (advisory by design, confirmed by test `test_does_not_block_creation_even_when_duplicate`).
- Backdating: **no authorization gate at all** — any user with plain create/edit permission can backdate freely.

### UC-P06: Save purchase as draft — 🔄 Partial, one gap closed (Aug 25, 2026)
Draft correctly excluded from stock/balance/reports (verified: `_create_stock_for_items` only runs `if status=="confirmed"`). All fields round-trip on edit.
- **Fixed**: drafts can now be deleted (soft-delete, `DELETE /purchases/{id}`) — reuses the same `deleted_at` pattern already used for suppliers/customers elsewhere in this app. Restricted to `status=="draft"` only — a confirmed purchase has real stock/financial effects and gets a real correction mechanism instead (UC-P09, still not built), not a delete. While building this, found `get_purchase()` and `update_purchase()` never filtered `deleted_at` at all — a "deleted" purchase could still be fetched or edited directly by id. Fixed both in the same change. Trash icon only shows on draft rows in the Purchases list; confirmed rows never get one. 7 new backend regression tests, all passing, no regressions in the existing 36.
- **Still missing**: no autosave/recovery — a draft not explicitly saved is lost on refresh or navigation away.

### UC-P07: Confirm purchase — 🔄 Partial
Inventory/batch/ledger/payable/reports/audit all update correctly on confirm, in one atomic DB transaction (verified: `database.py:27-34`'s commit-on-success/rollback-on-exception pattern wraps the whole request — a mid-request failure like the MRP check rolls back everything, no partial posting). The one real gap: **double-confirmation is only guarded when the client sends an explicit shared batch number** — see bug #2 above.

### UC-P08: Edit draft purchase — 🐛 was a live bug, fixed (Aug 25, 2026)
**This was wrongly marked ✅ Built in this spec's first pass — that came from reading the code, not from actually opening a draft and saving it. Doing that live surfaced a real bug the code read completely missed:**

`get_purchase()`'s response hardcoded every item's `product_sku` to `""` (comment: "filled by caller if needed" — nothing ever did). The frontend's edit-draft flow loads a purchase via this endpoint, keeps each unchanged line item's fields as loaded, and resends them on save. `update_purchase()` rebuilds every item by looking it up via `product_sku` (`_get_product_by_sku`) — so any item the pharmacist didn't remove-and-re-add round-tripped a blank SKU back into the save request, and the lookup 404'd. **Editing and saving a draft with any pre-existing line item — the single most ordinary edit-draft scenario — was completely broken.** Confirmed live via Playwright before investigating (real 404 on the actual save click), then reproduced and fixed at the API level directly.

Fix: `_purchase_response()` now resolves each item's real SKU via its `product_id` (the actual FK — `product_sku` was never a stored column, purely a request/response convenience) instead of a hardcoded blank. Fixed in all 4 places that build a purchase response (create, update, get, mark-paid) — not just the one that broke the UI, since all 4 shared the same bug. 5 new regression tests, all passing; full 124-test purchases suite unaffected. Live-verified end to end via the real browser flow (create draft → edit → change qty/batch → save → reload → confirm the change actually persisted).

Once that's fixed, the rest of the use case holds: every field editable pre-confirm, totals recalculate, permission-gated. Minor remaining gap: no field-level diff/version history — only one generic audit entry per edit.

### UC-P09: Correct a confirmed purchase — ❌ Missing
No reversal, no adjustment, no correction path of any kind exists. "Don't allow silent editing" is enforced (the 400 block); the other half of the requirement — *some* controlled way to fix a real mistake — was never built. A confirmed purchase is permanent, forever, even when wrong.

---

## 3. MEDICINE LINE ITEMS

### UC-P10: Add medicine by search — ✅ Built (Aug 26, 2026)
Was client-side name/SKU-only filtering over a 500-product preload (broke past 500 products, and `GET /products` already searched brand/manufacturer/generic/strength server-side — the purchase page just never used it). Switched to the real server-side search; result rows now show strength when present. Still not searched: dosage form, supplier product code (neither field is tracked per-supplier anywhere in the schema — a real gap, not a UI oversight, out of scope here). Current stock/last purchase rate/MRP in the result row were never requested as part of this pass — noted as a possible follow-up, not built.

### UC-P11: Add medicine by barcode — ✅ Built (Aug 26, 2026)
Reused Billing's exact `BarcodeScannerModal`/`useUSBBarcodeScanner` (camera + manual entry + passive USB listener) and `GET /products/barcode/{code}`, wired to a purchase-specific handler — the one real difference from Billing: never rejects a zero-stock match, since receiving stock for something not yet on hand is the normal purchase case, not an error. Live-verified: search "para" surfaces both a stocked and an out-of-stock product by brand/strength; manual barcode entry with an out-of-stock product's SKU adds it to the line-items table with ₹0 stock and no batches, exactly as expected pre-confirm; an unmatched code shows "No product found for barcode: …" without adding anything.

### UC-P12: Add a new medicine during purchase — ✅ Built (Aug 26, 2026)
Same shape as UC-P02's inline add-distributor: when a search finds nothing, a "+ Add '<typed text>' as new medicine" row opens the real Add Medicine form (`AddMedicineModal`, moved from `pages/InventorySearch/components/` to `components/shared/` — now used by both Inventory and Purchases, same precedent as `SupplierFormModal`) prefilled with the typed name. On save the newly created product is added straight to the purchase's line items — no separate trip to Inventory, no retyping. Deliberately reuses the full standalone form (category/dosage form/GST%/opening stock) rather than a stripped-down version — a medicine carries real compliance data (Schedule, HSN, GST) a supplier record doesn't, so the "same shape, fewer required fields" simplification that fit UC-P02 doesn't apply here. Live-verified: typed a never-seen medicine name, form opened prefilled, filled category/dosage form, submitted, "Medicine added successfully" toast, item appeared in the purchase's line-items table ready for batch/pricing entry.

### UC-P13: Add multiple batches of the same medicine — ✅ Built
Each purchase's line item owns its own batch/expiry — the normal, expected path across separate purchases.

### UC-P14: Add the same batch twice — 🔄 Partial (rejects, doesn't merge/ask)
Within one form: hard-blocked at the product level ("Product already added" toast) — coarser than spec's per-batch prompt. Across purchases: backend hard-rejects with a 400 and rolls back the whole purchase. Spec wants a merge-or-reject choice; code only ever hard-rejects.

### UC-P15: Enter batch details — 🔄 Partial
Captured: batch#, expiry, qty, free qty, PTR, MRP, GST%. Missing entirely: manufacturing date, a distinct selling price, per-line storage location, and **per-line discount** — `PurchaseItem.discount_percent` exists in the DB but the frontend never sets it (always 0; only a purchase-level total discount exists).
Validation: batch#/expiry/qty/MRP required at confirm ✅. **Expiry-in-the-past is never checked.** Free qty has a `min="0"` on the input but no real validation, and is never checked against paid qty. MRP-below-cost never warned (bug/gap #17 above).

### UC-P16: Handle quantity units (pack/strip/tablet) — ❌ Missing in the UI, ✅ built in the backend
`units_per_pack` exists on `PurchaseItem` and the backend's confirm-time math genuinely converts pack quantities correctly (tested: `test_units_per_pack_greater_than_1_converts_to_packs`). But `PurchaseItemsTable.jsx` has one flat "Qty" number field — no unit selector, no "invoice qty vs. inventory qty" display anywhere. A real backend feature the UI never surfaces.

### UC-P17: Handle free goods — 🔄 Partial
Paid/free qty captured separately, correctly excluded from taxable value, correctly added to stock. Missing: no "total received" summary display, no scheme-description field, **no report shows free-stock separately** (no batch report exists at all), and **returns can't distinguish free from paid** (see PR05).

### UC-P18: Handle short/excess supply — ❌ Missing (schema hints at it, nothing uses it)
`quantity_ordered` and `quantity_received` are separate DB columns, but the frontend has one field and always sends the same value for both. Ordered/received/accepted/rejected quantities functionally don't exist as distinct concepts anywhere.

---

## 4. PRICING, DISCOUNTS, TAXES

### UC-P19: Enter purchase pricing — 🔄 Partial
PTR, MRP, total discount, CESS, adjusted CN, TCS, extra charges, adjustment amount, round-off all present and correctly kept separate from calculated values. Missing: per-line discount (see P15), a distinct selling-price field, and trade/cash/scheme discount as separate concepts (only one flat "Total Discount" bucket exists).

### UC-P20: Validate price changes — ❌ Missing entirely
No warning anywhere for a rate increase, MRP change, MRP below cost, selling price below cost, or a price differing from history. "Don't overwrite historical batch pricing" holds true, but only because each purchase naturally creates its own row — not from any deliberate protection.

### UC-P21: Calculate GST — 🔄 Partial
CGST/SGST auto-split 50/50 and correctly computed. **IGST is never populated** — the columns exist, nothing ever writes to them (matches the already-known, deliberately-deferred single-state-only decision). Cess is a flat user-entered adjustment, not rate-driven. Same formula shared between create/update — no inconsistency risk there.

### UC-P22: Reconcile invoice total — 🔄 Partial
The Invoice Breakdown modal genuinely does let a pharmacist reconcile system totals against what the supplier's bill says, with the difference shown clearly (round-off, colored). Gaps: no permission gate on making an adjustment, no reason field tied to it, and — per Agent 1's report finding — `adjustment_amount_paise` is saved but **never read by any report**, so it's invisible after entry.

---

## 5. INVENTORY INTEGRATION

### UC-P23: Update inventory after confirmation — ✅ Built
Confirmed items correctly post to stock/batches/ledger; draft/failed/cancelled correctly excluded.

### UC-P24: Purchase history in medicine detail — ✅ Built (near-complete)
`TransactionTab.jsx` shows Purchase#/Date/Supplier/Invoice#/Batch/Qty/Cost/MRP/Total/Status. Missing 2 of the spec's columns: Free quantity, User.

### UC-P25: Maintain stock ledger — ✅ Built
`StockMovement` created per confirmed item with product/batch/type/qty/before-after/reference/user/timestamp — verified via test citation.

### UC-P26: Handle transaction failure — ✅ Built, same caveat as P07
Single-transaction rollback prevents partial posting on any validation failure. The one exception is the blank-batch-number double-submit case, which isn't a failure — it's two full successes creating duplicate stock (bug #2).

---

## 6. PURCHASE PAYMENTS

### UC-P27: Mark purchase unpaid (credit) — ✅ Built, with a broken filter nearby
Credit purchases correctly default unpaid, due date computed, outstanding shown. The "Due" filter pill on the Purchases list is broken (bug #4).

### UC-P28: Mark purchase fully paid — 🔄 Partial
Payment recorded correctly with full audit trail. "Payment history" is only a single latest-date shown on the purchase (`last_payment_date`), not a full itemized list of every payment made.

### UC-P29: Record partial payment — 🔄 Partial — contains the worst bug in this whole spec
Everything works **except** the core safety requirement: overpayment isn't rejected anywhere, and the resulting mismatch between the `PurchasePayment` row and the purchase's own `amount_paid_paise` is a genuine, permanent ledger-integrity bug (#1 above).

### UC-P30: Support payment methods — 🔄 Partial
Cash/UPI/Bank Transfer/Cheque all present, matching the spec. Card/Other — missing (already known, already queued). No cheque-number or bank-detail sub-fields; no attachment on a payment record.

### UC-P31: Edit or reverse payment — ❌ Missing entirely
No endpoint exists. A wrong amount, date, or method, once recorded, can never be corrected.

### UC-P32: Payment due alerts — 🔄 Partial
Supplier-wise and purchase-wise outstanding both work (computed-on-read, can't go stale). Due-today/overdue/due-soon badges, and ageing buckets, don't exist as a dedicated system — and no purchase-specific dashboard metric (amount payable, overdue balance) exists at all (confirmed absent from both dashboard endpoints).

---

## 7–8. PURCHASE REPORTS & ANALYTICS (UC-P33–P43)

*Researched by a dedicated agent against `backend/routers/reports.py`, `purchases.py`, `suppliers.py`, and the full frontend Reports tree.*

| UC | Status | Evidence |
|---|---|---|
| P33 Purchase register | 🔄 Partial | `GET /purchases` filters date/supplier/status/search/purchase_on/payment_status — no product/category/manufacturer/type/user filters yet. List UI doesn't even render the taxable-value/tax columns the API already returns. Payment (Cash/Credit/Due) filter fixed and rebuilt as a dropdown, Aug 26 (was bug #4). |
| P34 Batch purchase report | ❌ Missing | No report endpoint exists; `StockBatch` has no supplier/purchase link to build one from without new joins. |
| P35 Supplier purchase report | 🔄 Partial | `GET /suppliers/{id}/summary` gives total purchases/value/last-date/outstanding only — missing returns, net purchases, payments, avg rate, top medicines. **Also counts draft purchases in its totals** — a real accuracy bug (`suppliers.py:227`). |
| P36 GST purchase report | 🔄 Partial + 🐛 | Backend correctly restricts to confirmed purchases and nets returns against input tax. IGST never populated (matches P21), no cess in the response despite the column existing. **Frontend is broken** (bug #3). |
| P37 Purchase payment report | ❌ Missing | Payments are recorded and individually queryable, but nothing aggregates/lists them across purchases. |
| P38 Purchase variance report | ❌ Missing | Zero mentions anywhere in the backend. `adjustment_amount_paise` is captured but never surfaced (matches P22). |
| P39 Export and print | 🔄 Partial | Print works for a single purchase. Export exists for Sales/Low-stock/Expiry/Inventory reports only — nothing for the purchase register, supplier statement, batch, or payment reports, because those reports don't exist. GST export would also throw (same broken field names as bug #3). |
| P40 Purchase dashboard | ❌ Missing | Neither dashboard endpoint has any purchase-specific metric (value today/month, payable, overdue, near-expiry/expired purchase value). A real, complete `/analytics/purchases` endpoint exists server-side with several of these — **but nothing in the frontend calls it.** |
| P41 Supplier analytics | ❌ Missing | No ranking, payment-performance, return-rate, or price-comparison logic anywhere. |
| P42 Product purchase analytics | ❌ Missing | Zero endpoints for rate trends, coverage, free-goods contribution, etc. |
| P43 Purchase profitability impact | ❌ Missing | No margin computation exists. Secondary finding: most report endpoints correctly restrict to confirmed-only, **but the supplier summary (P35) leaks drafts into its totals** — the same bug noted there. |

---

## 9. PURCHASE RETURNS

**Read this before the table.** Creating a return is **one atomic, single-status
operation** (`POST /purchase-returns`) — it validates quantity, deducts stock,
writes the ledger movement, generates a debit-note number, and sets
`status="confirmed"`, all in the same request. There is no accept/reject/
cancel endpoint anywhere in the router — confirmed by grepping the whole
file for every workflow verb the spec assumes. A code comment even documents
this as deliberate: *"a separate confirm step was never exercised by any
frontend screen or test."* This single fact is why PR07–PR10 and PR12/PR14
are Missing — the spec assumes a 9-status supplier-approval workflow; the
code only ever produces one.

| UC | Status | Evidence |
|---|---|---|
| PR01 Start a return (5 entry points) | 🔄 Partial — only 1 of 5 works | Purchase Detail → works. Purchase List → only switches tabs, doesn't start a return. Dedicated Returns section header button → **shows a toast telling you to go elsewhere instead of navigating.** Its empty-state button navigates with no `purchase_id`, which the create page immediately rejects with an error + redirect. Supplier Detail and Inventory/batch detail → no create action at all, history display only. |
| PR02 Select returnable items | ✅ Built (mostly) | Server computes original/already-returned/max-returnable qty correctly, keyed by product_id not name (tested). Missing: no free-qty or sold-qty fields exposed at all. |
| PR03 Return by reason | ❌ Missing (as spec'd) | Backend accepts free text defaulting to `"return"` if omitted. **The frontend has no reason field and never sends one** — every return silently gets `reason="return"` regardless of what actually happened. None of the spec's 11 named reasons exist anywhere in the UI. |
| PR04 Partial return | ✅ Built | Server-validated against remaining returnable qty, UI blocks over-entry, only the returned amount is deducted. |
| PR05 Return free goods | ❌ Missing | No free/paid distinction exists on a return item at all — column, field, nothing. |
| PR06 Return damaged/expired stock | 🔄 Partial | Stock removed, reason typeable in free-text notes, supplier/batch traceability preserved. No quarantine/hold state — "prevents sale while pending" is moot since stock is already fully deducted at creation, not held. |
| PR07 Return statuses | 🔄 Partial (effectively one status) | Only `"confirmed"` is ever set. The model's `"pending"` default is never actually reached by any code path. None of Draft/Submitted/Accepted/Rejected/Credit-pending/etc. exist. |
| PR08/09/10 Supplier accepts/rejects (full or partial) | ❌ Missing | No accept/reject endpoint exists — confirmed by a whole-router grep. Nothing to reject stock back into, because rejection isn't modeled at all. |
| PR11 Supplier credit note | 🔄 Partial | Debit-note number generation was recently fixed (was previously always null) and is verified by a regression test. Missing: no CGST/SGST/IGST split on the return record (unlike Purchase/PurchaseItem, which have it), no credit-status field, no attachment field. |
| PR12 Refund/settlement type | ❌ Missing | The Create screen has a `payment_type` selector — but the backend accepts the field and **never stores or uses it.** Silently dropped. |
| PR13 Edit return | 🔄 Partial — backend works, frontend can't reach it | The backend genuinely supports a financial edit that recalculates stock deltas correctly (tested, including a re-validation against available stock). **The edit modal never sends items** — only note/billed-by — so this code path is effectively dead from the UI today. |
| PR14 Cancel return | ❌ Missing | No cancel endpoint exists — nothing to cancel from, given the single-status model. |
| PR15 Return against unavailable stock | ✅ Built | Explicitly guarded server-side with a clear 400 before any stock mutation; tested against both create and the financial-edit path. |

### Section 10 — Return reports: ❌ Missing entirely
No purchase-return-specific report endpoint exists at all. Returns only surface as (1) a subtraction inside the GST report, and (2) one aggregate pair (`total_purchase_returns_value`, `total_returns_count`) inside purchase analytics. No supplier/product/batch/reason breakdown, no ageing, no accepted-vs-rejected (nothing to break down, since there's no accept/reject state).

### Section 11 — Return analytics: ❌ Missing, except one derivable number
`net_purchases` (purchases minus returns) is available. Everything else — by-supplier, by-reason, expired/damaged value, credit-pending, settlement time, rejected value, repeat-return products — doesn't exist, largely because the underlying data (reason, credit status, accept/reject state) was never captured in the first place.

---

## 12. PERMISSIONS & AUDIT (UC-A01, UC-A02)

*Researched by a dedicated agent against the full permission/audit call graph and all 24 `backend/tests/test_purchase*.py` files.*

### UC-A01: Role permission enforcement

| Action | Gated? | Note |
|---|---|---|
| Create/edit purchase | ✅ | `purchases:create` / `purchases:edit` |
| Confirm purchase | ✅ (shares the edit gate) | No distinct "confirm" permission — same PUT as edit-draft |
| Record payment | ✅ (shares the edit gate) | Uses generic `edit`, not a distinct `pay` permission |
| Edit/cancel purchase | N/A | Feature doesn't exist to gate |
| Create/edit return | ✅ | |
| Confirm/cancel return | N/A | Feature doesn't exist to gate |
| **Adjust stock** | ❌ **Not gated at all** | `POST /batches/{id}/adjust` only requires login — any role, including cashier, can adjust any stock quantity. Bug #5 above. |
| Change purchase rate / MRP | ✅ (not field-level) | Bundled into the same blanket edit gate, not its own permission |
| **Backdate transactions** | ❌ **Not gated at all** | No date-range restriction exists anywhere; any user who can create/edit can backdate freely |
| **Export reports** | ❌ **Not gated at all** | GST/sales/analytics endpoints only require login — a cashier can pull the GST report |

Cross-cutting: the RBAC system (`has_permission`) existed since the app's seed data but was wired into **zero** endpoints until the Purchases/Returns pass — every other module (billing, inventory, customers, suppliers, settings, users) remains fully unenforced. `cashier` has no `purchases` key at all in seed roles, so every gated purchases action correctly denies a cashier — but the ungated ones (adjust stock, backdate, export) don't.

### UC-A02: Audit history

- Create, update, payment, and return-create/edit are all logged with user + timestamp + action + entity.
- **`old_values` is defined on the schema but never written anywhere — always `NULL`.** Every audit row only ever shows the new state, never what changed from.
- **`ip_address` is likewise defined but never populated — always `NULL`.**
- Stock posting itself (`_create_stock_for_items`) has no dedicated audit call — only inferable from the enclosing purchase's entry.
- A plain draft edit and an actual confirm event both log as the same `"update"` action — the only way to tell them apart is inspecting `new_values.status` by hand.

### Test coverage — genuinely strong on the happy paths, with real blind spots
Purchase creation, draft save, confirm/stock-posting, edit, MRP validation, duplicate-invoice warning, full/partial payment, return creation, return over-return prevention, and role-based permission checks (create/pay/return-create) are all covered by real, specific tests.

**Not covered by any test:**
- Overpayment (bug #1) — completely unexercised.
- Purchase-side audit logging (create/update/payment) — the analogous return-side logging *is* tested; the purchase side isn't.
- The GST report endpoint — zero test references it anywhere in the suite, despite it computing real tax-liability numbers.

---

## 13. OPERATIONAL EDGE CASES

| Case | Status | Note |
|---|---|---|
| Duplicate invoice (same supplier) | 🔄 | Warned only, never blocked — by design |
| Duplicate batch, same purchase | 🔄 | Hard-blocked at product level (coarser than spec's merge prompt) |
| Duplicate batch, different purchases | ✅ | Rejected with rollback |
| MRP below purchase cost | ❌ | Never warned, either side |
| Free qty greater than paid qty | ❌ | No validation at all |
| **Payment greater than balance** | 🐛 | Not rejected — the ledger-integrity bug, #1 above |
| Return qty greater than available stock | ✅ | Server-guarded, tested, covers the edit path too |
| **Double-click / duplicate confirmation** | 🐛 | Guarded only with an explicit shared batch number — see #2 above |
| Product deactivated after purchase | ✅ (by omission) | Old purchases stay viewable — but nothing stops a **new** purchase against an already-deactivated product either |
| Supplier deactivated after purchase | ✅ (by omission) | Same pattern — old purchases fine, but nothing blocks a **new** purchase against a deactivated supplier |

---

## 14. DEFINITION OF DONE — CURRENT VERDICT

Per the spec's own bar, Purchases + Purchase Returns are **not** done. Of the
14 conditions listed in the original spec, roughly half hold today:
inventory updates correctly on confirm, stock movements are traceable,
drafts don't touch stock/balances, partial returns work, negative-stock
returns are blocked, and reports mostly match transaction totals (aside from
the supplier-summary draft leak). The other half don't: payments don't
update balances *safely* (overpayment bug), returns can't create negative
stock but also can't be rejected or cancelled, credit notes can't really be
reconciled (no status, no CGST/SGST/IGST split), permissions aren't
enforced on every write path (stock adjust, backdating, export), audit logs
are half-populated, and duplicate submission isn't safe in the blank-batch
case.

---

## RECOMMENDED BUILD ORDER — SMALL BATCHES, NOT ONE SWEEP

Per the instruction that came with the spec: build only the missing or
partial items, in small batches. Suggested batch order, worst-impact first:

**Batch 1 — stop active bleeding (bugs, not features)**
1. Overpayment ledger bug (#1)
2. Double-confirm duplicate-stock bug (#2)
3. GST report broken render (#3)
4. ~~Dead Cash/Credit/Due filter pills (#4)~~ — ✅ done, Aug 26
5. Stock-adjust missing permission check (#5)

**Batch 2 — the flow that blocks day-one usage**
6. ~~Inline add-distributor during purchase entry~~ — ✅ done, Aug 25 (UC-P02)
6b. ~~Inline add-medicine during purchase entry~~ — ✅ done, Aug 26 (UC-P12)

**Batch 3 — Purchase Returns' core workflow gap**
7. Decide, with Abinash, whether Returns genuinely needs the full
   accept/reject/credit-pending lifecycle the spec describes, or whether
   the current single-step model is an intentional simplification worth
   keeping — this is a real product decision, not just missing code, and
   changes a lot downstream (credit notes, reports, analytics all assume
   an answer here).
8. Fix the 4 broken/missing return entry points (PR01) regardless of #7's answer.
9. Add the reason field and actually send it to the backend (PR03).

**Batch 4 — correction mechanisms**
10. Some controlled way to correct a confirmed purchase (P09).
11. Payment edit/reversal (P31).

**Batch 5 — reporting**
12. Wire the frontend to the already-built-but-unused `/analytics/purchases`
    endpoint before building anything new (cheap win).
13. Fix supplier-summary draft leak (P35).
14. Everything else in Reports/Analytics (P34, P37, P38, P40-43) — genuinely
    new work, prioritize with Abinash by which report a real pharmacist
    would ask for first.

Everything else in this document (unit-of-measure UI, per-line discount,
free-goods-in-returns, ageing buckets, etc.) is real but lower-impact —
sequence after the above with Abinash, not assumed.
