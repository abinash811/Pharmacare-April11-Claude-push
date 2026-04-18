# PharmaCare — Glossary
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, developers, designers, product — anyone building PharmaCare
# Rule: Every pharmacy or business term used in code, UI, or docs must be defined here.
#        When a new term is introduced, add it here in the same PR.

---

## HOW TO USE THIS FILE

If you see a term in the codebase, UI, or another doc that you don't fully understand —
look it up here first. If it's not here, that is a gap — add it.

Understanding these terms is not optional. Getting them wrong leads to features that
are legally incorrect, financially wrong, or confusing to pharmacists.

---

## PART 1 — PRICING TERMS

These terms appear constantly in billing, inventory, and purchase flows.
Getting these wrong has direct financial and legal consequences.

---

### MRP — Maximum Retail Price

**What it is:**
The maximum price at which a medicine can be sold to the end customer (patient).
Printed on every medicine strip, bottle, or box by the manufacturer.

**Why it's legally significant:**
Selling above MRP is a criminal offence under the Drugs (Prices Control) Order.
A pharmacist can be fined or lose their drug license for selling above MRP.

**How it works in PharmaCare:**
- Stored per batch (because MRP can change between batches of the same product)
- The billing screen shows MRP and must never allow a price higher than MRP
- Stored as **integer paise** (₹12.50 MRP = 1250 paise)
- Field name in DB and code: `mrp_per_unit`

**Example:**
A strip of Paracetamol 500mg has MRP ₹22. If a patient asks for 5 strips,
maximum chargeable = ₹110. Cannot charge ₹115 even if the pharmacist wants to.

**Do not confuse with:** Selling price (which can be at or below MRP), PTR, cost price.

---

### PTR — Price to Retailer

**What it is:**
The price at which a distributor/stockist sells a medicine to a pharmacy (retailer).
This is the pharmacy's purchase price before adding their margin.

**How it's calculated:**
```
PTR = MRP × (1 - trade_margin_percent / 100)
```
Typical trade margin is 8–20% depending on the drug category.

**How it works in PharmaCare:**
- Displayed in the batch table on the medicine detail page
- Helps the pharmacist quickly see what they paid vs. what they can sell at
- Not stored separately — calculated from cost price in the UI
- Field reference: `cost_price_per_unit` in the batch table is effectively PTR

**Example:**
MRP ₹100. Distributor gives 15% margin. PTR = ₹85. Pharmacy buys at ₹85, sells at ≤ ₹100.

---

### PTS — Price to Stockist

**What it is:**
The price at which the manufacturer sells to a distributor/stockist.
The stockist then adds their margin and sells at PTR to pharmacies.

**How it works in PharmaCare:**
Not directly tracked in Phase 1. Relevant when we build distributor-side features in Phase 3.

---

### LP — Landing Price / Landed Cost

**What it is:**
The actual cost to the pharmacy after all deductions and additions:
```
LP = PTR - trade_discount - scheme_discount + freight_charges + taxes
```

**Why it matters:**
The true margin calculation must use LP, not just PTR. A pharmacist who ignores
freight and scheme gives wrong margin numbers to their accountant.

**How it works in PharmaCare:**
- Displayed as "LP" column in the batch table (BatchesTab)
- Stored as `cost_price_per_unit` on the batch
- At purchase entry, the pharmacist enters the actual landed cost per unit

---

### Margin %

**What it is:**
The profit percentage on a sale, calculated against selling price (not cost).

**Formula (always use this — not markup):**
```
margin_percent = ((MRP - cost_price) / MRP) × 100
```

**Why margin not markup:**
Pharmacists and accountants in India universally use margin (on selling price),
not markup (on cost price). Using markup would give wrong numbers they don't recognise.

**How it works in PharmaCare:**
```javascript
// Correct — used in BatchesTab.jsx
function calculateMargin(mrp, costPrice) {
  if (!mrp || !costPrice || costPrice === 0) return '0.00';
  return (((mrp - costPrice) / mrp) * 100).toFixed(2);
}
```

**Example:**
Cost ₹85, MRP ₹100. Margin = (100-85)/100 × 100 = 15%. Never say "markup of 17.6%".

---

### Trade Discount

**What it is:**
A percentage discount given by the distributor on the invoice.
Reduces the effective purchase price.

**Example:**
Invoice shows PTR ₹100 with 5% trade discount. Effective cost = ₹95.

**How it works in PharmaCare:**
Entered during purchase entry. Applied to calculate final `cost_price_per_unit` on the batch.

---

### Scheme / Free Goods

**What it is:**
Buy 10 get 1 free, or similar promotional schemes from distributors.
Effectively reduces the per-unit cost.

**Example:**
Buy 10 strips at ₹100 each, get 1 free. Effective cost per strip = ₹1000/11 = ₹90.90.

