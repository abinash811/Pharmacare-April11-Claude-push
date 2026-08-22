# PharmaCare — Business Logic
# Version: 2.2 | Last updated: August 22, 2026
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
- Drug License check, Schedule H1 check, MRP check, and stock check are all
  skipped (drafts aren't finalized sales)

### GST Calculation (exact formula — verified against `create_bill`)

```python
# Per line item — all integers (paise)
mrp_paise        = int(unit_price_or_mrp_rupees * 100)   # now checked against batch.mrp_paise, see above
disc_percent     = item.get("disc_percent", item.get("discount_percent", 0))
disc_paise       = int(mrp_paise * quantity * disc_percent / 100)
taxable_paise    = mrp_paise * quantity - disc_paise
gst_rate         = item.get("gst_percent", bill.tax_rate or 5)   # 0, 5, 12, or 18
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
- Requires `original_bill_id` (or admin + an `allow_manual_returns` permission
  for a manual return not tied to a bill) — a return without a real originating
  bill is otherwise rejected with 400.
- Return quantity per item is validated against the original bill item's quantity
  — cannot return more than was sold.
- Stock is **restored** to the original batch (`quantity_on_hand += returned_qty`),
  unless the item is marked `is_damaged`, in which case it's *not* returned to
  stock (`return_to_stock=False` on the item, no quantity added back).
- A `StockMovement` is created with `movement_type="sales_return"`.
- Status is always `"completed"` on creation — there's no separate approval step.

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
    dispensed_by                    = user_id,
)
# prescriber_registration_number/address are only populated if doctor_name
# matches a real Doctor record (case-insensitive name lookup) — a free-text
# doctor name with no matching record still passes the H1 gate but leaves
# those two fields blank.
```

### Frontend rule
When the billing form contains a Schedule H1 drug:
- Show doctor name field as **required** (not optional)
- Block settlement if doctor name is empty
- Show clear message naming the H1 product that needs it

---

## FLOW 7 — PAYMENTS (for due bills)

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
- **Both sides**: sales (`bill_items` for `status="paid"` bills) *and*
  purchases (`purchase_items` for `status="confirmed"` purchases) in the date
  range — not sales-only as v1.0 implied.
- Grouped by **`gst_rate`** (0/5/12/18), not by HSN code — HSN isn't a
  grouping key anywhere in this endpoint.
- Returns `sales`, `purchases`, `sales_summary`, `purchases_summary`, and
  `net_liability` (`sales GST − purchases GST`, i.e. output tax minus input
  tax credit) — a real net-liability figure, useful for GSTR-3B.
- `igst` fields exist in the response shape (ready for interstate sales) but
  are always 0 today — no interstate flow exists in Phase 1, matching the
  "all sales intra-state" assumption.
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
| Change a settled bill | Immutable once stock is deducted — create a return instead | Yes — `PUT /bills/{id}` explicitly 400s unless `status == "draft"` |
| Sell above MRP | Illegal under DPCO | Yes — fixed Aug 22, 2026 (FLOW 1), checked against `batch.mrp_paise` |
| Bill H1 drug without doctor | Legal requirement | Yes — fixed Aug 22, 2026 (FLOW 6), checked for every item regardless of identifier |
| Sell more than a batch has on hand | Data integrity | Yes — fixed Aug 22, 2026 (FLOW 1), matches the guard manual adjustments (FLOW 9) already had |
| Store money as float | Rounding errors — always integer paise | Yes, throughout |
| Skip stock movement record | Every stock change must be traceable | Yes |

---

*When new business flows are built, document them here before writing code.*
*Owner: The developer building the feature writes the flow documentation first.*
*Re-audit this file against real code periodically — see the note at the top.*
