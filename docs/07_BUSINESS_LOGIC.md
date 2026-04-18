# PharmaCare — Business Logic
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Before implementing any feature that touches billing, inventory, purchases,
#        or compliance — read the relevant section here first.
#        Getting these flows wrong has financial and legal consequences.

---

## CRITICAL RULES (apply to everything)

1. **All money is integer paise.** ₹1 = 100 paise. Convert to rupees only for display.
2. **Soft deletes only.** Never `DELETE FROM` any table. Set `is_deleted = True`.
3. **Bill numbers assigned only at settlement.** Drafts get `DRAFT-{uuid}` placeholders.
4. **Stock deducted only at settlement.** Drafts do not touch stock.
5. **Snapshot billing.** Bill items store product name, MRP, GST rate at time of sale — never live references.
6. **Schedule H1 requires doctor.** Billing a Schedule H1 drug without a doctor name raises HTTP 400.
7. **Audit every state change.** Every status change, stock movement, and payment is recorded in `audit_logs`.

---

## FLOW 1 — BILLING (Sales)

### States

```
DRAFT → SETTLED (paid / due / partial)
```

A bill moves through two states. There is no going back from settled.

| State | Bill number | Stock | Editable |
|-------|------------|-------|----------|
| `draft` | `DRAFT-{8-char-uuid}` | Not deducted | Yes |
| `paid` | `INV-000042` (real sequence) | Deducted | No |
| `due` | `INV-000042` (real sequence) | Deducted | No (only payment can be added) |
| `partial` | `INV-000042` (real sequence) | Deducted | No |

### Step-by-step: Creating a settled bill

```
1. Frontend collects: customer, doctor (if H1), line items, discount, payment method
2. POST /api/invoices with status="paid" (or "due")
3. Backend:
   a. Pre-check: if any item is Schedule H1 → doctor name required or HTTP 400
   b. Generate bill number via _generate_bill_number() → sequential, atomic
   c. For each line item:
      - Resolve batch (by batch_id or product SKU)
      - Snapshot: copy product_name, batch_number, expiry_date, mrp, gst_rate into bill item
      - Calculate: disc_paise, taxable_paise, gst_paise, line_total_paise (all integers)
   d. Calculate bill totals (all paise):
      - subtotal = sum of taxable_paise per item
      - gst = sum of gst_paise per item (split equally into CGST + SGST)
      - grand_total = subtotal + gst - bill_discount (rounded to nearest rupee)
   e. Determine status: paid if balance=0, due if balance>0
   f. Deduct stock: batch.qty_on_hand -= quantity for each item
   g. Create StockMovement record for each item (type="sale")
   h. If Schedule H1 items: create ScheduleH1Register record
   i. Create AuditLog entry
   j. Commit transaction
4. Return settled bill with real bill number
```

### Step-by-step: Creating a draft

Same as above except:
- `status = "draft"` in request
- Bill number = `DRAFT-{uuid}` (no sequence consumed)
- Stock NOT deducted
- Schedule H1 pre-check skipped (doctor not required for drafts)

### GST Calculation (exact formula)

```python
# Per line item — all integers (paise)
mrp_paise        = int(unit_mrp_rupees * 100)
disc_paise       = int(mrp_paise * quantity * disc_percent / 100)
taxable_paise    = mrp_paise * quantity - disc_paise
gst_rate         = product.gst_rate  # 0, 5, 12, or 18
line_gst_paise   = int(taxable_paise * gst_rate / 100)
line_total_paise = taxable_paise + line_gst_paise

# GST splits (intra-state sales only — all Phase 1 sales are intra-state)
cgst_paise = line_gst_paise // 2
sgst_paise = line_gst_paise - cgst_paise   # handles odd paise correctly

# Bill total
grand_total_paise = subtotal_paise + total_gst_paise - bill_discount_paise
grand_total_paise = round(grand_total_paise / 100) * 100  # round to nearest rupee
```

**Never use floating point for any of these calculations.**

### Bill Number Generation

```python
# _generate_bill_number() in backend/routers/billing.py
# Reads PharmacySettings for prefix, length, current sequence
# Increments sequence in same transaction
# Format: {PREFIX}-{zero_padded_number}
# Example: INV-000042, RTN-000001

# Sales return bills use separate "RTN" prefix
# Drafts never consume a sequence number
```