**How it works in PharmaCare:**
Pharmacist manually adjusts quantity received and calculates effective cost at purchase entry.
Future: auto-calculate scheme impact.

---

## PART 2 — DRUG REGULATORY TERMS

These terms are legally significant. Getting them wrong in features means legal risk for our customers.

---

### Schedule H

**What it is:**
A list of drugs under the Drugs and Cosmetics Act that cannot be sold without
a valid prescription from a registered medical practitioner.

**Examples:** Antibiotics (Amoxicillin, Azithromycin), Antidiabetics, Antihypertensives.

**Why it matters for PharmaCare:**
- Schedule H drugs must be flagged in the product master
- Future: billing should warn/block if prescription not recorded
- Currently: displayed as schedule type on product detail

**Field in DB:** `schedule_type = 'H'`

---

### Schedule H1

**What it is:**
A stricter subset of Schedule H. Drugs with higher abuse potential or serious side effects.
Examples: certain antibiotics (Cephalosporins), habit-forming drugs.

**Legal requirement:**
Every Schedule H1 sale must be recorded in a **physical register** with:
- Date of sale
- Patient name and address
- Prescribing doctor's name and registration number
- Drug name, batch number, quantity
- Pharmacist's signature

**Why it's critical for PharmaCare:**
This register is inspected by drug inspectors. If it's wrong or missing,
the pharmacy loses its drug license. **PharmaCare auto-generates this register
from billing data.** This is one of our strongest compliance features.

**Field in DB:** `schedule_type = 'H1'`
**Page in app:** `/compliance/schedule-h1`

---

### Schedule X

**What it is:**
Narcotic and psychotropic drugs. The strictest category.
Examples: Morphine, Codeine-based cough syrups, certain sleeping pills.

**Legal requirement:**
Requires special license (separate from normal drug license) to stock and sell.
Extremely detailed record-keeping required.

**How it works in PharmaCare:**
Phase 1 does not handle Schedule X sales. Future compliance module.
**Do not allow Schedule X drugs in billing until the compliance module is built.**

**Field in DB:** `schedule_type = 'X'`

---

### OTC — Over The Counter

**What it is:**
Drugs that can be sold without a prescription.
Examples: Paracetamol, antacids, ORS, vitamins, most topical creams.

**Field in DB:** `schedule_type = 'OTC'` or `null`

---

### CDSCO — Central Drugs Standard Control Organisation

**What it is:**
India's national drug regulator, equivalent to the US FDA.
Issues drug approvals, maintains the list of approved drugs, issues recall notices.

**Why it matters for PharmaCare:**
Future feature: when CDSCO issues a drug recall, PharmaCare should automatically
flag all affected batches in inventory and alert the pharmacist.

---

### Drug License

**What it is:**
A government license that every pharmacy must have to legally sell medicines.
Issued by the State Drug Control Authority.

**Two types:**
- Retail Drug License (Form 20, 21) — for OTC and Schedule H drugs
- Additional license (Form 20B, 21B) — required for Schedule X

**Why it matters for PharmaCare:**
Future: store drug license number, expiry date, send renewal alerts.
Drug license number appears on bills — legal requirement.

---

### D.Pharm / B.Pharm

**What they are:**
- **D.Pharm** — Diploma in Pharmacy (2-year course). Minimum qualification to be a pharmacist.
- **B.Pharm** — Bachelor of Pharmacy (4-year degree). Higher qualification.

**Why it matters:**
A registered pharmacist must be physically present for Schedule H drug sales.
The pharmacist's registration number should eventually appear on bills.

---

### HSN Code — Harmonized System of Nomenclature

**What it is:**
A 6-8 digit international code that classifies every product for tax purposes.
Every medicine has an HSN code that determines its GST rate.

**Examples:**
- HSN 3004 — medicaments (most prescription drugs) → 12% GST
- HSN 3006 — pharmaceutical goods → varies
- HSN 2106 — food supplements → 18% GST

**Why it matters for PharmaCare:**
HSN code is mandatory on GST invoices above ₹50,000 and in GSTR-1 filing.
The GST report groups sales by HSN code.

**Field in DB:** `hsn_code` on product master

---

## PART 3 — GST TERMS

---

### GST — Goods and Services Tax

**What it is:**
India's unified indirect tax. Replaced VAT, service tax, excise duty in 2017.
Every sale must charge GST at the applicable rate.

**GST rates on medicines:**
| Rate | What falls here |
|------|----------------|
| 0% | Life-saving drugs (insulin, vaccines, blood products) |
| 5% | Most prescription medicines |
| 12% | Most OTC medicines, medical devices |
| 18% | Cosmetics, some supplements |

**How it works in PharmaCare:**
- GST rate stored per product (`gst_rate` field)
- Applied at billing — shown as line item on bill
- All amounts stored as paise (integers) — GST calculated in paise, never floats

