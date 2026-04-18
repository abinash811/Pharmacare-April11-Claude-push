# PharmaCare — Database
# Version: 1.0 | Last updated: April 18, 2026
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
| `is_active` | Boolean | Soft disable |
| `created_at`, `updated_at` | TIMESTAMP | — |

---

### `pharmacy_settings`
One row per pharmacy. Configurable defaults.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `pharmacy_id` | UUID FK | — | UNIQUE — one row per pharmacy |
| `bill_prefix` | String(10) | `"INV"` | Prefix for bill numbers |
| `bill_sequence_number` | Integer | `1` | Next bill number to use |
| `bill_number_length` | Integer | `6` | Zero-padding length |
| `low_stock_threshold_days` | Integer | `30` | Alert when stock lasts < N days |
| `near_expiry_threshold_days` | Integer | `90` | Alert when expiry < N days away |
| `default_gst_rate` | Numeric(5,2) | `5.00` | Default GST rate for new products |
| `print_logo` | Boolean | `true` | Show logo on printed bill |
| `print_drug_license` | Boolean | `true` | Show drug license on bill |

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

**Default system roles:** `admin`, `manager`, `cashier`, `inventory`

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
| `strength` | String(100) | Optional | e.g. `"500mg"`, `"10mg/5ml"` |
| `pack_size` | String(100) | Optional | e.g. `"10 tablets"`, `"100ml"` |
| `units_per_pack` | Integer | `1` | Tablets in a strip |
| `hsn_code` | String(10) | `"3004"` | Determines GST rate |
| `gst_rate` | Numeric(5,2) | `5.00` | `0`, `5`, `12`, or `18` |
| `reorder_level` | Integer | `10` | Alert threshold in packs |
| `reorder_quantity` | Integer | `100` | Default reorder quantity |
| `storage_location` | String(100) | Optional | Shelf/rack reference |
| `requires_refrigeration` | Boolean | `false` | Cold chain flag |
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
| `customer_id` | UUID FK → customers | Optional |
| `customer_name` | String(200) | Snapshot — even if customer deleted |
| `customer_phone` | String(10) | Snapshot |
| `doctor_id` | UUID FK → doctors | Required for H1 drugs |
| `doctor_name` | String(200) | Snapshot |
| `subtotal_paise` | Integer | Taxable amount before bill discount |
| `mrp_total_paise` | Integer | Sum of MRP × qty (before any discount) |
| `item_discount_paise` | Integer | Total item-level discounts |
| `bill_discount_paise` | Integer | Overall bill discount |
| `total_discount_paise` | Integer | `item_discount + bill_discount` |
| `taxable_amount_paise` | Integer | `subtotal - bill_discount` |
| `total_cgst_paise` | Integer | CGST portion of GST |
| `total_sgst_paise` | Integer | SGST portion of GST |
| `total_gst_paise` | Integer | `cgst + sgst` |
| `grand_total_paise` | Integer | Final amount payable |
| `amount_paid_paise` | Integer | Amount collected |
| `balance_paise` | Integer | `grand_total - amount_paid` |
| `payment_method` | String(20) | `cash`, `upi`, `card`, `credit`, `cheque` |
| `cost_total_paise` | Integer | Cost of goods sold |
| `margin_paise` | Integer | `grand_total - cost_total` |
| `margin_percent` | Numeric(5,2) | Margin as % of grand_total |
| `status` | String(20) | `draft`, `paid`, `due`, `partial` |
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
| `cgst_rate`, `sgst_rate` | Numeric(5,2) | Half of gst_rate each |
| `taxable_amount_paise` | Integer | `mrp × qty - discount` |
| `cgst_paise`, `sgst_paise` | Integer | Split GST amounts |
| `gst_paise` | Integer | Total GST for this line |
| `line_total_paise` | Integer | `taxable + gst` |
| `line_cost_paise` | Integer | `cost × qty` |

**Critical rule:** Never use `product_id` to look up product name for bill display.
Always use `product_name` (the snapshot column).

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
| `purchase_date` | Date | — |
| `grn_number` | String(50) | Goods Receipt Note number |
| `subtotal_paise` | Integer | — |
| `total_discount_paise` | Integer | Trade discount total |
| `total_gst_paise` | Integer | ITC-eligible GST |
| `grand_total_paise` | Integer | Payable to supplier |
| `amount_paid_paise` | Integer | Amount paid so far |
| `status` | String(20) | `draft`, `confirmed` |
| `payment_status` | String(20) | `unpaid`, `partial`, `paid` |
| `due_date` | Date | Payment due date |
| `deleted_at` | TIMESTAMP | Soft delete |

---

### `purchase_items`
Line items on a purchase. Creates stock_batches when purchase is confirmed.

| Column | Type | Notes |
|--------|------|-------|
| `product_id` | UUID FK → products | — |
| `batch_id` | UUID FK → stock_batches | Set when purchase confirmed |
| `product_name` | String(300) | Snapshot |
| `batch_number` | String(100) | As on supplier invoice |
| `expiry_date` | Date | As on supplier invoice |
| `quantity_ordered` | Integer | — |
| `quantity_received` | Integer | May differ from ordered |
| `mrp_paise` | Integer | MRP on this batch |
| `cost_price_paise` | Integer | PTR after discount |
| `discount_percent` | Numeric(5,2) | Trade discount |
| `gst_rate` | Numeric(5,2) | GST rate for ITC |

---

### `customers`

| Column | Type | Notes |
|--------|------|-------|
| `name` | String(200) | — |
| `phone` | String(10) | Primary identifier for walk-in customers |
| `customer_type` | String(20) | `retail`, `wholesale`, `institution` |
| `gstin` | String(15) | For B2B customers |
| `credit_limit_paise` | Integer | Max outstanding allowed |
| `outstanding_paise` | Integer | Current amount owed |
| `deleted_at` | TIMESTAMP | Soft delete |

---

### `doctors`
Prescribing doctors. Required for Schedule H1 billing.

| Column | Type | Notes |
|--------|------|-------|
| `name` | String(200) | — |
| `registration_number` | String(100) | Medical Council reg number |
| `specialization` | String(200) | e.g. "General Physician" |
| `hospital` | String(200) | — |
| `phone` | String(10) | — |
| `deleted_at` | TIMESTAMP | Soft delete |

---

### `suppliers`

| Column | Type | Notes |
|--------|------|-------|
| `name` | String(200) | Distributor/stockist name |
| `gstin` | String(15) | For ITC reconciliation |
| `drug_license_number` | String(50) | Supplier's drug license |
| `credit_days` | Integer | Default 30 — payment terms |
| `credit_limit_paise` | Integer | Optional credit limit |
| `deleted_at` | TIMESTAMP | Soft delete |

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
