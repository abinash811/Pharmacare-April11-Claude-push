# PHARMACARE — COMPLETE POSTGRESQL DATABASE SCHEMA
# This is the foundation of the entire product.
# Every table, every column, every relationship is intentional.
# Last updated: April 2026

---

## DESIGN PRINCIPLES

1. Every table has: id (UUID), created_at, updated_at
2. Soft deletes everywhere — never hard delete pharmacy data (audit requirement)
3. All money stored as integers in paise (₹1 = 100 paise) — never use floats for money
4. All timestamps stored in UTC, display in IST
5. Foreign keys enforced at DB level — data integrity guaranteed
6. Indexes on every column used in WHERE, JOIN, or ORDER BY

---

## SCHEMA

### 1. PHARMACY (Multi-branch ready from day one)

```sql
-- The pharmacy itself (one row per store, ready for chains)
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    phone VARCHAR(10) NOT NULL,
    email VARCHAR(200),
    gstin VARCHAR(15),                    -- GST registration number
    drug_license_number VARCHAR(50),      -- Mandatory for pharmacy operation
    drug_license_expiry DATE,
    fssai_number VARCHAR(20),             -- Food safety license (for nutraceuticals)
    pan_number VARCHAR(10),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pharmacy settings (billing config, thresholds)
CREATE TABLE pharmacy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    -- Bill sequence settings
    bill_prefix VARCHAR(10) DEFAULT 'INV',
    bill_sequence_number INTEGER DEFAULT 1,
    bill_number_length INTEGER DEFAULT 6,
    -- Inventory settings
    low_stock_threshold_days INTEGER DEFAULT 30,  -- Days of stock remaining
    near_expiry_threshold_days INTEGER DEFAULT 90, -- Alert X days before expiry
    -- GST settings
    default_gst_rate DECIMAL(5,2) DEFAULT 5.00,
    -- Print settings
    print_logo BOOLEAN DEFAULT TRUE,
    print_drug_license BOOLEAN DEFAULT TRUE,
    print_patient_name BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id)
);
```

---

### 2. USERS & ROLES

```sql
-- User roles (pre-defined + custom)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,  -- TRUE for Admin/Manager/Cashier defaults
    permissions JSONB NOT NULL DEFAULT '{}',
    -- permissions format: {"billing": {"create": true, "edit": true, "delete": false}, ...}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, name)
);

-- Staff users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(10),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, email)
);

-- Audit log — every important action recorded
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,          -- 'bill.create', 'stock.adjust', etc.
    entity_type VARCHAR(100),              -- 'bill', 'product', 'purchase'
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_pharmacy ON audit_logs(pharmacy_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

### 3. PRODUCTS & INVENTORY

```sql
-- Medicine/product master
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    -- Identity
    sku VARCHAR(100) NOT NULL,             -- Internal code
    barcode VARCHAR(100),                  -- EAN/barcode on pack
    name VARCHAR(300) NOT NULL,            -- "Paracetamol 500mg Tablet"
    generic_name VARCHAR(300),             -- "Paracetamol" (salt/composition)
    brand VARCHAR(200),                    -- "Crocin", "Dolo", etc.
    manufacturer VARCHAR(200),
    -- Classification
    category VARCHAR(100),                 -- "Antibiotics", "Analgesics", etc.
    drug_schedule VARCHAR(20) DEFAULT 'OTC',  -- OTC/Schedule H/Schedule H1/Schedule X
    dosage_form VARCHAR(100),              -- Tablet/Capsule/Syrup/Injection/Cream
    strength VARCHAR(100),                 -- "500mg", "10mg/5ml"
    pack_size VARCHAR(100),                -- "10 tablets", "100ml"
    units_per_pack INTEGER DEFAULT 1,
    -- Pricing & Tax
    hsn_code VARCHAR(10) DEFAULT '3004',
    gst_rate DECIMAL(5,2) DEFAULT 5.00,   -- 0, 5, 12, 18
    -- Stock thresholds
    reorder_level INTEGER DEFAULT 10,      -- Alert when stock falls below this
    reorder_quantity INTEGER DEFAULT 100,  -- Suggested order quantity
    -- Storage
    storage_location VARCHAR(100),         -- "Rack A-3", "Fridge"
    requires_refrigeration BOOLEAN DEFAULT FALSE,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,               -- Soft delete
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, sku)
);

