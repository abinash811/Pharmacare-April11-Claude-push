# PharmaCare — Database
# Version: 1.5 | Last updated: September 5, 2026
# Type: Reference
# Audience: Claude, all developers
# Rule: All schema changes go through Alembic migrations. Never ALTER TABLE manually.
#        Never hard DELETE from any table. Soft deletes only.

---

## DATABASE OVERVIEW

**Engine:** PostgreSQL 14+
**ORM:** SQLAlchemy 2.0 async
**Migrations:** Alembic
**Driver:** asyncpg

**Total tables: 21**

| Domain | Tables |
|--------|--------|
| Pharmacy | `pharmacies`, `pharmacy_settings` |
| Users | `users`, `roles`, `audit_logs` |
| Products | `products`, `stock_batches`, `stock_movements` |
| Billing | `bills`, `bill_items`, `sales_returns`, `sales_return_items`, `schedule_h1_register` |
| Purchases | `purchases`, `purchase_items`, `purchase_payments`, `purchase_returns`, `purchase_return_items` |
| Customers | `customers`, `doctors` |
| Suppliers | `suppliers` |

---

## CORE RULES

```
1. Every table with pharmacy data has pharmacy_id — multi-tenancy
2. All money columns end in _paise — integer, never float
3. Soft delete: deleted_at timestamp, never DELETE FROM
4. All PKs are UUID — never integer IDs
5. created_at + updated_at on every mutable table
6. Every FK column has an index
```

---

## ENTITY RELATIONSHIP

```
pharmacies
  ├── pharmacy_settings (1:1)
  ├── users (1:many) → roles
  ├── audit_logs (1:many)
  ├── products (1:many)
  │     └── stock_batches (1:many)
  │           └── stock_movements (1:many)
  ├── bills (1:many)
  │     ├── bill_items (1:many) → products, stock_batches
  │     └── schedule_h1_register (1:many) → products
  ├── sales_returns (1:many) → bills
  │     └── sales_return_items (1:many) → products, stock_batches
  ├── purchases (1:many) → suppliers
  │     ├── purchase_items (1:many) → products, stock_batches
  │     └── purchase_payments (1:many)
  ├── purchase_returns (1:many) → purchases, suppliers
  │     └── purchase_return_items (1:many) → products, stock_batches
  ├── customers (1:many)
  ├── doctors (1:many)
  └── suppliers (1:many)
```

---

## TABLE REFERENCE

---

### `pharmacies`
The root entity. Every piece of data belongs to a pharmacy.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `name` | String(200) | Pharmacy display name |
| `address` | Text | Full address |
| `city` | String(100) | — |
| `state` | String(100) | Indian state |
| `pincode` | String(6) | 6-digit Indian PIN code |
| `phone` | String(10) | 10-digit mobile |
| `email` | String(200) | Optional |
| `gstin` | String(15) | GST Identification Number |
| `drug_license_number` | String(50) | Required to operate legally |
| `drug_license_expiry` | Date | Future: renewal alert |
| `fssai_number` | String(20) | Food Safety license if applicable |
| `pan_number` | String(10) | PAN for IT filings |
| `logo_url` | Text | Logo image URL — used on printed/digital bills |
| `is_active` | Boolean | Soft disable |
| `created_at`, `updated_at` | TIMESTAMP | — |

---

### `pharmacy_settings`
One row per pharmacy (`UNIQUE` on `pharmacy_id`). Configurable defaults, grouped
by the same headings used as comments in `backend/models/pharmacy.py` —
keep this table and those comments in sync when either changes.

**Bill sequence — Sales Invoice**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `bill_prefix` | String(10) | `"INV"` | Prefix for bill numbers |
| `bill_sequence_number` | Integer | `1` | Next bill number to use |
| `bill_number_length` | Integer | `6` | Zero-padding length |

**Bill sequence — Sales Return (credit note)**
Separate gapless series from the Invoice sequence above — GST requires each
to be its own series.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `return_prefix` | String(10) | `"CN"` | Prefix for return/credit-note numbers |
| `return_sequence_number` | Integer | `1` | Next return number to use |
| `return_number_length` | Integer | `5` | Zero-padding length |