---

### CGST / SGST / IGST

**What they are:**
- **CGST** — Central GST. Goes to central government. Half of the GST rate.
- **SGST** — State GST. Goes to state government. Half of the GST rate.
- **IGST** — Integrated GST. For inter-state sales. Full GST rate.

**For PharmaCare (Phase 1):**
All sales are intra-state (within same state). So bills show CGST + SGST split.
Example: 12% GST = 6% CGST + 6% SGST.

**Do not use IGST in Phase 1** — all pharmacies sell within their state.

---

### GSTR-1

**What it is:**
Monthly/quarterly GST return for outward supplies (sales).
Filed by the 11th of the following month.

**What it contains:**
- Invoice-wise details of all B2C sales above ₹2.5 lakh
- HSN-wise summary of all sales
- State-wise breakdown

**How it works in PharmaCare:**
The GST Report page (`/reports/gst`) generates the data needed for GSTR-1 filing.
The accountant exports this and files on the GST portal.

---

### GSTR-3B

**What it is:**
Monthly summary GST return. Filed by the 20th of the following month.
Simpler than GSTR-1 — just totals, not invoice-wise.

**How it works in PharmaCare:**
Same GST Report export covers GSTR-3B data needs.

---

### ITC — Input Tax Credit

**What it is:**
GST paid on purchases can be claimed back against GST collected on sales.
Only the net GST (collected - paid) goes to the government.

**Example:**
Pharmacy collected ₹1000 GST on sales, paid ₹700 GST on purchases.
Net GST payable = ₹300. ITC = ₹700.

**How it works in PharmaCare:**
Purchase GST tracked. Future: ITC reconciliation report.

---

## PART 4 — INVENTORY TERMS

---

### Batch

**What it is:**
A specific manufacturing lot of a drug. Every batch has:
- A batch number (e.g., `BN240501`)
- A manufacturing date
- An expiry date
- A specific cost price (can vary between batches)

**Why batches matter:**
1. **Legal recalls** — if a batch is recalled, you need to know exactly which patients got it
2. **FEFO** (First Expired First Out) — sell the batch expiring soonest first
3. **Cost accuracy** — different batches of the same drug can have different costs

**In PharmaCare:**
Stock is tracked at batch level, not just product level.
One product can have multiple batches with different expiry dates and costs.

**DB table:** `batches`
**Key fields:** `batch_no`, `expiry_date`, `qty_on_hand`, `mrp_per_unit`, `cost_price_per_unit`

---

### Expiry Date Format

**Indian standard:** MM/YY (month/year only — no day)
Example: `06/26` means expires end of June 2026.

**Rule for PharmaCare:**
A batch expires at the **end** of the printed month, not the start.
`06/26` is valid through June 30, 2026. It expires on July 1, 2026.

**In code:**
```javascript
// Correct expiry check
function isExpired(expiryDate) {
  const [month, year] = expiryDate.split('/');
  const expiry = new Date(2000 + parseInt(year), parseInt(month), 1); // first of NEXT month
  return expiry <= new Date();
}
```

**Near expiry definition:** Within 90 days (3 months) of expiry date.

---

### FEFO — First Expired First Out

**What it is:**
The rule that when selling a product with multiple batches, the batch
expiring soonest must be sold first.

**Why it matters:**
Prevents expired stock from sitting while newer stock gets sold.
Legal and financial best practice.

**How it works in PharmaCare:**
When billing, the system should automatically suggest the earliest-expiring batch.
Future: enforce FEFO strictly in billing.

---

### SKU — Stock Keeping Unit

**What it is:**
A unique code for each distinct product in inventory.
Two products with different strengths (e.g., Paracetamol 500mg vs 650mg) have different SKUs.

**In PharmaCare:**
`sku` is the primary identifier for products in the URL and throughout the app.
Route: `/inventory/product/:sku`

---

### Units Per Pack

**What it is:**
How many individual units are in one pack/strip/box.
Example: A strip of 10 tablets → `units_per_pack = 10`

**Why it matters:**
Stock is tracked in packs but patients buy individual tablets.
A quantity of 5 strips = 50 tablets if `units_per_pack = 10`.

**In PharmaCare:**
Both pack quantity and unit quantity shown in inventory:
```
5 (50)  ← 5 packs, 50 units in brackets
```

---

### GRN — Goods Receipt Note

**What it is:**
The record of stock received from a supplier against a purchase order.
Confirmed when the pharmacist physically receives and counts the stock.

**In PharmaCare:**
A settled purchase order creates batch entries in inventory (GRN).
Until settled, stock is not added to inventory.

---

### Reorder Level

**What it is:**
The stock quantity below which a reorder should be triggered.
Set per product by the pharmacist.