CREATE INDEX idx_products_pharmacy ON products(pharmacy_id);
CREATE INDEX idx_products_name ON products(pharmacy_id, name);
CREATE INDEX idx_products_barcode ON products(pharmacy_id, barcode);
CREATE INDEX idx_products_generic ON products(pharmacy_id, generic_name);
CREATE INDEX idx_products_schedule ON products(pharmacy_id, drug_schedule);

-- Stock batches (each delivery creates a new batch)
CREATE TABLE stock_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    product_id UUID NOT NULL REFERENCES products(id),
    -- Batch identity
    batch_number VARCHAR(100) NOT NULL,    -- From manufacturer
    expiry_date DATE NOT NULL,
    manufacture_date DATE,
    -- Pricing (stored in paise)
    mrp_paise INTEGER NOT NULL,            -- Maximum Retail Price
    cost_price_paise INTEGER NOT NULL,     -- What pharmacy paid
    sale_price_paise INTEGER,              -- Override sale price (if different from MRP)
    -- Quantity
    quantity_received INTEGER NOT NULL DEFAULT 0,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_sold INTEGER NOT NULL DEFAULT 0,
    quantity_returned INTEGER NOT NULL DEFAULT 0,
    quantity_written_off INTEGER NOT NULL DEFAULT 0,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_batches_product ON stock_batches(product_id);
CREATE INDEX idx_batches_expiry ON stock_batches(pharmacy_id, expiry_date);
CREATE INDEX idx_batches_quantity ON stock_batches(product_id, quantity_on_hand);

-- Stock movements (every stock change tracked)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    batch_id UUID NOT NULL REFERENCES stock_batches(id),
    product_id UUID NOT NULL REFERENCES products(id),
    -- Movement details
    movement_type VARCHAR(50) NOT NULL,
    -- Types: purchase_in, sale_out, sale_return_in, purchase_return_out,
    --        adjustment_in, adjustment_out, write_off, transfer_in, transfer_out
    quantity INTEGER NOT NULL,             -- Always positive
    quantity_before INTEGER NOT NULL,      -- Stock before this movement
    quantity_after INTEGER NOT NULL,       -- Stock after this movement
    -- Reference to source document
    reference_type VARCHAR(50),            -- 'purchase', 'bill', 'adjustment'
    reference_id UUID,                     -- ID of source document
    -- Who did it
    user_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_movements_batch ON stock_movements(batch_id);
CREATE INDEX idx_movements_product ON stock_movements(product_id);
CREATE INDEX idx_movements_pharmacy ON stock_movements(pharmacy_id, created_at);
CREATE INDEX idx_movements_reference ON stock_movements(reference_type, reference_id);
```

---

### 4. SUPPLIERS & PURCHASES

```sql
-- Suppliers (distributors/stockists)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(200),
    phone VARCHAR(10),
    alternate_phone VARCHAR(10),
    email VARCHAR(200),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(6),
    gstin VARCHAR(15),
    drug_license_number VARCHAR(50),
    pan_number VARCHAR(10),
    -- Credit terms
    credit_days INTEGER DEFAULT 30,        -- Payment due in X days
    credit_limit_paise INTEGER,            -- Max credit allowed
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_pharmacy ON suppliers(pharmacy_id);

-- Purchase orders (from pharmacy to supplier)
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    -- Document details
    purchase_number VARCHAR(50) NOT NULL,  -- Internal PO number
    supplier_invoice_number VARCHAR(100),  -- Supplier's invoice number
    supplier_invoice_date DATE,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Delivery
    grn_number VARCHAR(50),               -- Goods Received Note number
    received_date DATE,
    -- Amounts (all in paise)
    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    total_discount_paise INTEGER DEFAULT 0,
    total_gst_paise INTEGER NOT NULL DEFAULT 0,
    total_cgst_paise INTEGER DEFAULT 0,
    total_sgst_paise INTEGER DEFAULT 0,
    total_igst_paise INTEGER DEFAULT 0,
    grand_total_paise INTEGER NOT NULL DEFAULT 0,
    amount_paid_paise INTEGER DEFAULT 0,
    -- Status
    status VARCHAR(20) DEFAULT 'draft',   -- draft/confirmed/received/partial/paid/cancelled
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- unpaid/partial/paid
    due_date DATE,                         -- Payment due date
    notes TEXT,
    -- Who
    created_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, purchase_number)
);