**Inventory**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `low_stock_threshold_days` | Integer | `30` | **Misnamed** (not a day count — renaming is a separate migration, tracked as tech debt). Currently unused as an alert threshold anywhere — fixed August 22, 2026 to stop being read as one at all, since despite the name it was always applied as a raw unit-quantity, not real "days of stock remaining" (nothing computes sales velocity). Every low-stock screen now uses each product's own `reorder_level` instead (see `docs/15_ROADMAP.md` RULE MISSES LOG). |
| `near_expiry_threshold_days` | Integer | `90` | Alert when expiry < N days away |
| `block_expired_stock` | Boolean | `true` | **Added August 22, 2026** (migration `d81f3b0c6a4e`). Enforced in `billing.py` create_bill/update_bill — blocks finalizing a sale on an expired batch. |
| `allow_near_expiry_sale` | Boolean | `true` | **Added August 22, 2026** (migration `d81f3b0c6a4e`). Enforced the same way — `false` blocks finalizing a sale on a near-expiry batch. No warning UI yet when `true` (default). |

**Notifications**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `alert_low_stock_enabled` | Boolean | `true` | — |
| `alert_near_expiry_enabled` | Boolean | `true` | — |
| `alert_drug_license_enabled` | Boolean | `true` | — |
| `drug_license_alert_days` | Integer | `90` | Alert when license expiry < N days away |

**GST**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `default_gst_rate` | Numeric(5,2) | `5.00` | Default GST rate for new products |
| `is_composition_scheme` | Boolean | `false` | Composition dealer — no ITC, no GST on bill |
| `default_hsn_medicines` | String(10) | `"3004"` | Default HSN code for medicine products |
| `default_hsn_surgical` | String(10) | `"9018"` | Default HSN code for surgical/non-medicine products |
| `auto_apply_hsn` | Boolean | `true` | Auto-fill HSN from category on product create |
| `gst_type` | String(20) | `"intrastate"` | `intrastate` (CGST+SGST) or `interstate` (IGST) |
| `round_off_amount` | Boolean | `true` | Round grand total to nearest rupee |
| `print_gst_summary` | Boolean | `true` | Show GST breakup on printed bill |

**Print**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `paper_size` | String(10) | `"80mm"` | Thermal `80mm`/`58mm` or `A4`/`A5` |
| `print_logo` | Boolean | `true` | Show logo on printed bill |
| `print_drug_license` | Boolean | `true` | Show drug license number on bill |
| `print_patient_name` | Boolean | `true` | — |
| `print_gstin` | Boolean | `true` | — |
| `print_fssai` | Boolean | `false` | — |
| `print_signature` | Boolean | `false` | Show signature line |
| `print_pan` | Boolean | `false` | — |
| `bill_header` | Text | `null` | Custom header text |
| `bill_footer` | Text | `"Thank you for your purchase!"` | Custom footer text |

**Digital receipt** (shareable, screen-viewed — always A4-style, no paper
size choice; "Show on Bill" toggles above and the item table are shared
with Print, both formats show the same billing information)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `digital_use_default_header` | Boolean | `true` | `false` = use custom header image below |
| `digital_header_image_url` | Text | `null` | Custom header image |
| `digital_footer_image_url` | Text | `null` | Custom footer image |
| `digital_header_height_px` | Integer | `100` | — |
| `digital_footer_height_px` | Integer | `60` | — |
| `digital_bill_header` | Text | `null` | Custom header text (digital only) |
| `digital_bill_footer` | Text | `null` | Custom footer text (digital only) |

---

### `roles`
RBAC roles. System roles are seeded on startup, custom roles can be created.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | Scoped per pharmacy |
| `name` | String(100) | UNIQUE per pharmacy |
| `description` | Text | — |
| `is_system_role` | Boolean | `true` = seeded, cannot delete |
| `permissions` | JSONB | Permission flags per module |
| `is_active` | Boolean | — |

**Default system roles:** `admin`, `manager`, `cashier`, `inventory_staff` (`backend/constants.py::DEFAULT_ROLES` — full permission list per role documented in `docs/14_SECURITY.md`)

---

### `users`
Pharmacy staff members. One user belongs to one pharmacy and one role.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `role_id` | UUID FK → roles | — |
| `name` | String(200) | — |
| `email` | String(200) | UNIQUE per pharmacy |
| `phone` | String(10) | Optional |
| `password_hash` | String(255) | bcrypt hash — never store plain text |
| `is_active` | Boolean | Inactive = cannot login |
| `last_login_at` | TIMESTAMP | — |