### Margin Calculation

```python
margin_paise   = grand_total_paise - cost_total_paise
margin_percent = (margin_paise / grand_total_paise * 100) if grand_total_paise > 0 else 0
```

Stored on the bill for reporting. `cost_total_paise` = sum of `batch.cost_price_paise × quantity`.

---

## FLOW 2 — SALES RETURN

### When it happens
Patient returns medicine. Pharmacy refunds money and takes stock back.

### Rules
- A sales return creates a new bill with `invoice_type = "SALES_RETURN"`
- Bill number prefix: `RTN-` (separate sequence from `INV-`)
- Stock is **restored** to the original batch (`qty_on_hand += returned_quantity`)
- A `StockMovement` record is created with `type = "sales_return"`
- If original bill had Schedule H1 items, the register entry is NOT deleted (audit trail)
- GST is reversed on the credit note

### Step-by-step

```
1. POST /api/invoices with invoice_type="SALES_RETURN"
2. Backend:
   a. Generate RTN-XXXXXX bill number
   b. For each returned item:
      - Find original batch
      - Restore stock: batch.qty_on_hand += quantity
      - Create StockMovement (type="sales_return", quantity=+returned_qty)
   c. Create refund record if refund method provided
   d. Status = "refunded" once refund is recorded
   e. Audit log
```

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
          expiry_date  = item.expiry_date
          qty_on_hand  = item.quantity
          mrp_paise    = int(item.mrp_per_unit * 100)
          cost_price_paise = int(ptr * 100)  ← PTR after discount
      - Create StockMovement (type="purchase", quantity=+qty)
      - Link batch to purchase item (item.batch_id = batch.id)
   b. Create AuditLog entry
   c. Commit
```

### Cost Price Calculation at Purchase

```python
# PTR = MRP × (1 - trade_margin/100)
# But actual cost stored = what pharmacist paid after all discounts

# In purchase item entry:
ptr             = item_data.ptr_per_unit  # entered by pharmacist
trade_discount  = item_data.trade_discount or 0
cost_per_unit   = ptr * (1 - trade_discount / 100)
cost_price_paise = int(cost_per_unit * 100)

# This becomes batch.cost_price_paise — used for margin calc in billing
```

### Purchase Number Generation

```python
# Format: PUR-YYYYMMDD-XXXX
# Where XXXX is sequential per pharmacy per day
# Example: PUR-20260418-0001
```

---

## FLOW 4 — PURCHASE RETURN

### When it happens
Pharmacy returns goods to supplier (expired, damaged, excess stock, wrong product).

### Rules
- Creates a new purchase with `invoice_type = "PURCHASE_RETURN"` or debit note
- Stock **deducted** from the batch (`qty_on_hand -= returned_quantity`)
- `StockMovement` created with `type = "purchase_return"`
- GST input credit is reversed

---

## FLOW 5 — INVENTORY & STOCK MOVEMENTS

### Every stock change creates a StockMovement record

No stock ever changes silently. Every addition or deduction is logged.

| Movement type | Triggered by | qty effect |
|--------------|--------------|-----------|
| `purchase` | Purchase confirmed | `+qty` |
| `sale` | Bill settled | `-qty` |
| `sales_return` | Sales return settled | `+qty` |
| `purchase_return` | Purchase return settled | `-qty` |
| `adjustment` | Manual stock adjustment | `+qty` or `-qty` |
| `opening_stock` | Batch created via bulk upload or manual entry | `+qty` |

### StockMovement schema

```python
StockMovement(
    pharmacy_id   = pharmacy_id,
    product_id    = product.id,
    batch_id      = batch.id,
    movement_type = "sale",              # see table above
    quantity      = -5,                  # negative for deductions
    reference_id  = bill.id,             # FK to bill, purchase, etc.
    reference_type = "bill",
    notes         = "Bill INV-000042",
    performed_by  = user_id,
)
```

### Batch qty_on_hand rule

`qty_on_hand` must never go negative. Before deducting:
```python
if batch.qty_on_hand < quantity:
    raise HTTPException(400, detail=f"Insufficient stock in batch {batch.batch_number}")