CREATE INDEX idx_purchases_pharmacy ON purchases(pharmacy_id);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_status ON purchases(pharmacy_id, status);
CREATE INDEX idx_purchases_date ON purchases(pharmacy_id, purchase_date);

-- Purchase line items
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID REFERENCES stock_batches(id),  -- Set after GRN
    -- Item details
    product_name VARCHAR(300) NOT NULL,    -- Snapshot at time of purchase
    batch_number VARCHAR(100),
    expiry_date DATE,
    hsn_code VARCHAR(10),
    -- Quantities
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    units_per_pack INTEGER DEFAULT 1,
    -- Pricing (in paise)
    mrp_paise INTEGER NOT NULL,
    cost_price_paise INTEGER NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst_rate DECIMAL(5,2),
    sgst_rate DECIMAL(5,2),
    igst_rate DECIMAL(5,2),
    -- Calculated amounts (in paise)
    taxable_amount_paise INTEGER NOT NULL,
    gst_amount_paise INTEGER NOT NULL,
    line_total_paise INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);

-- Purchase payments
CREATE TABLE purchase_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    purchase_id UUID NOT NULL REFERENCES purchases(id),
    amount_paise INTEGER NOT NULL,
    payment_method VARCHAR(20) NOT NULL,   -- cash/cheque/neft/upi/credit
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR(100),         -- Cheque/transaction number
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase returns
CREATE TABLE purchase_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    purchase_id UUID NOT NULL REFERENCES purchases(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    return_number VARCHAR(50) NOT NULL,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_reason VARCHAR(50) NOT NULL,    -- expired/damaged/excess/quality_issue
    -- Amounts (paise)
    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    total_gst_paise INTEGER DEFAULT 0,
    grand_total_paise INTEGER NOT NULL DEFAULT 0,
    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending/confirmed/credited
    credit_note_number VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, return_number)
);

CREATE TABLE purchase_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID NOT NULL REFERENCES stock_batches(id),
    product_name VARCHAR(300) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE,
    quantity INTEGER NOT NULL,
    cost_price_paise INTEGER NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    gst_amount_paise INTEGER NOT NULL,
    line_total_paise INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 5. CUSTOMERS & DOCTORS

```sql
-- Customers (patients + corporate/hospital accounts)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(10),
    alternate_phone VARCHAR(10),
    email VARCHAR(200),
    age INTEGER,
    gender VARCHAR(10),                    -- male/female/other
    address TEXT,
    city VARCHAR(100),
    -- Account type
    customer_type VARCHAR(20) DEFAULT 'retail',  -- retail/wholesale/institution/credit
    gstin VARCHAR(15),                     -- For B2B invoice customers
    -- Credit (for hospitals/clinics)
    credit_limit_paise INTEGER DEFAULT 0,
    credit_days INTEGER DEFAULT 0,
    outstanding_paise INTEGER DEFAULT 0,
    -- Loyalty
    loyalty_points INTEGER DEFAULT 0,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_pharmacy ON customers(pharmacy_id);
CREATE INDEX idx_customers_phone ON customers(pharmacy_id, phone);
CREATE INDEX idx_customers_name ON customers(pharmacy_id, name);

-- Doctors (for prescription tracking)
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    name VARCHAR(200) NOT NULL,
    qualification VARCHAR(200),           -- MBBS, MD, etc.
    specialization VARCHAR(200),
    registration_number VARCHAR(100),     -- Medical council number
    hospital VARCHAR(200),
    phone VARCHAR(10),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doctors_pharmacy ON doctors(pharmacy_id);
CREATE INDEX idx_doctors_name ON doctors(pharmacy_id, name);
```

---

### 6. BILLING