---

### `audit_logs`
Immutable record of every significant action. Never delete rows from this table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `user_id` | UUID FK → users | Who did it |
| `action` | String(100) | `create`, `update`, `delete`, `payment`, `status_change` |
| `entity_type` | String(100) | `invoice`, `batch`, `product`, `purchase`, `user` |
| `entity_id` | UUID | ID of the affected record |
| `old_values` | JSONB | State before change |
| `new_values` | JSONB | State after change |
| `ip_address` | INET | Client IP |
| `created_at` | TIMESTAMP | — |

**Indexes:** `pharmacy_id`, `(entity_type, entity_id)`, `user_id`, `created_at`

---

### `products`
The product master. One row per unique medicine.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | UUID PK | — | — |
| `pharmacy_id` | UUID FK | — | — |
| `sku` | String(100) | — | UNIQUE per pharmacy — used in URL `/inventory/product/:sku` |
| `barcode` | String(100) | Optional | EAN/UPC for scanner |
| `name` | String(300) | required | Brand name e.g. "Crocin 500mg" |
| `generic_name` | String(300) | Optional | Salt name e.g. "Paracetamol" |
| `brand` | String(200) | Optional | Manufacturer brand |
| `manufacturer` | String(200) | Optional | Who makes it |
| `category` | String(100) | Optional | e.g. "Antibiotics", "Analgesics" |
| `drug_schedule` | String(20) | `"OTC"` | `OTC`, `H`, `H1`, `X` |
| `dosage_form` | String(100) | Optional | `Tablet`, `Syrup`, `Injection`, etc. |
| `strength` | String(100) | Optional | e.g. `"500mg"`, `"10mg/5ml"`. Wired into `ProductCreate`/`ProductUpdate`, search, and the UI August 22, 2026 — was a real column with no way to set it before that. |
| `pack_size` | String(100) | Optional | e.g. `"10 tablets"`, `"100ml"` |
| `units_per_pack` | Integer | `1` | Tablets in a strip |
| `hsn_code` | String(10) | `"3004"` | Determines GST rate |
| `gst_rate` | Numeric(5,2) | `5.00` | `0`, `5`, `12`, or `18` |
| `reorder_level` | Integer | `10` | Alert threshold in packs |
| `reorder_quantity` | Integer | `100` | Default reorder quantity |
| `storage_location` | String(100) | Optional | Shelf/rack reference |
| `requires_refrigeration` | Boolean | `false` | Cold chain flag. Wired into `ProductCreate`/`ProductUpdate`, the `cold_chain_only` Inventory filter, bulk-update, and the UI August 22, 2026 — same fix as `strength` above. |
| `is_active` | Boolean | `true` | — |
| `deleted_at` | TIMESTAMP | null | Soft delete |

**Indexes:** `pharmacy_id`, `(pharmacy_id, name)`, `(pharmacy_id, barcode)`, `(pharmacy_id, generic_name)`, `(pharmacy_id, drug_schedule)`
**Constraint:** UNIQUE `(pharmacy_id, sku)`

---

### `stock_batches`
Every physical batch of a product in stock. One product has many batches.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `product_id` | UUID FK → products | — |
| `batch_number` | String(100) | As printed on box |
| `expiry_date` | Date | As printed on box (end of month) |
| `manufacture_date` | Date | Optional |
| `mrp_paise` | Integer | MRP at time of purchase |
| `cost_price_paise` | Integer | What pharmacy paid (landed cost) |
| `sale_price_paise` | Integer | Optional override (default = MRP) |
| `quantity_received` | Integer | Original qty received |
| `quantity_on_hand` | Integer | Current qty — decrements on sale |
| `quantity_sold` | Integer | Running total sold |
| `quantity_returned` | Integer | Running total returned |
| `quantity_written_off` | Integer | Expired/damaged write-offs |
| `is_active` | Boolean | `false` when qty reaches 0 |

**Rule:** `quantity_on_hand` must never go below 0.
**FEFO:** Sort by `expiry_date ASC` to sell earliest-expiring first.

**Indexes:** `product_id`, `(pharmacy_id, expiry_date)`, `(product_id, quantity_on_hand)`

---