```

### FEFO (First Expired First Out)

When billing, batches of the same product should be sorted by expiry date ascending.
The earliest-expiring batch is consumed first.

```python
# Correct batch selection order
batches = sorted(product_batches, key=lambda b: b.expiry_date)
```

---

## FLOW 6 — SCHEDULE H1 REGISTER

### What it is
An auto-generated compliance register for every Schedule H1 drug sale.
Drug inspectors can inspect this register. Errors have legal consequences.

### When a ScheduleH1Register entry is created
- On every settled bill that contains a product with `drug_schedule = "H1"`
- One entry per H1 product per bill
- NOT created for drafts

### What is recorded

```python
ScheduleH1Register(
    pharmacy_id     = pharmacy_id,
    bill_id         = bill.id,
    bill_number     = bill.bill_number,
    bill_date       = bill.bill_date,
    patient_name    = bill.customer_name,
    doctor_name     = bill.doctor_name,           # required — validated before bill settles
    product_name    = item.product_name,          # snapshot
    batch_number    = item.batch_number,          # snapshot
    quantity        = item.quantity,
    schedule_type   = "H1",
)
```

### Frontend rule
When the billing form contains a Schedule H1 drug:
- Show doctor name field as **required** (not optional)
- Block settlement if doctor name is empty
- Show clear message: "Doctor name required for Schedule H1 drug: {product_name}"

---

## FLOW 7 — PAYMENTS (for credit/due bills)

### When a bill has `status = "due"`

A bill is "due" when `balance_paise > 0` after creation.
The customer owes money. The pharmacist records payment later.

```
POST /api/payments
{
  "invoice_id": "bill-uuid",
  "amount": 450.00,
  "payment_method": "upi",
  "reference_number": "UPI-ref-123"
}
```

### Payment status transitions

```
bill.amount_paid += payment_amount
bill.balance = max(0, bill.grand_total - bill.amount_paid)

if bill.balance <= 0:
    bill.status = "paid"
else:
    bill.status = "due"   # still owing
```

### Payment methods
`cash` | `upi` | `card` | `credit` | `cheque`

---

## FLOW 8 — GST REPORT

### What it covers
- All settled bills in a date range
- Grouped by HSN code
- Shows: taxable amount, CGST, SGST, total GST
- Used for GSTR-1 and GSTR-3B filing

### Key rules
- Only `status = "paid"` bills are included (not drafts, not due)
- Sales returns (`invoice_type = "SALES_RETURN"`) reduce GST amounts
- IGST is not used — all sales are intra-state in Phase 1
- HSN code comes from `bill_items.hsn_code` (snapshot at time of sale)

---

## FLOW 9 — STOCK ADJUSTMENT (Manual)

### When used
- Opening stock entry (new pharmacy onboarding)
- Correction after physical stock count
- Damaged/expired stock write-off

### Rules
- Creates a `StockMovement` with `type = "adjustment"`
- Requires a reason note
- Audit logged with old and new qty
- Cannot make `qty_on_hand` negative

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

Every significant action is recorded in `audit_logs`.

### What gets audited
- Bill created (draft or settled)
- Bill status changed
- Stock movement (purchase, sale, adjustment)
- Payment recorded
- Product created or edited
- Batch deleted
- User created or role changed
- Settings changed

### AuditLog schema
```python
AuditLog(
    pharmacy_id  = pharmacy_id,
    user_id      = current_user.id,
    action       = "create" | "update" | "delete" | "payment" | "status_change",
    entity_type  = "invoice" | "batch" | "product" | "purchase" | "user",
    entity_id    = entity.id,
    old_values   = { ... },   # state before change
    new_values   = { ... },   # state after change
)
```

**Never skip audit logging for compliance-sensitive actions.**

---

## WHAT CANNOT BE DONE (hard rules)

| Action | Why forbidden |
|--------|--------------|
| Hard delete a bill | Legal document — must exist forever |
| Hard delete a batch | Drug recall tracking requires batch history |
| Reuse a bill number | Sequential numbering is a legal requirement |
| Change a settled bill | Immutable once stock is deducted — create a return instead |
| Sell above MRP | Illegal under DPCO — system must enforce |
| Bill H1 drug without doctor | Legal requirement — backend enforces HTTP 400 |
| Store money as float | Rounding errors — always integer paise |
| Skip stock movement record | Every stock change must be traceable |

---

*When new business flows are built, document them here before writing code.*
*Owner: The developer building the feature writes the flow documentation first.*