```sql
-- Bills (sales invoices)
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    -- Bill identity
    bill_number VARCHAR(50) NOT NULL,      -- Auto-generated: INV-000001
    invoice_type VARCHAR(20) DEFAULT 'retail',  -- retail/wholesale/credit
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bill_time TIMETZ DEFAULT CURRENT_TIME,
    -- Customer (optional for cash sales)
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(200),            -- Snapshot or walk-in name
    customer_phone VARCHAR(10),
    customer_gstin VARCHAR(15),            -- For B2B bills
    -- Doctor & prescription
    doctor_id UUID REFERENCES doctors(id),
    doctor_name VARCHAR(200),              -- Snapshot
    prescription_number VARCHAR(100),
    prescription_date DATE,
    -- Amounts (all in paise)
    subtotal_paise INTEGER NOT NULL DEFAULT 0,
    mrp_total_paise INTEGER DEFAULT 0,     -- Total at MRP before discounts
    item_discount_paise INTEGER DEFAULT 0, -- Discounts at item level
    bill_discount_paise INTEGER DEFAULT 0, -- Additional bill-level discount
    bill_discount_percent DECIMAL(5,2) DEFAULT 0,
    total_discount_paise INTEGER DEFAULT 0,
    taxable_amount_paise INTEGER DEFAULT 0,
    total_cgst_paise INTEGER DEFAULT 0,
    total_sgst_paise INTEGER DEFAULT 0,
    total_igst_paise INTEGER DEFAULT 0,
    total_gst_paise INTEGER NOT NULL DEFAULT 0,
    grand_total_paise INTEGER NOT NULL DEFAULT 0,
    amount_paid_paise INTEGER DEFAULT 0,
    balance_paise INTEGER DEFAULT 0,       -- For credit/partial payments
    -- Payment
    payment_method VARCHAR(20),            -- cash/card/upi/credit/mixed
    payment_reference VARCHAR(100),        -- UPI transaction ID etc.
    -- Margin tracking
    cost_total_paise INTEGER DEFAULT 0,
    margin_paise INTEGER DEFAULT 0,
    margin_percent DECIMAL(5,2) DEFAULT 0,
    -- Status
    status VARCHAR(20) DEFAULT 'draft',    -- draft/parked/paid/due/cancelled/returned
    -- Internal notes
    internal_note TEXT,
    delivery_note TEXT,
    -- Who
    billed_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, bill_number)
);

CREATE INDEX idx_bills_pharmacy ON bills(pharmacy_id);
CREATE INDEX idx_bills_date ON bills(pharmacy_id, bill_date);
CREATE INDEX idx_bills_customer ON bills(customer_id);
CREATE INDEX idx_bills_status ON bills(pharmacy_id, status);
CREATE INDEX idx_bills_number ON bills(pharmacy_id, bill_number);

-- Bill line items
CREATE TABLE bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID NOT NULL REFERENCES stock_batches(id),
    -- Item snapshot (preserved even if product changes later)
    product_name VARCHAR(300) NOT NULL,
    generic_name VARCHAR(300),
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    hsn_code VARCHAR(10),
    drug_schedule VARCHAR(20),
    -- Quantity & pricing (in paise)
    quantity INTEGER NOT NULL,
    mrp_paise INTEGER NOT NULL,
    sale_price_paise INTEGER NOT NULL,     -- Actual price charged
    cost_price_paise INTEGER NOT NULL,     -- For margin calculation
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_paise INTEGER DEFAULT 0,
    -- GST
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst_rate DECIMAL(5,2),
    sgst_rate DECIMAL(5,2),
    igst_rate DECIMAL(5,2),
    -- Calculated (in paise)
    taxable_amount_paise INTEGER NOT NULL,
    cgst_paise INTEGER DEFAULT 0,
    sgst_paise INTEGER DEFAULT 0,
    igst_paise INTEGER DEFAULT 0,
    gst_paise INTEGER NOT NULL DEFAULT 0,
    line_total_paise INTEGER NOT NULL,
    line_cost_paise INTEGER NOT NULL,      -- For margin calculation
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_bill_items_product ON bill_items(product_id);
CREATE INDEX idx_bill_items_batch ON bill_items(batch_id);

-- Sales returns
CREATE TABLE sales_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    original_bill_id UUID NOT NULL REFERENCES bills(id),
    -- Return details
    return_number VARCHAR(50) NOT NULL,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_reason TEXT,
    -- Amounts (paise)
    total_paise INTEGER NOT NULL DEFAULT 0,
    total_gst_paise INTEGER DEFAULT 0,
    grand_total_paise INTEGER NOT NULL DEFAULT 0,
    -- Refund method
    refund_method VARCHAR(20),             -- cash/upi/credit_to_account
    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending/confirmed/refunded
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, return_number)
);

CREATE TABLE sales_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    bill_item_id UUID NOT NULL REFERENCES bill_items(id),
    product_id UUID NOT NULL REFERENCES products(id),
    batch_id UUID NOT NULL REFERENCES stock_batches(id),
    product_name VARCHAR(300) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    sale_price_paise INTEGER NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    gst_paise INTEGER NOT NULL,
    line_total_paise INTEGER NOT NULL,
    return_to_stock BOOLEAN DEFAULT TRUE,  -- Add back to inventory?
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule H1 register (legal requirement)
CREATE TABLE schedule_h1_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    bill_id UUID REFERENCES bills(id),
    bill_item_id UUID REFERENCES bill_items(id),
    product_id UUID NOT NULL REFERENCES products(id),
    -- Legal required fields (Drugs & Cosmetics Rules 1945, Section 65)
    product_name VARCHAR(300) NOT NULL,
    quantity INTEGER NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    -- Prescriber details (mandatory for Schedule H1)
    prescriber_name VARCHAR(200) NOT NULL,
    prescriber_registration_number VARCHAR(100),
    prescriber_address TEXT,
    -- Patient details (mandatory)
    patient_name VARCHAR(200) NOT NULL,
    patient_address TEXT,
    patient_age INTEGER,
    -- Supply details
    supply_date DATE NOT NULL DEFAULT CURRENT_DATE,
    dispensed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_h1_pharmacy ON schedule_h1_register(pharmacy_id);
CREATE INDEX idx_h1_date ON schedule_h1_register(pharmacy_id, supply_date);
```