**In PharmaCare:**
Stored as `reorder_level` on the product.
Future: trigger low-stock alert when `qty_on_hand` drops below `reorder_level`.

---

### Dead Stock

**What it is:**
Products that have not moved (no sales) for an extended period (typically 90+ days).
Ties up capital and risks expiry.

**In PharmaCare:**
Future report: identify dead stock by analysing sales transactions.

---

## PART 5 — TRANSACTION TERMS

---

### Bill / Invoice

**What it is:**
A record of a sale from the pharmacy to a patient/customer.
In India, a GST invoice is a legal document.

**Bill states in PharmaCare:**
- **Draft** — bill being created, no bill number assigned, stock not deducted
- **Settled** — bill finalised, bill number assigned, stock deducted, cannot be edited

**Critical rule:**
Bill numbers are assigned **only at settlement**, never at draft stage.
This is both a business rule and a legal requirement (sequential numbering).

---

### Sales Return / Credit Note

**What it is:**
When a patient returns medicines. The pharmacy refunds and takes stock back.
A credit note is the document issued for a sales return.

**Rules:**
- Stock is added back to the original batch
- GST is reversed
- Credit note number is sequential (separate sequence from bills)

**In PharmaCare:** Page at `/billing/returns`

---

### Purchase Return / Debit Note

**What it is:**
When a pharmacy returns goods to a supplier (expired, damaged, wrong item).
A debit note is issued to the supplier.

**Rules:**
- Stock is deducted from the batch
- GST input credit is reversed
- Debit note number is sequential

**In PharmaCare:** Page at `/purchases/returns`

---

### Settlement

**What it is:**
The act of finalising a bill or purchase. In PharmaCare, "settling" means:
1. Bill number is assigned (atomic DB sequence)
2. Stock is deducted (for sales) or added (for purchases)
3. The transaction becomes immutable (cannot be edited)

**Why this word:**
Used consistently throughout the codebase. Do not use "confirm", "finalise",
"complete", or "save" — always use "settle" or "settled".

---

### Outstanding / Credit

**What it is:**
Amount owed by a customer (outstanding receivable) or owed to a supplier (outstanding payable).

**In PharmaCare:**
- Customer outstanding tracked in customer ledger
- Supplier outstanding tracked in supplier ledger
- Future: aging reports (30/60/90 days overdue)

---

## PART 6 — SYSTEM-SPECIFIC TERMS

These are PharmaCare-specific terms used in code and UI.

---

### Paise

**What it is:**
The smallest unit of Indian currency. ₹1 = 100 paise.

**The rule:**
**All money in PharmaCare is stored and calculated as integer paise.**
Never use floats for money. Never store ₹12.50 — store 1250.

**Why:**
Floating point arithmetic causes rounding errors in financial calculations.
Example: 0.1 + 0.2 = 0.30000000000000004 in JavaScript. In paise: 10 + 20 = 30. Exact.

**Display only:**
```javascript
// Convert paise to rupees for display ONLY
const formatCurrency = (paise) => `₹${(paise / 100).toFixed(2)}`;
// formatCurrency(1250) → "₹12.50"
```

**Never do this:**
```javascript
// WRONG — never store or calculate with rupees as floats
const total = 12.50 + 8.75; // 21.25 — might work, might not
```

---

### Soft Delete

**What it is:**
Marking a record as deleted without physically removing it from the database.

**How it works in PharmaCare:**
```python
# Every deletable table has these columns
is_deleted: bool = False
deleted_at: datetime = None
```

**Why:**
Pharmacy data is legal and financial data. A deleted bill still needs to exist for
audit purposes. A cancelled batch still needs to exist for recall tracking.
**Hard deletes are never acceptable in PharmaCare.**

---

### Bill Sequence

**What it is:**
The system that generates sequential, unique bill numbers.
Example: `INV-000001`, `INV-000002`, etc.

**Rules:**
- Generated using PostgreSQL `nextval()` — atomic, no duplicates even under concurrent load
- Assigned only at settlement, never at draft
- Never reused, even if a bill is cancelled
- Configurable prefix and length in Settings

---

### Snapshot Billing

**What it is:**
When a bill is created, it stores the product name, MRP, and GST rate
**at the time of sale** — not a live reference to the current product.

**Why:**
If a product's MRP changes after a bill is created, the historical bill must
show the original MRP. A pharmacist cannot have their old bills change retroactively.

**In practice:**
```python
# Bill line item stores a copy, not a foreign key reference for display
bill_item.product_name = product.name      # snapshot
bill_item.mrp_at_sale = batch.mrp_per_unit  # snapshot
bill_item.gst_rate_at_sale = product.gst_rate  # snapshot
```

---

*When a new term is introduced in the codebase or product, add it here in the same PR.*
*Owner: Any developer who introduces the term owns adding its definition.*