### `stock_movements`
Immutable ledger of every stock change. Never delete rows.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `batch_id` | UUID FK → stock_batches | — |
| `product_id` | UUID FK → products | — |
| `movement_type` | String(50) | `purchase`, `sale`, `sales_return`, `purchase_return`, `adjustment`, `opening_stock` |
| `quantity` | Integer | Negative for deductions, positive for additions |
| `quantity_before` | Integer | Snapshot before movement |
| `quantity_after` | Integer | Snapshot after movement |
| `reference_type` | String(50) | `bill`, `purchase`, `adjustment` |
| `reference_id` | UUID | FK to the source record |
| `user_id` | UUID FK → users | Who triggered it |
| `notes` | Text | Optional reason |
| `created_at` | TIMESTAMP | Immutable |

---

### `bills`
Every sale transaction. Core of the system.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `bill_number` | String(50) | UNIQUE per pharmacy. Drafts: `DRAFT-{uuid}`. Settled: `INV-000042` |
| `invoice_type` | String(20) | `SALE`, `SALES_RETURN` |
| `bill_date` | Date | Date of sale |
| `bill_time` | Time (tz) | Time of sale |
| `customer_id` | UUID FK → customers | Optional |
| `customer_name` | String(200) | Snapshot — even if customer deleted |
| `customer_phone` | String(10) | Snapshot |
| `customer_gstin` | String(15) | Snapshot — for B2B bills |
| `doctor_id` | UUID FK → doctors | Required for H1 drugs |
| `doctor_name` | String(200) | Snapshot |
| `prescription_number` | String(100) | Optional |
| `prescription_date` | Date | Optional |
| `subtotal_paise` | Integer | Taxable amount before bill discount |
| `mrp_total_paise` | Integer | Sum of MRP × qty (before any discount) |
| `item_discount_paise` | Integer | Total item-level discounts |
| `bill_discount_paise` | Integer | Overall bill discount |
| `bill_discount_percent` | Numeric(5,2) | Overall bill discount as % |
| `total_discount_paise` | Integer | `item_discount + bill_discount` |
| `taxable_amount_paise` | Integer | `subtotal - bill_discount` |
| `total_cgst_paise` | Integer | CGST portion of GST |
| `total_sgst_paise` | Integer | SGST portion of GST |
| `total_igst_paise` | Integer | IGST portion of GST (interstate bills) |
| `total_gst_paise` | Integer | `cgst + sgst + igst` |
| `grand_total_paise` | Integer | Final amount payable |
| `amount_paid_paise` | Integer | Amount collected |
| `balance_paise` | Integer | `grand_total - amount_paid` |
| `payment_method` | String(20) | `cash`, `upi`, `card`, `credit`, `cheque` |
| `payment_reference` | String(100) | UPI/card/cheque reference number |
| `cost_total_paise` | Integer | Cost of goods sold |
| `margin_paise` | Integer | `grand_total - cost_total` |
| `margin_percent` | Numeric(5,2) | Margin as % of grand_total |
| `status` | String(20) | `draft`, `paid`, `due`, `partial` |
| `internal_note` | Text | Staff-only note — never printed |
| `delivery_note` | Text | Delivery instructions |
| `billed_by` | UUID FK → users | Cashier |
| `deleted_at` | TIMESTAMP | Soft delete |

**Constraint:** UNIQUE `(pharmacy_id, bill_number)`
**Indexes:** `pharmacy_id`, `(pharmacy_id, bill_date)`, `customer_id`, `(pharmacy_id, status)`, partial index on `status='paid'`, partial index on `status='due'`

---

### `bill_items`
Line items on a bill. All values are snapshots — do not join to products for display.