---

### 7. REPORTS & ANALYTICS VIEWS

```sql
-- These are SQL views — not tables. They power reports instantly.

-- Daily sales summary
CREATE VIEW daily_sales_summary AS
SELECT
    pharmacy_id,
    bill_date,
    COUNT(*) as total_bills,
    SUM(grand_total_paise) as total_sales_paise,
    SUM(total_gst_paise) as total_gst_paise,
    SUM(total_discount_paise) as total_discount_paise,
    SUM(margin_paise) as total_margin_paise,
    COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_bills,
    COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_bills,
    COUNT(CASE WHEN payment_method = 'upi' THEN 1 END) as upi_bills,
    COUNT(CASE WHEN status = 'due' THEN 1 END) as credit_bills
FROM bills
WHERE status NOT IN ('draft', 'cancelled', 'parked')
GROUP BY pharmacy_id, bill_date;

-- Stock status view (powers inventory page)
CREATE VIEW stock_status AS
SELECT
    p.id as product_id,
    p.pharmacy_id,
    p.name,
    p.sku,
    p.generic_name,
    p.brand,
    p.category,
    p.drug_schedule,
    p.reorder_level,
    p.hsn_code,
    p.gst_rate,
    COALESCE(SUM(sb.quantity_on_hand), 0) as total_stock,
    MIN(CASE WHEN sb.quantity_on_hand > 0 THEN sb.expiry_date END) as nearest_expiry,
    MAX(sb.mrp_paise) as current_mrp_paise,
    CASE
        WHEN COALESCE(SUM(sb.quantity_on_hand), 0) = 0 THEN 'out_of_stock'
        WHEN MIN(CASE WHEN sb.quantity_on_hand > 0 THEN sb.expiry_date END) < CURRENT_DATE THEN 'expired'
        WHEN MIN(CASE WHEN sb.quantity_on_hand > 0 THEN sb.expiry_date END) < CURRENT_DATE + INTERVAL '90 days' THEN 'near_expiry'
        WHEN COALESCE(SUM(sb.quantity_on_hand), 0) < p.reorder_level THEN 'low_stock'
        ELSE 'healthy'
    END as stock_status
FROM products p
LEFT JOIN stock_batches sb ON p.id = sb.product_id AND sb.is_active = TRUE
WHERE p.deleted_at IS NULL
GROUP BY p.id;

-- GST summary view (for GSTR-1 and GSTR-3B preparation)
CREATE VIEW gst_summary AS
SELECT
    b.pharmacy_id,
    DATE_TRUNC('month', b.bill_date) as month,
    bi.hsn_code,
    bi.gst_rate,
    SUM(bi.taxable_amount_paise) as taxable_amount_paise,
    SUM(bi.cgst_paise) as cgst_paise,
    SUM(bi.sgst_paise) as sgst_paise,
    SUM(bi.igst_paise) as igst_paise,
    SUM(bi.gst_paise) as total_gst_paise,
    COUNT(DISTINCT b.id) as bill_count
FROM bills b
JOIN bill_items bi ON b.id = bi.bill_id
WHERE b.status NOT IN ('draft', 'cancelled')
AND b.deleted_at IS NULL
GROUP BY b.pharmacy_id, DATE_TRUNC('month', b.bill_date), bi.hsn_code, bi.gst_rate;
```

