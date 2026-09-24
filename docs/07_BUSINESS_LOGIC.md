# PharmaCare — Business Logic
# Version: 2.18 | Last updated: September 24, 2026
# Type: Reference
# Audience: Claude, all developers
# Rule: Before implementing any feature that touches billing, inventory, purchases,
#        or compliance — read the relevant section here first.
#        Getting these flows wrong has financial and legal consequences.

---

## AUDITED AUGUST 22, 2026
> Version 1.0 (April 18, 2026) was written ahead of the code it described and had
> drifted badly — wrong routes, an entire sales-return flow that doesn't exist,
> a purchase-number format that was never implemented, and two compliance rules
> ("insufficient stock blocks a sale," "system enforces no-selling-above-MRP")
> that read as guaranteed but aren't actually enforced anywhere in the backend.
> Every flow below was re-verified against the real, running code (not memory,
> not the old doc) — `backend/routers/billing.py`, `sales_returns.py`,
> `purchases.py`, `purchase_returns.py`, `batches.py`, `reports.py`.
>
> The audit (v2.0) surfaced four real, live compliance gaps in
> `create_bill`/`get_gst_report` — no MRP-above check, no insufficient-stock
> guard on sales, an H1 doctor check with a hole depending on how an item was
> identified, and a GST report blind to returns. All four were fixed the same
> day (v2.1), each verified live against the running backend (not just unit
> tests) before being marked closed — see the "Fixed" callouts below in place
> of the original ⚠ GAP writeups. Any *new* gap found from here should follow
> the same pattern: called out inline, not silently written up as working.

---

## CRITICAL RULES (apply to everything)

1. **All money is integer paise.** ₹1 = 100 paise. Convert to rupees only for display.
2. **Soft deletes only.** Never `DELETE FROM` any table. Set `deleted_at` (not a boolean flag — see `docs/09_DATABASE.md`).
3. **Bill numbers assigned only at settlement.** Drafts get `DRAFT-{uuid}` placeholders.
4. **Stock deducted only at settlement.** Drafts do not touch stock.
5. **Snapshot billing.** Bill items store product name, MRP, GST rate at time of sale — never live references.
6. **Schedule H1 requires doctor.** Billing a Schedule H1 drug without a doctor name raises HTTP 400 — checked for every item regardless of whether it's identified by `product_sku`, `product_id`, or `batch_id` (fixed August 22, 2026; see FLOW 6).
7. **Audit every state change.** Bill creation, status changes, and payments are recorded in `audit_logs` (`old_values`/`new_values`, not just a message).

---

## FLOW 1 — BILLING (Sales)

### States

```
DRAFT → SETTLED (paid / due)
```

| State | Bill number | Stock | Editable |
|-------|------------|-------|----------|
| `draft` | `DRAFT-{8-char-uuid}` | Not deducted | Yes |
| `paid` | `INV-000042` (real sequence) | Deducted | No (only payment/status can change) |
| `due` | `INV-000042` (real sequence) | Deducted | No (only payment can be added) |

`partial` appears in `domainConstants.js`'s `BILL_STATUS` as `// Alias used in some older records` —
no code path writes it today; only `paid` and `due` are ever assigned.

### Step-by-step: Creating a settled bill

```
1. Frontend collects: customer, doctor (if H1), line items, discount, payment method
2. POST /api/bills with status="paid" (or "due")
3. Backend (routers/billing.py::create_bill):
   a. Drug License check (not in v1.0 of this doc): a non-draft SALE bill requires
      the pharmacy to have a non-blank, non-expired drug_license_number — else 400.
      Mirrors the frontend's proactive check (BillingWorkspace's
      DrugLicenseRequiredState) as a defense-in-depth backstop.
   b. For each item, once its batch/product is resolved: if the product is
      Schedule H1 → doctor name required or HTTP 400. Checked here (not in a
      separate product_sku-only pre-pass) so it applies no matter how the
      item is identified — **fixed August 22, 2026**; verified live that an
      item resolved via bare `product_id` (no `product_sku`) now correctly
      400s without a doctor name, where it previously slipped through.
   c. Generate bill number via _generate_bill_number() → sequential, atomic
   d. For each line item:
      - Resolve batch (_resolve_batch: by batch_id, then product_sku+batch_no,
        then FEFO — earliest-expiry batch with stock — for a bare product_id)
      - MRP check: if the submitted price exceeds `batch.mrp_paise` → HTTP 400
        (**fixed August 22, 2026** — previously the submitted price was
        trusted with no server-side check at all; verified live)
      - Expiry checks, gated on `Settings > Inventory`'s two toggles (real
        `PharmacySettings` columns as of **August 22, 2026** — previously
        UI-only, hardcoded `True` server-side, never enforced anywhere):
        if `block_expired_stock` (default on) and `batch.expiry_date` is in
        the past → HTTP 400. If `allow_near_expiry_sale` is off and the
        batch falls within `near_expiry_threshold_days` → HTTP 400. Both
        default to the pharmacy's previous (unenforced) behavior — on.
      - Snapshot: copy product_name, batch_number, expiry_date, hsn_code,
        drug_schedule, and the (now MRP-checked) price into the bill item
      - Calculate: disc_paise, taxable_paise, gst_paise, line_total_paise (all integers)
   e. Calculate bill totals (all paise):
      - subtotal = sum of taxable_paise per item
      - gst = sum of gst_paise per item (split equally into CGST + SGST,
        odd paise goes to SGST: sgst = gst - gst//2)
      - grand_total = subtotal + gst - bill_discount (rounded to nearest rupee)
   f. Determine status: paid if balance ≤ 0, due if balance > 0
   g. Deduct stock: batch.quantity_on_hand -= quantity for each item — raises
      HTTP 400 ("Insufficient stock...") if the batch doesn't have enough
      (**fixed August 22, 2026** — previously silently clamped to 0 instead
      of rejecting the sale; now matches batches.py::adjust_stock's guard)
   h. Create StockMovement record for each item (movement_type="sale")
   i. If item's product is Schedule H1: create ScheduleH1Register record
      (routers/billing.py::_create_h1_entry)
   j. Create AuditLog entry (action="create", entity_type="invoice")
4. Return settled bill with real bill number
```