| Column | Type | Notes |
|--------|------|-------|
| `bill_id` | UUID FK → bills | CASCADE delete if bill deleted |
| `product_id` | UUID FK → products | For analytics only — not for display |
| `batch_id` | UUID FK → stock_batches | — |
| `product_name` | String(300) | **Snapshot** — use this for display |
| `generic_name` | String(300) | **Snapshot** |
| `batch_number` | String(100) | **Snapshot** |
| `expiry_date` | Date | **Snapshot** |
| `hsn_code` | String(10) | **Snapshot** — for GST report |
| `drug_schedule` | String(20) | **Snapshot** — for H1 register |
| `quantity` | Integer | — |
| `mrp_paise` | Integer | MRP at time of sale |
| `sale_price_paise` | Integer | Actual sale price |
| `cost_price_paise` | Integer | Cost at time of sale |
| `discount_percent` | Numeric(5,2) | — |
| `discount_paise` | Integer | — |
| `gst_rate` | Numeric(5,2) | **Snapshot** |
| `cgst_rate`, `sgst_rate`, `igst_rate` | Numeric(5,2) | intrastate: cgst+sgst = gst_rate. interstate: igst = gst_rate |
| `taxable_amount_paise` | Integer | `mrp × qty - discount` |
| `cgst_paise`, `sgst_paise`, `igst_paise` | Integer | Split GST amounts |
| `gst_paise` | Integer | Total GST for this line |
| `line_total_paise` | Integer | `taxable + gst` |
| `line_cost_paise` | Integer | `cost × qty` |

**Critical rule:** Never use `product_id` to look up product name for bill display.
Always use `product_name` (the snapshot column).

---

### `sales_returns`
A return against an existing bill (credit note). One bill can have multiple
partial returns.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `original_bill_id` | UUID FK → bills | The bill being returned against |
| `return_number` | String(50) | UNIQUE per pharmacy — uses `return_prefix`/`return_sequence_number` from `pharmacy_settings` |
| `return_date` | Date | — |
| `return_reason` | Text | Optional |
| `total_paise` | Integer | Sum of returned line amounts before GST |
| `total_gst_paise` | Integer | GST reversed |
| `grand_total_paise` | Integer | Total refund amount |
| `refund_method` | String(20) | `cash`, `upi`, `store_credit`, etc. |
| `status` | String(20) | `pending`, `completed` |
| `notes` | Text | Optional |
| `created_by` | UUID FK → users | — |

**Constraint:** UNIQUE `(pharmacy_id, return_number)`

---

### `sales_return_items`
Line items on a sales return. All values are snapshots, same rule as `bill_items`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `sales_return_id` | UUID FK → sales_returns | CASCADE delete if return deleted |
| `bill_item_id` | UUID FK → bill_items | The original line being returned |
| `product_id` | UUID FK → products | For analytics only |
| `batch_id` | UUID FK → stock_batches | Batch stock is returned to |
| `product_name` | String(300) | **Snapshot** |
| `batch_number` | String(100) | **Snapshot** |
| `quantity` | Integer | Quantity returned |
| `sale_price_paise` | Integer | Snapshot from original sale |
| `gst_rate` | Numeric(5,2) | **Snapshot** |
| `gst_paise` | Integer | GST reversed for this line |
| `line_total_paise` | Integer | — |
| `return_to_stock` | Boolean | `true` = adds back to `stock_batches.quantity_on_hand`, `false` = written off (damaged) |

---

### `schedule_h1_register`
Legal compliance register. Every H1 drug sale creates a row here.

| Column | Type | Notes |
|--------|------|-------|
| `bill_id` | UUID FK → bills | Source bill |
| `product_name` | String(300) | Snapshot |
| `batch_number` | String(100) | Snapshot |
| `quantity` | Integer | — |
| `prescriber_name` | String(200) | Doctor name — required |
| `prescriber_registration_number` | String(100) | Optional but important |
| `patient_name` | String(200) | Patient name — required |
| `supply_date` | Date | Date dispensed |
| `dispensed_by` | UUID FK → users | Pharmacist who dispensed |

**Never delete rows from this table.** Drug inspector can audit at any time.

---

### `purchases`
Stock purchase from a supplier.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `supplier_id` | UUID FK → suppliers | — |
| `purchase_number` | String(50) | UNIQUE per pharmacy |
| `supplier_invoice_number` | String(100) | Supplier's invoice ref |
| `supplier_invoice_date` | Date | Date on supplier's invoice |
| `purchase_date` | Date | — |
| `grn_number` | String(50) | Goods Receipt Note number |
| `received_date` | Date | Date goods were physically received |
| `subtotal_paise` | Integer | — |
| `total_discount_paise` | Integer | Trade discount total |
| `total_gst_paise` | Integer | ITC-eligible GST — `cgst + sgst + igst` |
| `total_cgst_paise` | Integer | CGST portion (intrastate) |
| `total_sgst_paise` | Integer | SGST portion (intrastate) |
| `total_igst_paise` | Integer | IGST portion (interstate) |
| `grand_total_paise` | Integer | Payable to supplier |
| `amount_paid_paise` | Integer | Amount paid so far — sum of `purchase_payments` |
| `status` | String(20) | `draft`, `confirmed` |
| `payment_status` | String(20) | `unpaid`, `partial`, `paid` |
| `due_date` | Date | Payment due date |
| `notes` | Text | Optional |
| `created_by` | UUID FK → users | — |
| `deleted_at` | TIMESTAMP | Soft delete |