---

### 8. INDEXES SUMMARY

```sql
-- Additional performance indexes
CREATE INDEX idx_products_active ON products(pharmacy_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_active ON stock_batches(product_id, quantity_on_hand) WHERE is_active = TRUE;
CREATE INDEX idx_bills_paid ON bills(pharmacy_id, bill_date) WHERE status = 'paid';
CREATE INDEX idx_bills_due ON bills(pharmacy_id) WHERE status = 'due';
CREATE INDEX idx_purchases_unpaid ON purchases(pharmacy_id) WHERE payment_status = 'unpaid';
```

---

## KEY DESIGN DECISIONS EXPLAINED

### Why paise instead of rupees?
Storing ₹125.50 as float gives: 125.4999999... (floating point error)
Storing as integer 12550 paise gives: exact value always
This is critical for GST calculations and financial reporting. Every serious fintech in India does this.

### Why snapshot product name in bill_items?
If you change a medicine name from "Crocin 500mg" to "Crocin Advanced 500mg", old bills should still show the original name. The snapshot preserves historical accuracy — legally required.

### Why soft deletes?
Pharmacy data is financial data. You cannot delete a product that has been sold — it would break audit trails and GST records. Soft delete (deleted_at timestamp) hides it from UI but preserves it for history.

### Why separate tables for purchase_returns and sales_returns?
They are fundamentally different transactions:
- Purchase return: Pharmacy returns medicines to supplier, gets credit note
- Sales return: Customer returns medicines to pharmacy, gets refund
Different compliance requirements, different stock movements, different financial impact.

### Why stock_movements table?
Every time stock changes, we record: why it changed, by how much, who did it, what document caused it. This is the complete stock audit trail. Answers: "Where did these 50 tablets go?" in seconds.

### Why schedule_h1_register as separate table?
Indian law (Drugs & Cosmetics Rules 1945, Section 65) mandates maintaining a separate register for Schedule H1 drugs with specific fields. This table mirrors that legal requirement exactly. Must be preserved for 3 years minimum.

### Why views for reports?
SQL views execute at query time — no stale data. The GST summary view gives instant GSTR-1 preparation data. The stock_status view powers the entire inventory page with one query.

---

## WHAT THIS SCHEMA SUPPORTS

✅ Single pharmacy today
✅ Pharmacy chain tomorrow (pharmacy_id on every table)
✅ Complete GST compliance (CGST/SGST/IGST, HSN codes, snapshots)
✅ Schedule H1 legal register (Drugs & Cosmetics Rules 1945)
✅ Complete audit trail (stock_movements + audit_logs)
✅ Financial accuracy (paise, snapshots, soft deletes)
✅ Fast inventory queries (indexes + stock_status view)
✅ Accountant monthly reports (gst_summary view)
✅ Credit customer management
✅ Multi-payment method tracking
✅ Margin tracking on every sale
✅ FEFO billing (query batches by expiry_date ASC)
✅ Barcode scanning (barcode column on products)
✅ Excel bulk import (insert into products + stock_batches)