### Step-by-step: Creating a draft

Same as above except:
- `status = "draft"` in request
- Bill number = `DRAFT-{uuid}` (no sequence consumed)
- Stock NOT deducted, no StockMovement, no H1 register entry
- Drug License check, Schedule H1 checks (doctor name **and** patient
  address — see FLOW 6), MRP check, and stock check are all skipped
  (drafts aren't finalized sales)

### Payment methods

`bills.payment_method` (free `String(20)`, no DB enum): `cash`, `upi`,
`credit_card`, `debit_card`, `multiple` (see Multi payment below). Selected
via `PAYMENT_METHOD` in `frontend/src/constants/domainConstants.js` —
`BillingSubbar.jsx`'s picker and `SplitPaymentPanel.jsx`'s split legs both
read from it, never a raw string.

`card`/`credit` were replaced by explicit `credit_card`/`debit_card` Sep 24,
2026 (Abinash, direct instruction). `credit` dated from when a bill could
carry a running due balance; once due bills were removed (Sep 19, 2026,
below) it only ever meant "paid by credit card," so it's now its own
explicit method instead of an ambiguous leftover next to the generic
`card`. Bills created before this change keep their stored `card`/`credit`
value — never rewritten (Manifesto rule 6) — and every display surface
(`StatusBadge`, `PrintReceipt`, Day-End Closing's `BreakdownTables`) still
renders a real label for them, it's just not a selectable option anymore.

### Multi payment (split across 2+ real methods)

Added Sep 16, 2026, rebuilding the Sep 13, 2026 "Multi" pill removal (it
recorded `payment_method: "multiple"` with zero trace of the real split —
worse than not offering it).

```
1. Frontend sends payments: [{method, amount}, {method, amount}, ...] — 2+ legs.
   A single-entry payments array (e.g. a due bill's paid-now amount) is
   unchanged prior behavior; this only activates for 2+ legs.
2. Backend (_resolve_payment_splits, shared by create_bill AND update_bill's
   finalize path — same function, so a change to one always reaches both):
   - Each leg's method must be one of cash/upi/card (not "due" — a due leg
     isn't a real settled instrument; combining Multi with Due is out of
     scope, not built) → else HTTP 400.
   - Each leg's amount must be > 0 → else HTTP 400.
   - The legs must sum to EXACTLY the bill's grand_total_paise → else HTTP 400
     naming the real vs. expected amount.
3. On success: bill.payment_method = "multiple", one BillPaymentSplit row per
   leg persisted (bill_id, payment_method, amount_paise), and the audit log's
   new_values carries the same breakdown (rupees) under "payment_splits" —
   this is what Day-End Closing reads, not the BillPaymentSplit table
   directly (see Day-End Closing note below).
4. GET /api/bills/{id} and the create/update response both return
   payment_splits: [{method, amount}, ...] (rupees) alongside the bare
   payment_method="multiple" — every display surface (printed receipt,
   BillDetail, downloaded PDF, BillingOperations list) renders this real
   breakdown instead of the bare word "multiple"/"MULTIPLE".
```

**Cross-cutting consumers checked and fixed in the same change (Manifesto
rule 11)** — found before any frontend UI existed to trigger them:
- **Day-End Closing** (`reports.py _day_end_breakdown`) explodes a Multi
  bill's audit-logged `payment_splits` into its own per-method buckets
  instead of lumping the whole amount under a meaningless "multiple" key —
  otherwise a ₹1000 Multi bill (₹400 cash + ₹600 card) would misattribute
  ₹1000 to a bucket nobody can reconcile against the physical cash drawer.
- **Sales returns'** `same_as_original` resolution (`_resolve_refund_and_credit`
  in sales_returns.py) falls back to `"cash"` when the original bill's
  `payment_method == "multiple"`, instead of persisting the invalid literal
  `"multiple"` as a `refund_method`.
- **`update_bill`'s finalize path never wrote an audit log entry at all**
  before this change — found as a necessary dependency for Day-End Closing
  to see ANY finalized-draft's payment (multi or not), fixed alongside.

### GST Calculation (exact formula — verified against `create_bill`)

```python
# Per line item — all integers (paise)
mrp_paise        = int(unit_price_or_mrp_rupees * 100)   # now checked against batch.mrp_paise, see above
disc_percent     = item.get("disc_percent", item.get("discount_percent", 0))
disc_paise       = int(mrp_paise * quantity * disc_percent / 100)
taxable_paise    = mrp_paise * quantity - disc_paise
gst_rate         = item.get("gst_percent", bill.tax_rate or default_gst_rate)   # 0, 5, 12, or 18
# default_gst_rate is NOT a hardcoded 5 — it's PharmacySettings.default_gst_rate
# (Settings → Tax & GST, per-pharmacy configurable, model default 5.00), read
# fresh at the top of create_bill/update_bill (billing.py:502). Corrected
# Sep 19, 2026 — this line previously showed a literal `or 5`, which was only
# true for a pharmacy that never touched that setting.
line_gst_paise   = int(taxable_paise * gst_rate / 100)
line_total_paise = taxable_paise + line_gst_paise

# GST splits (intra-state sales only — no interstate flow exists yet)
cgst_paise = line_gst_paise // 2
sgst_paise = line_gst_paise - cgst_paise   # odd paise goes to SGST

# Bill total
grand_total_paise = subtotal_paise + total_gst_paise - bill_discount_paise
grand_total_paise = round(grand_total_paise / 100) * 100  # round to nearest rupee
```

**Never use floating point for any of these calculations.**

### Bill Number Generation

```python
# _generate_bill_number() in backend/routers/billing.py
# Reads PharmacySettings.bill_prefix / bill_number_length / bill_sequence_number
# (configurable in Settings > Bill Sequence), increments atomically in the
# same transaction. Format: {PREFIX}-{zero_padded_number}. Default: INV-000042.
```

### Margin Calculation

```python
margin_paise   = grand_total_paise - cost_total_paise
margin_percent = (margin_paise / grand_total_paise * 100) if grand_total_paise > 0 else 0
```

Stored on the bill for reporting. `cost_total_paise` = sum of `batch.cost_price_paise × quantity`.

---

## FLOW 2 — SALES RETURN

> Rewritten entirely — v1.0 described a `POST /api/invoices` flow with an
> `RTN-` prefix that does not exist anywhere in the real system.

### The real flow: `POST /api/sales-returns`

Sales returns are their **own resource** (`routers/sales_returns.py`,
`SalesReturn`/`SalesReturnItem` models) — a separate table from `bills`, not a
special `invoice_type` on a bill. This is what the frontend actually calls
(confirmed: no frontend code anywhere posts a bill with `invoice_type=SALES_RETURN`).

- Return number prefix: **`CN-`** (credit note — GST requires returns to be their
  own gapless numbered series), from `PharmacySettings.return_prefix` /
  `return_sequence_number` / `return_number_length`, same atomic-counter pattern
  as bill numbers. Configurable in Settings > Bill Sequence > Sales Return.
- **Manual returns — built Sep 15, 2026, removed Sep 23, 2026:** a return
  used to be filable with no originating bill at all (gated by the
  `allow_manual_returns` permission + the `require_original_bill` Settings
  toggle). Removed as a direct product decision: nothing tied a manual
  return's quantity or refund amount to an actual prior sale — a real
  fraud/leakage surface, not just an edge case. `POST /sales-returns` now
  unconditionally 400s ("A return must be created from an existing bill…")
  when `original_bill_id` is missing, for every role including admin,
  regardless of the (now-dormant) `require_original_bill` setting.
  `original_bill_id`/`bill_item_id` are left nullable in the schema and
  `allow_manual_returns`/`require_original_bill` left in place (harmless,
  unread) rather than migrated out. `ManualItemSearch.tsx` deleted.
  Frontend, same day, direct follow-up instruction: `SalesReturnCreate`
  with no `billId` in the URL shows an inline bill search (`BillPicker.tsx`,
  reuses `GET /bills`'s own `search` param — the same lookup Billing's own
  list page uses) instead of a redirect — a cashier picks the bill right
  there, no detour through Billing. Only completed sales are selectable
  (`status` not in `draft`/`parked`, filtered client-side); a **due** bill
  is deliberately still pickable, since the due-balance-credit flow just
  above has no other way in. Picking a result navigates to
  `?billId=<id>` on the same page, which then loads exactly like it
  always has. `SalesReturnsList`'s "New Return" goes straight to
  `/billing/returns/new` — the picker there is now the one way in.
- **Return quantity cap is cumulative, not per-request (fixed Sep 23,
  2026):** `create_sales_return` only ever checked a new return's quantity
  against the original bill's quantity, never against how much had
  already been returned in an earlier, separate return on the same bill —
  two separate returns could each claim the full original quantity and
  both would be accepted. `update_sales_return` (financial edit) had **no**
  quantity validation at all. Both now compute `max_returnable =
  original_qty - sum(quantity across every existing SalesReturnItem tied
  to the same original_bill_id, matched by batch_number)` and 400 if the
  request exceeds it — the same `already_returned_qty`/`max_returnable_qty`
  pattern `purchase_returns.py`'s `create_purchase_return` already used.
  For a financial edit, the sum is computed *after* the edited return's own
  old items are deleted (see the code just above), so an edit isn't capped
  against its own prior quantity.
- **A return does not adjust the original bill's own total, and most
  revenue reports don't net returns out either — direct product decision,
  Sep 23, 2026, not a bug.** Walked through with a concrete example (₹1,000
  bill, ₹500 returned): confirmed the Billing list, the printed/reprinted
  bill, and `BillORM.grand_total_paise` itself are never touched by a
  return (only `amount_paid_paise`/`balance_paise`/`status` change, and
  only to credit a due balance — a no-op on an already-fully-paid bill).
  Dashboard's `today_sales`/`total_sales` and the Sales report's totals
  likewise sum `grand_total_paise` with no return subtraction, and the
  Margin report computes revenue/margin from bill line items alone, same
  gap. Decision: **keep it this way** — "bills and returns should tally,"
  i.e. a bill is a fixed historical record of what was sold, a return is
  its own fixed historical record of what came back, and the two are read
  side by side rather than one silently netting into the other. Two
  things this decision does **not** cover, already correct and unchanged:
  the **GST report** already nets a return's taxable amount/GST out of
  the period's output tax (see the "Sales returns (credit notes) reduce
  output GST" block above) — a real compliance requirement, not a revenue
  rollup, so it stays netted. **Inventory** already restores real stock
  quantity on a return (`_restore_stock`, `StockMovement` "sales_return")
  — also unaffected by this decision; it was never in question.
- **Dashboard now has one deliberate exception — a Sales (Month) summary
  card (built Sep 23, 2026, same-day direct follow-up):** the Quick Stats
  row's old standalone "Returns (Month)" tile was replaced with a small
  Sales/Returns/Net table (`SalesReturnsSummaryCard.tsx`) showing all
  three side by side for the current month only — Dashboard's other tiles
  (Today's/Week/Month/Total Sales) are untouched and still gross, per the
  decision above. Building this surfaced a real, separate bug: `quick_stats
  .month_returns` (and `daily_trend`'s per-day `"returns"`) were computed
  from `Bill.invoice_type == "SALES_RETURN"` — a condition no real code
  path has ever set (sales returns are their own resource, never a Bill
  row) — so this figure was always 0 for every real pharmacy, regardless
  of how many actual returns existed. Fixed in `get_dashboard_analytics`
  to sum real `SalesReturn` rows instead (same query shape the GST report
  already used correctly); `quick_stats` gained `month_sales`/`net_sales`
  so the new card has a real net figure. 2 new backend regression tests
  (`test_dashboard_analytics.py::TestDashboardMonthReturnsAndNetSales`),
  confirmed to fail against the pre-fix code (`KeyError` — the fields
  didn't exist) via `git stash`.
- **Cross-cutting fix (Sep 15, 2026, now moot):** `get_product_transactions`
  (`inventory.py`)'s outer join on `Bill` (added because a manual return
  had no bill to inner-join against) is unchanged and harmless now that no
  new manual returns can be created — any pre-existing one still displays
  correctly (`original_invoice: None`, `customer_name: "Walk-in"`).
- Return quantity per item is validated against the original bill item's quantity
  — cannot return more than was sold.
- Stock is **restored** to the original batch (`quantity_on_hand += returned_qty`),
  unless the item is marked `is_damaged`, in which case it's *not* returned to
  stock (`return_to_stock=False` on the item, no quantity added back).
- A `StockMovement` is created with `movement_type="sales_return"`.
- Status is always `"completed"` on creation — there's no separate approval step.
- **Due-balance credit (built Sep 15, 2026):** if the original bill still has
  money owed (`Bill.status == "due"`), the return's value always credits that
  balance first — `_resolve_refund_and_credit()` in `sales_returns.py`, applied
  unconditionally regardless of the caller's `refund_method`, so it can't be
  bypassed by picking Cash on a due bill. `min(return_grand_total, bill.balance_paise)`
  is added to `Bill.amount_paid_paise` (same field `POST /payments` already
  mutates) and `balance_paise` recomputed from it; the bill flips to `"paid"` if
  that clears it. Only a genuine leftover (the return is worth more than what
  was still owed) is an actual cash/UPI refund, and `refund_method` is stored as
  whichever concrete method covers that leftover — `"credit_to_account"` when the
  due balance absorbs the whole return, otherwise the caller's method (or the
  original bill's own `payment_method` for `"same_as_original"`). The credited
  amount is stored on the return itself (`SalesReturn.credit_applied_paise`) so a
  later financial edit (`update_sales_return?financial_edit=true`) can reverse
  exactly that amount before recalculating and reapplying — same reverse-then-
  rebuild shape already used for stock in that function. Both create and the
  financial-edit path now call `_record_audit()` — `sales_return` entity for the
  return itself, plus a `return_credit`/`return_credit_adjusted` action (never
  `"payment"`) on the `invoice` entity, so Day-End Closing's cash reconciliation
  (FLOW 1, reads only `create`/`payment` invoice-audit actions) never mistakes a
  returned-goods credit for real cash collected that day.
- **Entry point (fixed Sep 15, 2026):** a real `BillDetail` "Return Items" button
  (any non-parked bill) → `/billing/returns/new?billId=`. Before this there was
  no reachable UI path to file a return against a finalized bill at all — see
  the Billing row in `docs/15_ROADMAP.md` for the full history.

```
1. POST /api/sales-returns
   { original_bill_id, return_date, items: [{ product_sku, medicine_name,
     batch_no, mrp, qty, original_qty, gst_percent, is_damaged }], refund_method }
2. Backend (create_sales_return):
   a. Validate original bill + item quantities
   b. Generate CN-XXXXX credit-note number (_generate_credit_note_number)
   c. For each item: resolve batch, restore stock unless is_damaged,
      create StockMovement(movement_type="sales_return")
   d. status = "completed"
3. Return the credit note
```

### ⚠ GAP — dead/parallel code path: `POST /api/bills` with `invoice_type=SALES_RETURN`

`create_bill` in `billing.py` *does* have a branch for `invoice_type == "SALES_RETURN"`
(accepts a `refund` object, forces `status="paid"`) — but it numbers the result
with the ordinary `INV-` sequence, never `return_prefix`, and nothing in the
frontend ever calls it this way. It looks like an earlier design that was
superseded by `/sales-returns` and never removed. Don't build on it; treat
`/sales-returns` as the only real sales-return path. (`backend/tests/test_bill_sequence.py::TestSalesReturnSequence`
documents this exact gap with a `pytest.skip`.)

### Fixed August 22, 2026 — the GST report now sees returns

See FLOW 8 — `GET /reports/gst` used to only scan `bills`/`bill_items`, never
`sales_returns`/`sales_return_items`, so a credit note had zero effect on the
report. Now subtracts each return's taxable/GST amounts from the matching
`gst_rate` bucket — verified live: issuing a ₹22.40 credit note against a
₹20 taxable / ₹2.40 GST sale moved the report's `total_taxable` down by
exactly ₹20 and `total_gst` down by exactly ₹2.40 in the same run.

---

## FLOW 3 — PURCHASES (Stock In)

### States

```
DRAFT → CONFIRMED
```

| State | Stock | Batches created | Editable |
|-------|-------|----------------|----------|
| `draft` | Not added | No | Yes |
| `confirmed` | Added to inventory | Yes | No |

### Step-by-step: Confirming a purchase

```
1. Frontend collects: supplier, invoice number, invoice date, line items
2. POST /api/purchases with status="confirmed"
3. Backend (_create_stock_for_items):
   a. For each line item:
      - Create new StockBatch record:
          batch_number = item.batch_no or "PUR-{purchase_number[:8]}"
          expiry_date  = item.expiry_date (defaults to +365 days if omitted)
          quantity_on_hand = item.qty_units
          mrp_paise    = int(item.mrp_per_unit * 100)
          cost_price_paise = int(ptr * 100)   ← see Cost Price below, no trade discount involved
      - Create StockMovement (movement_type="purchase", quantity=+qty)
      - Link batch to purchase item (item.batch_id = batch.id)
   b. Create AuditLog entry
```

### Cost Price Calculation at Purchase

> v1.0 described a `trade_discount` field that does not exist on `PurchaseItemCreate`.

```python
# routers/purchases.py::create_purchase
ptr = item_data.ptr_per_unit if item_data.ptr_per_unit else item_data.cost_price_per_unit
cost_price_paise = int(ptr * 100)
# This becomes batch.cost_price_paise — used for margin calc in billing.
# There is no separate trade-discount step; whatever PTR (or cost_price_per_unit
# as a fallback) the pharmacist enters is stored as-is.
```

`order_type`, `with_gst` (as a *stored* flag — it does control the GST calc at
creation time), and `batch_priority` (LIFA/LILA) are all accepted on the request
but **not persisted or echoed back anywhere** — no columns exist for any of the
three on `Purchase`/`PurchaseItem`. `PurchaseItem` also has no `landing_price_per_unit`
rollup onto `Product` — confirming a purchase updates that *batch's* own cost
price only. All three are documented as known gaps, not implemented, in
`backend/tests/test_purchases_module.py`.

### Purchase entry — Pack / Unit (built Sep 24, 2026)

The backend has only ever accepted/stored real per-unit values
(`qty_units`/`cost_price_per_unit`/`mrp_per_unit`, per tablet or per ml —
`StockBatch` quantities are real units, migration `a343c922f896`) — that
part was always correct. What was missing: the Purchase entry screen
forced the pharmacist to type in those same real-unit terms even though a
supplier invoice is written per strip/bottle, so buying "10 strips of 10
tablets at ₹30/strip" meant manually computing ₹3.00/tablet by hand.

Fixed entirely on the frontend, no backend/schema change (the API contract
above is unchanged) — `frontend/src/pages/PurchaseNew/utils/packUnitConversion.js`:
- Each purchase line gets a Pack/Unit toggle (`PurchaseItemsTable.jsx`),
  shown only when the product's `units_per_pack` > 1 — a product with no
  real pack (`units_per_pack` = 1) has nothing to toggle.
- Defaults to Pack mode for any product with a pack (`defaultQtyModeFor`).
- In Pack mode, Qty/PTR/MRP are typed exactly as printed on the supplier's
  invoice (per strip/bottle); a small line under each field shows the
  live-computed real per-unit equivalent, so nothing is hidden.
- `buildPurchasePayload.js` converts to real units right before the
  existing, unchanged `POST/PUT /purchases` call — the backend never knows
  a Pack-mode line existed.
- Switching Pack ↔ Unit mid-entry re-expresses the same real quantity/cost/
  MRP in the new mode's units (`convertQtyMode`) — it never silently
  changes what the line is actually worth.
- A saved draft, loaded back for editing, always starts in Unit mode —
  its stored values are already real, and which mode was originally used
  to type them isn't persisted (a deliberate, honest limitation, not a bug).
- `GET /purchases/{id}`'s per-item response now also returns
  `units_per_pack` (was stored at confirm time, never returned before) —
  see `docs/10_API.md`.

### Purchase Number Generation

```python
# _generate_purchase_number() in backend/routers/purchases.py
# Format: PUR-{year}-{4-digit sequential number}, e.g. PUR-2026-0001
# (v1.0 claimed a per-day date-based format, PUR-YYYYMMDD-XXXX — that was
# never implemented; the real sequence is per-year, not per-day.)
```

---

## FLOW 4 — PURCHASE RETURN

> Rewritten — v1.0 described this as "a new purchase with invoice_type =
> PURCHASE_RETURN," which isn't how it works.

### The real flow: `POST /api/purchase-returns`

Its own resource (`routers/purchase_returns.py`, `PurchaseReturn`/
`PurchaseReturnItem` models) — not a purchase record at all.

- Requires a real `purchase_id` + `supplier_id`; return quantity per item is
  validated against that purchase's original quantity minus anything already
  returned against it (keyed by `product_name`, scoped to that one purchase).
- Stock is **deducted** from the batch (`quantity_on_hand -= returned_qty`,
  tracked separately in `quantity_returned`).
- A `StockMovement` is created with `movement_type="purchase_return"`.
- Status is always `"confirmed"` on creation, same as sales returns — no draft
  state for purchase returns despite the doc originally implying one.
- `return_reason` is required on the model (`String(50)`, `nullable=False`) —
  defaults to `"return"` if the request omits it.

```
1. POST /api/purchase-returns
   { supplier_id, purchase_id, return_date, reason,
     items: [{ product_sku, product_name, batch_no, qty_units,
     cost_price_per_unit, gst_percent, reason }] }
2. Backend (create_purchase_return):
   a. Validate return quantities against the original purchase + prior returns
   b. Generate PRET-{year}-{seq} return number (_generate_return_number)
   c. For each item: resolve batch, deduct stock, create
      StockMovement(movement_type="purchase_return")
   d. status = "confirmed"
```

### Fixed August 22, 2026 — GST input credit reversal now reflected

Same shape of gap as FLOW 2, fixed the same way: `GET /reports/gst`'s
purchases side now also subtracts `purchase_return_items` from the matching
`gst_rate` bucket, so a purchase return correctly reduces the reported input
tax credit instead of leaving it untouched.

---

## FLOW 5 — INVENTORY & STOCK MOVEMENTS

### Every stock change creates a StockMovement record

No stock changes silently — every addition or deduction is logged (with one
caveat: see the "no insufficient-stock guard" gap under FLOW 1 — the sale can
still happen even when a StockMovement is later created for a quantity the
batch didn't have).

| Movement type | Triggered by | qty effect |
|--------------|--------------|-----------|
| `purchase` | Purchase confirmed | `+qty` |
| `sale` | Bill settled | `-qty` |
| `sales_return` | Sales return created | `+qty` (unless item marked damaged) |
| `purchase_return` | Purchase return created | `-qty` |
| `adjustment` | Manual stock adjustment (`POST /batches/{id}/adjust`) | `+qty` or `-qty` |

`opening_stock` (bulk upload / manual batch entry) is **not** a real
`movement_type` seen in the code paths audited here — don't assume it exists
without checking the specific creation path first.

### StockMovement schema (verified field names)

```python
StockMovement(
    pharmacy_id     = pharmacy_id,
    product_id      = product.id,
    batch_id        = batch.id,
    movement_type   = "sale",              # see table above
    quantity        = -5,                  # signed: negative for deductions
    quantity_before = old_qty,
    quantity_after  = new_qty,
    reference_type  = "invoice",           # NOT "bill" — verified string literal
    reference_id    = bill.id,
    user_id         = user_id,             # NOT "performed_by" — that field doesn't exist
    notes           = "...",
)
```

### Batch quantity_on_hand rule

**Enforced for manual adjustments** (`batches.py::adjust_stock`), **not enforced
for sales** (see FLOW 1's gap):

```python
# batches.py — the real, working guard
if new_qty < 0:
    raise HTTPException(400, detail=f"Cannot remove {qty}. Only {available} units available.")
```

### FEFO (First Expired First Out)

When a bill item resolves a batch by bare `product_id` (no explicit `batch_id`
or `batch_no`), `_resolve_batch` in `billing.py` picks the batch with stock
whose `expiry_date` is earliest:

```python
select(BatchORM).where(BatchORM.product_id == pid, BatchORM.quantity_on_hand > 0,
                       BatchORM.is_active).order_by(BatchORM.expiry_date).limit(1)
```

This only applies when the caller doesn't already specify a batch — an explicit
`batch_id`/`batch_no` on the request always wins.

---

## FLOW 6 — SCHEDULE H1 REGISTER

### What it is
An auto-generated compliance register for every Schedule H1 drug sale.
Drug inspectors can inspect this register (`GET /api/compliance/schedule-h1-register`,
restricted to admin/manager roles). Errors have legal consequences.

### When a ScheduleH1Register entry is created
- On every settled (non-draft) bill with `invoice_type="SALE"` containing an
  item whose product has `drug_schedule = "H1"`
- One entry per H1 item per bill (`billing.py::_create_h1_entry`)
- NOT created for drafts, and NOT created for `SALES_RETURN`-type bills

### Patient address is also required — added here Sep 19, 2026, was undocumented

**Real, currently-enforced check this doc never described.** Alongside the
doctor-name check below, `create_bill` (`billing.py:572-576`) and
`update_bill`'s finalize path (`billing.py:932-933`) both also reject a
Schedule H1 sale with HTTP 400 ("Patient address required for Schedule H1
drug: ...") if `patient_address` is blank — same standing as the doctor
check (Schedule H1 Rule 65: patient name **and** address recorded at time
of supply), same exemption for drafts, same parity between `create_bill`
and `update_bill`'s finalize path. A saved `Customer` record's own address
isn't used as a fallback — `customer_name` is frequently just "Walk-in
Customer" with no linked record, exactly the one-off sale this rule
exists for, so the caller must supply `patient_address` explicitly on the
request. Frontend: `ScheduleHWarning.jsx` / `useBillActions.js` /
`buildBillPayload.js` already wire this through — this is a real,
complete, shipped feature, just never written up here until now. Added to
the "What is recorded" field list, the "skipped for drafts" list, the
frontend rule bullets, and the WHAT CANNOT BE DONE table in this same edit.

### Fixed August 22, 2026 — the H1 doctor-required check now covers every item

Previously implemented as a separate pre-pass that only looked items up by
`product_sku` — an item built from `product_id`/`batch_id` instead (a valid
way to resolve a batch, see FLOW 1) silently skipped the check. Moved the
check into the main per-item loop, right after `_resolve_batch` resolves the
real product (see FLOW 1, step 3b), so it applies no matter which identifier
the item carries. Verified live: a bill item identified purely by
`product_id` for an H1 product, with no doctor name, now correctly 400s with
"Prescription details required for Schedule H1 drug: ..." — it previously
would have gone through.

**A second gap in the same fix, found and closed the same day**: `create_bill`
isn't the only path that can turn a bill into a real, finalized sale —
`PUT /bills/{id}::update_bill` can too, by editing a draft's `status` to
`"paid"` (`is_finalizing`). The insufficient-stock guard was covered there
for free (both paths call the same `_deduct_stock_and_record`), but the H1
and MRP checks were only added to `create_bill` — `update_bill` had neither,
so finalizing a draft via PUT could still bill an H1 drug with no doctor or
finalize above MRP. Added the same two checks to `update_bill`'s item loop,
gated on `is_finalizing and invoice_type == "SALE"`. Verified live: both a
no-doctor H1 finalize and an above-MRP finalize now 400 through `PUT
/bills/{id}`, the same as they do through `POST /bills`.

### What is recorded (verified field names — several differ from v1.0)

```python
ScheduleH1Register(
    pharmacy_id                     = pharmacy_id,
    bill_id                         = bill.id,
    bill_item_id                    = bill_item.id,
    product_id                      = product.id,
    product_name                    = product.name,
    quantity                        = item.quantity,
    batch_number                    = batch.batch_number,
    prescriber_name                 = doctor_name or "N/A",
    prescriber_registration_number  = doctor.registration_number or doctor.phone or "",
    prescriber_address              = doctor.address or "",
    patient_name                    = customer_name or "Walk-in Customer",
    patient_address                 = patient_address,
    patient_age                     = patient_age,
    dispensed_by                    = user_id,
)
# patient_address/patient_age were missing from this field list entirely —
# corrected Sep 19, 2026. Both are real columns (backend/models/billing.py)
# populated straight from create_bill's own params (see _create_h1_entry,
# billing.py:329-368) — patient_address is the same value the required-check
# above validates isn't blank, patient_age is optional (no check requires it).
# prescriber_registration_number/address are only populated if doctor_name
# matches a real Doctor record (case-insensitive name lookup) — a free-text
# doctor name with no matching record still passes the H1 gate but leaves
# those two fields blank.
```

### Frontend rule
When the billing form contains a Schedule H1 drug:
- Show doctor name field as **required** (not optional)
- Show patient address field as **required** (not optional) — added here
  Sep 19, 2026, real and shipped (`ScheduleHWarning.jsx`), just previously
  undocumented alongside the doctor-name rule
- Block settlement if doctor name or patient address is empty
- Show clear message naming the H1 product that needs it

---

## FLOW 7 — PAYMENTS (for due bills)

### Creating a due bill (reinstated Sep 15, 2026)

`create_bill`/`update_bill` set `status = "due"` when `balance_paise > 0`
after payment, subject to two checks:
- **A real `customer_id` is required.** No customer (walk-in) → HTTP 400.
  There must be someone to collect from later.
- **`_check_credit_limit`** (billing.py) blocks the bill if the customer's
  `credit_limit_paise` is set (> 0) and this bill would push their total
  outstanding `due` balance over it. `credit_limit_paise == 0` means no
  limit configured — unlimited due is allowed.

### When a bill has `status = "due"`

A bill is "due" when `balance_paise > 0` after creation. The pharmacist
records payment later via `POST /api/payments`:

```
POST /api/payments
{
  "invoice_id": "bill-uuid",
  "amount": 450.00,
  "payment_method": "upi",
  "reference_number": "UPI-ref-123"
}
```

### Validation (added Sep 15, 2026, alongside the real Collect Payment UI)
`POST /api/payments` rejects, before writing anything:
- the bill's current `status` is not `"due"` (nothing to collect)
- `amount <= 0`
- `amount` exceeds the bill's current `balance_paise`

### Payment status transitions (verified against `create_payment`)

```python
new_paid    = bill.amount_paid_paise + payment_paise
new_balance = max(0, bill.grand_total_paise - new_paid)
new_status  = "paid" if new_balance <= 0 else "due"
```

Two audit log entries are written: one `action="payment"`, and — only if the
status actually changed — a second `action="status_change"` capturing
old/new status and old/new due amount.

### Payment methods
`cash` | `upi` | `card` | `credit` | `cheque`

---

## FLOW 8 — GST REPORT

> Substantially different from v1.0's description — verified against
> `GET /reports/gst` in `routers/reports.py`.

### What it actually covers
- **Both sides**: sales (`bill_items` for `status IN ("paid", "due")` bills
  — corrected here Sep 19, 2026, this line previously said `paid`-only,
  stale since the credit-sale fix below landed) *and* purchases
  (`purchase_items` for `status="confirmed"` purchases) in the date range
  — not sales-only as v1.0 implied.
- Grouped by **`gst_rate`** (0/5/12/18), not by HSN code — HSN isn't a
  grouping key anywhere in this endpoint.
- Returns `sales`, `purchases`, `sales_summary`, `purchases_summary`, and
  `net_liability` (`sales GST − purchases GST`, i.e. output tax minus input
  tax credit) — a real net-liability figure, useful for GSTR-3B.
- `igst` fields exist in the response shape (ready for interstate sales) but
  are always 0 today — no interstate flow exists in Phase 1, matching the
  "all sales intra-state" assumption.
- **Added Sep 19, 2026**: `purchases_summary.cess` — sums `Purchase.
  cess_paise` (an invoice-level field entered via Purchases' Invoice
  Breakdown, not itemized per GST rate — no per-item cess column exists)
  for confirmed purchases in the date range. Previously captured and
  stored but never appeared anywhere in this report at all.
- **Fixed August 22, 2026**: also queries `sales_return_items` (by
  `SalesReturn.return_date` in range) and `purchase_return_items` (by
  `PurchaseReturn.return_date` in range), subtracting each return's
  taxable/GST amounts from the matching `gst_rate` bucket. Previously
  neither was queried at all, so a credit note or a purchase return had zero
  effect on the report's numbers — verified live that the numbers now
  reconcile exactly after issuing a return (see FLOW 2 and FLOW 4).

---

## FLOW 9 — STOCK ADJUSTMENT (Manual)

### When used
- Opening stock entry, correction after a physical stock count, damaged/expired write-off

### Rules (verified, matches v1.0 closely — this flow was accurate)
- `POST /batches/{batch_id}/adjust` creates a `StockMovement` with
  `movement_type = "adjustment"`
- Requires a `reason` (stored as the movement's `notes`)
- **Does** reject a negative result (`400`, with the available-units count in
  the message) — this is the one stock-mutating path in the codebase that
  actually has the guard the other flows are missing
- `POST /batches/{batch_id}/writeoff-expiry` is a related, separate endpoint
  for expired-stock write-off specifically (not mentioned in v1.0 at all)

---

## MONEY CALCULATION REFERENCE

Always work in paise. Convert to rupees only at the API response boundary.

```python
# ✅ Correct — integer paise throughout
mrp_paise      = int(12.50 * 100)           # 1250
quantity       = 5
disc_paise     = int(1250 * 5 * 0.10)       # 625  (10% discount)
taxable_paise  = 1250 * 5 - 625             # 5625
gst_paise      = int(5625 * 0.05)           # 281  (5% GST)
total_paise    = 5625 + 281                 # 5906

# API response (divide by 100)
"total_amount": total_paise / 100           # 59.06

# ❌ Wrong — float calculations
mrp    = 12.50
total  = mrp * 5 * 1.05                     # 65.625 — float rounding issues
```

---

## AUDIT LOG

### AuditLog schema (verified — matches v1.0)
```python
AuditLog(
    pharmacy_id  = pharmacy_id,
    user_id      = current_user.id,
    action       = "create" | "payment" | "status_change" | ...,   # free-text, not an enum
    entity_type  = "invoice" | "batch" | "product" | "purchase" | "user",
    entity_id    = entity.id,
    old_values   = { ... } | None,
    new_values   = { ... } | None,
)
```
`action`/`entity_type` are plain strings on the model, not a constrained enum —
match existing call sites' conventions rather than inventing new values.

**Never skip audit logging for compliance-sensitive actions.**

---

## WHAT CANNOT BE DONE (hard rules) — and which ones are actually enforced

| Action | Why forbidden | Actually enforced in code? |
|--------|--------------|------|
| Hard delete a bill | Legal document — must exist forever | Yes — no DELETE route on bills |
| Hard delete a batch | Drug recall tracking requires batch history | Yes — soft delete only |
| Reuse a bill number | Sequential numbering is a legal requirement | Yes — UNIQUE(pharmacy_id, bill_number) + atomic sequence |
| Change a settled bill after its edit window | GST law forbids silently altering an issued invoice; stock/audit trail must stay real | Yes — `PUT /bills/{id}` allows a same-day correction to a paid/due bill (items/pricing only; payment amount/method preserved, stock reversed+reapplied, audit-logged as `financial_edit`) but 400s once a Sales Return already exists against it, or once that day's Day-End Closing has run. Decided/built Sep 18, 2026 — see `docs/15_ROADMAP.md`'s Billing table |
| Sell above MRP | Illegal under DPCO | Yes — fixed Aug 22, 2026 (FLOW 1), checked against `batch.mrp_paise` |
| Bill H1 drug without doctor name or patient address | Legal requirement (Schedule H1 Rule 65) | Yes — doctor-name check fixed Aug 22, 2026, checked for every item regardless of identifier; patient-address check also real and enforced identically (both `create_bill` and `update_bill`'s finalize path) but was undocumented here until Sep 19, 2026 — see FLOW 6 |
| Sell more than a batch has on hand | Data integrity | Yes — fixed Aug 22, 2026 (FLOW 1), matches the guard manual adjustments (FLOW 9) already had |
| Sell expired stock (when `block_expired_stock` is on) | Drug safety / compliance | Yes — fixed Aug 22, 2026 (FLOW 1). Previously a Settings toggle that did nothing — hardcoded `True` server-side, never checked at billing |
| Sell near-expiry stock (when `allow_near_expiry_sale` is off) | Pharmacy policy choice, opt-in per pharmacy | Yes — fixed Aug 22, 2026 (FLOW 1), same fix as above. When allowed (the default), no warning is shown yet — real gap, not built |
| Store money as float | Rounding errors — always integer paise | Yes, throughout |
| Skip stock movement record | Every stock change must be traceable | Yes |

---

*When new business flows are built, document them here before writing code.*
*Owner: The developer building the feature writes the flow documentation first.*
*Re-audit this file against real code periodically — see the note at the top.*