---

### `purchase_items`
Line items on a purchase. Creates stock_batches when purchase is confirmed.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `purchase_id` | UUID FK → purchases | CASCADE delete if purchase deleted |
| `product_id` | UUID FK → products | — |
| `batch_id` | UUID FK → stock_batches | Set when purchase confirmed |
| `product_name` | String(300) | Snapshot |
| `batch_number` | String(100) | As on supplier invoice |
| `expiry_date` | Date | As on supplier invoice |
| `hsn_code` | String(10) | Snapshot — for GST report |
| `quantity_ordered` | Integer | — |
| `quantity_received` | Integer | May differ from ordered |
| `units_per_pack` | Integer | Tablets/units in a strip/pack |
| `mrp_paise` | Integer | MRP on this batch |
| `cost_price_paise` | Integer | PTR after discount |
| `discount_percent` | Numeric(5,2) | Trade discount |
| `gst_rate` | Numeric(5,2) | GST rate for ITC |
| `cgst_rate`, `sgst_rate`, `igst_rate` | Numeric(5,2) | intrastate: cgst+sgst = gst_rate. interstate: igst = gst_rate |
| `taxable_amount_paise` | Integer | `cost_price × qty - discount` |
| `gst_amount_paise` | Integer | Total GST for this line |
| `line_total_paise` | Integer | `taxable + gst` |

---

### `purchase_payments`
Payments made against a purchase. A purchase can be paid in multiple
installments — `purchases.amount_paid_paise` is the sum of these rows.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `purchase_id` | UUID FK → purchases | — |
| `amount_paise` | Integer | — |
| `payment_method` | String(20) | `cash`, `upi`, `card`, `cheque`, `bank_transfer` |
| `payment_date` | Date | — |
| `reference_number` | String(100) | UPI/cheque/bank reference |
| `notes` | Text | Optional |
| `created_by` | UUID FK → users | — |

---

### `purchase_returns`
A return of stock to a supplier (debit note) — the purchase-side mirror of
`sales_returns`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `pharmacy_id` | UUID FK | — |
| `purchase_id` | UUID FK → purchases | The purchase being returned against |
| `supplier_id` | UUID FK → suppliers | — |
| `return_number` | String(50) | UNIQUE per pharmacy |
| `return_date` | Date | — |
| `return_reason` | String(50) | Required — e.g. `expired`, `damaged`, `wrong_item` |
| `subtotal_paise` | Integer | — |
| `total_gst_paise` | Integer | GST reversed |
| `grand_total_paise` | Integer | Total credit expected from supplier |
| `status` | String(20) | `pending`, `completed` |
| `credit_note_number` | String(100) | Supplier's credit note ref, once received |
| `notes` | Text | Optional |
| `created_by` | UUID FK → users | — |

**Constraint:** UNIQUE `(pharmacy_id, return_number)`

---

### `purchase_return_items`
Line items on a purchase return.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `purchase_return_id` | UUID FK → purchase_returns | CASCADE delete if return deleted |
| `product_id` | UUID FK → products | — |
| `batch_id` | UUID FK → stock_batches | Batch stock is deducted from |
| `product_name` | String(300) | Snapshot |
| `batch_number` | String(100) | Snapshot |
| `expiry_date` | Date | Snapshot |
| `quantity` | Integer | Quantity returned to supplier |
| `cost_price_paise` | Integer | Snapshot from original purchase |
| `gst_rate` | Numeric(5,2) | Snapshot |
| `gst_amount_paise` | Integer | GST reversed for this line |
| `line_total_paise` | Integer | — |

---

### `customers`

| Column | Type | Notes |
|--------|------|-------|
| `name` | String(200) | — |
| `phone` | String(10) | Primary identifier for walk-in customers |
| `alternate_phone` | String(10) | Optional |
| `email` | String(200) | Optional |
| `age` | Integer | Optional |
| `gender` | String(10) | Optional |
| `address` | Text | Optional |
| `city` | String(100) | Optional |
| `customer_type` | String(20) | `retail`, `wholesale`, `institution` — default `retail` |
| `gstin` | String(15) | For B2B customers |
| `credit_limit_paise` | Integer | Max outstanding allowed |
| `credit_days` | Integer | Payment terms — default `0` |
| `outstanding_paise` | Integer | Current amount owed |
| `loyalty_points` | Integer | — |
| `is_active` | Boolean | — |
| `deleted_at` | TIMESTAMP | Soft delete |

**Indexes:** `pharmacy_id`, `(pharmacy_id, phone)`, `(pharmacy_id, name)`

---

### `doctors`
Prescribing doctors. Required for Schedule H1 billing.

| Column | Type | Notes |
|--------|------|-------|
| `name` | String(200) | — |
| `qualification` | String(200) | e.g. "MBBS, MD" |
| `registration_number` | String(100) | Medical Council reg number |
| `specialization` | String(200) | e.g. "General Physician" |
| `hospital` | String(200) | — |
| `phone` | String(10) | — |
| `address` | Text | Optional |
| `is_active` | Boolean | — |
| `deleted_at` | TIMESTAMP | Soft delete |

**Indexes:** `pharmacy_id`, `(pharmacy_id, name)`

---

### `suppliers`

| Column | Type | Notes |
|--------|------|-------|
| `name` | String(200) | Distributor/stockist name |
| `contact_person` | String(200) | Optional |
| `phone` | String(10) | Optional |
| `alternate_phone` | String(10) | Optional |
| `email` | String(200) | Optional |
| `address` | Text | Optional |
| `city` | String(100) | Optional |
| `state` | String(100) | Optional |
| `pincode` | String(6) | Optional |
| `gstin` | String(15) | For ITC reconciliation |
| `drug_license_number` | String(50) | Supplier's drug license |
| `pan_number` | String(10) | Optional |
| `credit_days` | Integer | Default 30 — payment terms |
| `credit_limit_paise` | Integer | Optional credit limit |
| `is_active` | Boolean | — |
| `deleted_at` | TIMESTAMP | Soft delete |

**Indexes:** `pharmacy_id`

---

## INDEXES SUMMARY

Indexes are defined in `__table_args__` in each model. Key patterns:

```python
# Every pharmacy-scoped table
Index("idx_table_pharmacy", "pharmacy_id")

# Date-range queries (reports)
Index("idx_bills_date", "pharmacy_id", "bill_date")

# Status filters
Index("idx_bills_status", "pharmacy_id", "status")

# Partial indexes (PostgreSQL) — only index rows matching condition
Index("idx_bills_paid", "pharmacy_id", "bill_date",
      postgresql_where=text("status = 'paid'"))

# Text search
Index("idx_products_name", "pharmacy_id", "name")
```

---

## MIGRATIONS

All schema changes must go through Alembic. Never ALTER TABLE manually.

```bash
# 1. Make changes to the model in backend/models/
# 2. Generate migration
cd backend
alembic revision --autogenerate -m "add barcode_verified to stock_batches"

# 3. Review the generated file in backend/migrations/versions/
# 4. Apply
alembic upgrade head

# Check current version
alembic current

# Rollback one migration
alembic downgrade -1

# See migration history
alembic history
```

**Rules:**
- Migration file names must be descriptive: `add_reorder_level_to_products` not `update_123`
- Always review auto-generated migrations — SQLAlchemy doesn't always get it right
- Never edit an applied migration — create a new one
- Migration files are committed to git alongside model changes

---

## ADDING A NEW TABLE

Checklist when adding a new model:

```
- [ ] UUID primary key (never integer)
- [ ] pharmacy_id FK + index (if pharmacy-scoped data)
- [ ] created_at with server_default=func.now()
- [ ] updated_at with server_default=func.now(), onupdate=func.now()
- [ ] deleted_at TIMESTAMP nullable (for soft delete)
- [ ] All money columns end in _paise, type Integer
- [ ] Alembic migration created and reviewed
- [ ] Model imported in backend/models/__init__.py if applicable
```

---

*Owner: Developer who makes a schema change updates this file in the same PR.*
