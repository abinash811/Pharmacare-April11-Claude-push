# PharmaCare Application - Product Requirements Document

## Original Problem Statement
The user initiated a comprehensive audit and refactoring of the PharmaCare application's Inventory module. The goal is to ensure the module is robust, scalable, and adheres to a strict set of business rules.

## User Personas
- **Admin**: Full access to all features including user management, roles, and settings
- **Manager**: Access to inventory, purchases, sales, and reports
- **Cashier**: Limited access to billing and basic inventory viewing
- **Inventory Staff**: Focused access to inventory management features


## NEW: Purchases & Purchase Returns Module Overhaul (Mar 29, 2026)
Complete redesign of Purchases module to match PharmaCare design system.

### PurchasesList.js Enhancements
- [x] Payment column with Paid/Due/Partial badges
- [x] Due badge clickable - opens "Mark as Paid" modal
- [x] Mark as Paid modal: Shows purchase info, outstanding amount, payment methods (CASH/Bank/CHEQUE/UPI), reference #, notes
- [x] Two-row sticky footer like BillingOperations
- [x] Summary stats cards: Total Purchases, Purchase Value, Due Amount, Total Returns
- [x] Filter bar: Search, Supplier, Status, Payment Status, Date range

### PurchaseNew.js Complete Redesign
- [x] Top Controls row: PO # (coming soon), Gate Pass (coming soon), Settings gear
- [x] Settings Modal with:
  - Order Type (Direct/Credit/Consignment)
  - GST (With GST/Without GST)
  - Purchase On (Credit/Cash)
  - Default Batch Priority (LIFA/LILA)
- [x] Meta row: Supplier typeahead, Invoice #, Bill Date picker, Due Date picker (for credit)
- [x] Order type, GST, and Payment badges displayed
- [x] Product search bar with medicine search
- [x] Items table columns: #, Medicine, Batch, Expiry, Qty, Free, PTR, MRP, GST%, LIFA, Amount, Delete
- [x] Per-row LIFA/LILA dropdown
- [x] Two-row sticky footer: Row 1 (Items/Qty/Free/Subtotal/GST/Round), Row 2 (Total/Credit badge/Actions)
- [x] Invoice Breakdown modal on Confirm with summary and internal note

### PurchaseDetail.js Redesign
- [x] Header with status and payment badges
- [x] Purchase info: Supplier, Purchase Date, Invoice #, Due Date, Total
- [x] Items/Receipts tabs
- [x] Items table with Ordered/Received/Pending columns and status icons
- [x] Receive Goods dialog for partial receipts
- [x] Totals breakdown (Subtotal, GST, Round Off, Total)

### Backend Enhancements (server.py)
- [x] Supplier model: Added `outstanding` (float) and `payment_history` (array) fields
- [x] SupplierPayment model for tracking payment records
- [x] StockBatch model: Added `ptr_per_unit`, `lp_per_unit`, `batch_priority` (LIFA/LILA), `purchase_id`
- [x] Product model: Added `landing_price_per_unit` (LP) field
- [x] PurchaseCreate: Added `due_date`, `order_type`, `with_gst`, `purchase_on`, `payment_status`
- [x] PurchaseItemCreate: Added `free_qty_units`, `ptr_per_unit`, `batch_priority`
- [x] POST /api/purchases: On confirmed purchase:
  - Creates stock batch with PTR, LP, and batch_priority
  - Updates product.landing_price_per_unit to PTR
  - For credit purchases: adds total to supplier.outstanding
- [x] POST /api/purchases/{id}/pay: Records payment, reduces supplier.outstanding, adds to payment_history
- [x] Cash purchases auto-marked as paid when confirmed
- [x] Due date auto-calculated from supplier.payment_terms_days

### Business Rules
- [x] LIFA (Last In First Available) = Newest batch sold first (default)
- [x] LILA (Last In Last Available) = Oldest batch sold first (FIFO)
- [x] LP = PTR for v1 (Landing Price equals Price To Retailer)
- [x] Free quantity added to stock (qty_units + free_qty_units)
- [x] Distributors = Suppliers (same collection, no duplication)

### Test Status
- Backend: 93.75% (15/16 tests passed) - iteration_16.json
- Frontend: 100% (all UI elements verified)
- Created: /app/backend/tests/test_purchases_module.py


## NEW: Sales Returns Module (Mar 26, 2026)
Complete Sales Returns module implementation:

### Screen 1: Sales Returns List (/billing/returns)
- [x] Page header with "Sales Returns" title, today's return count and total amount
- [x] "+ New Return" button (permission-controlled)
- [x] Filter bar: search, date range picker, payment type filter (All/Cash/UPI/Credit)
- [x] Table columns: Return No. | Original Bill | Patient | Entry Date | Return Date | Entry By | Amount | Payment | Actions
- [x] Return No. in teal monospace (e.g. #CN-00001)
- [x] Amount displayed in red (refund/negative transaction)
- [x] Footer: Returns today X | Total refunded ₹X

### Screen 2: Create Return (/billing/returns/new)
- [x] Triggered from billing list "Return" button or directly via "+ New Return"
- [x] Pre-fills items from original bill when billId is provided
- [x] Subbar chips: Date picker | Customer | Billing For | Doctor | Billed By | Payment Type | Save
- [x] Table columns: Item Name | Unit/Pack | Batch | Expiry | MRP | Qty | Disc% | D.Price | GST% | Amount | Delete
- [x] Qty validation: return qty ≤ original billed qty with inline red error
- [x] "Damaged" checkbox per item (routes stock to damaged_stock)
- [x] Sticky footer with totals: Items, MRP Total, Total Discount, GST, Net Refund Amount
- [x] Invoice Breakdown modal on save with note field

### Screen 3: View Saved Return (/billing/returns/:id)
- [x] Read-only view with breadcrumb navigation
- [x] Header info: Return No., Original Bill, Bill Date, Customer, Billing For, Doctor
- [x] Payment badge and date in top right
- [x] "More" dropdown: Edit, Print, Sales History, Logs
- [x] Item table (read-only) with same columns as create
- [x] Footer totals: Qty, Items, GST, Net Amount

### Screen 4: Edit Saved Return
- [x] Edit modal with two options:
  - Non-Financial Edit: Staff, Billing For, Doctor, Note (no inventory change)
  - Financial Edit: Full workspace (requires allow_financial_edit_return permission)

### Backend API Endpoints
- [x] POST /api/sales-returns - Create return with stock increment
- [x] GET /api/sales-returns - List with filters and pagination
- [x] GET /api/sales-returns/{id} - Get single return
- [x] PUT /api/sales-returns/{id} - Update return (financial/non-financial)
- [x] GET /api/roles/{role_name}/permissions/returns - Get return permissions

### Business Rules Implemented
- [x] Stock increment on return save (same medicine, same batch)
- [x] Damaged items go to damaged_stock instead of sellable stock
- [x] Qty validation: return qty ≤ original billed qty
- [x] Auto-generated credit note numbers (CN-00001, CN-00002...)
- [x] Role permissions: allow_manual_returns, allow_financial_edit_return
- [x] Original bill updated with returnId reference
- [x] "Returned" indicator on billing list

### Data Model (sales_returns collection)
```javascript
{
  id, return_no: "CN-00001", original_bill_id, original_bill_no,
  return_date, entry_date, patient: {id, name, phone},
  billing_for, doctor, created_by: {id, name},
  items: [{medicine_id, medicine_name, batch_no, expiry, mrp, qty, original_qty, disc_percent, disc_price, gst_percent, amount, is_damaged}],
  mrp_total, total_discount, gst_amount, round_off, net_amount,
  payment_type, refund_method, note, status: "completed", credit_note_ref
}
```

## NEW: Inventory Search-First Redesign (Feb 22, 2026)
- [x] Complete redesign with search-first approach (no auto-load list)
- [x] Teal/Cyan (#00CED1) color theme matching PharmaSync design
- [x] Empty state with "Ready to manage stock?" message on page load
- [x] Search triggers after 2+ characters with 500ms debouncing
- [x] Right-side filter drawer with filters: Category, Dosage Type, Schedule Type, GST %, Location, Stock Status
- [x] Filter tags appear below search bar with individual removal (X button)
- [x] Reset All option for clearing filters
- [x] Minimal column table: Medicine (with image, name, manufacturer, pack info), Total Stock, Location, Discount %, Nearest Expiry, Status Badge, Actions
- [x] Bulk selection with checkboxes (including Select All)
- [x] Bulk Update modal for updating: Location, Discount %, GST %, Category, Schedule
- [x] Add Stock button (cyan) - Opens modal to add new product with initial stock
- [x] Bulk Upload button (gray) - Opens existing Excel upload wizard
- [x] Edit and Adjust action buttons per row
- [x] Row click navigates to medicine detail page
- [x] Summary cards: Total Items, Low Stock, Expiring Soon
- [x] View Low Stock quick filter button

## NEW: Medicine Detail Page (Feb 22, 2026)
- [x] Dedicated detail page at /inventory/product/:sku
- [x] Breadcrumb navigation (INVENTORY > CATEGORY) with back link
- [x] Product header: Image placeholder, Name, Manufacturer/Brand, Pack Info
- [x] Edit button (teal), Bell icon, History clock icon
- [x] 6 Stats cards: GST %, Stock (packs/units), HSN, MRP, Schedule, Composition
- [x] 6 Tabs: Batches, Purchases, Pur. Return, Sales, Sales Return, Ledger
- [x] Batches tab with: Hide Zero quantity toggle, Delete Batches button (red), Print QR button (teal)
- [x] Batch table columns: Batch ID, Qty, Exp Date, MRP, Prev MRP (strikethrough), PTR, Disc %, LP, Margin%
- [x] Expiry highlighting: Orange for nearing expiry (3m), Red for expired
- [x] Margin % displayed in teal color
- [x] Batch selection with checkboxes
- [x] Ledger tab showing full stock movement history
- [x] Footer with batch count and status legend (Active/Nearing/Expired)

## NEW: Transaction Linking in Medicine Detail (Feb 22, 2026)
- [x] API endpoint GET /api/products/{sku}/transactions returns all linked transactions
- [x] Purchases tab: Shows all purchase records with Purchase #, Date, Supplier, Invoice #, Batch, Qty, Cost, MRP, Total, Status
- [x] Sales tab: Shows all sales records with Bill #, Date, Customer, Batch, Qty, Unit Price, Discount, Total, Status
- [x] Purchase Returns tab: Shows return records with Return #, Date, Supplier, Original Purchase, Batch, Qty, Reason, Amount, Status
- [x] Sales Returns tab: Shows return records with Return #, Date, Customer, Original Invoice, Batch, Qty, Refund Amount, Status
- [x] Record counts displayed (e.g., "4 records")
- [x] Status badges with correct colors (paid/confirmed=green, due=red, draft=gray)
- [x] Lazy loading: Transactions fetched only when user clicks on tab

## NEW: Billing Workspace Redesign (Feb 18, 2026)
- [x] Modern PharmaSync design with teal accent (#13ecda)
- [x] Header with Search Medicine (Ctrl+F), User Terminal info
- [x] Customer form: Patient Name, Phone, Doctor, Billed By, Payment Type
- [x] Medicine table: #, Medicine Name, Batch No, Expiry, Qty, Unit Price, Disc %, GST %, Net Amount
- [x] Totals section: Subtotal, Discounts, Tax (GST), Items in Cart, Grand Total
- [x] Workflow buttons: WhatsApp, Draft, Hold Bill, Logs, Inventory, Clear
- [x] Footer with keyboard shortcuts
- [x] Draft auto-save to localStorage
- [x] **Save & Print (Feb 22, 2026)**:
  - Bill saves to database via POST /api/bills
  - Print dialog modal appears showing: Invoice #, Customer, Items count, Payment method, Total
  - "Print Receipt" button triggers window.print() for thermal receipt (80mm format)
  - "Close" button clears bill and starts new transaction
- [x] Complete redesign of billing page with PharmaSync-style UI
- [x] Global search bar with Ctrl+F shortcut
- [x] Customer details section (Patient Name, Phone, Doctor, Billed By, Payment Type)
- [x] Inline editable billing table with batch details
- [x] Workflow buttons (WhatsApp, Draft, Hold Bill, Logs, Inventory, Clear)
- [x] Grand Total display with teal color theme
- [x] Keyboard shortcuts (Ctrl+F, F8, F12)
- [x] Auto-save draft functionality
- [x] Expiring items highlighted in amber

## Core Requirements (Inventory Module)

### Inventory Display (CRITICAL)
- [x] Main inventory list must be product-wise, not batch-wise
- [x] Sorted by severity before pagination (1. Critical: Expired/Out-of-stock, 2. Warning: Near-expiry/Low-stock, 3. Healthy)
- [x] Pagination: 20 items per page
- [x] Global search functionality

### Inventory Increase
- [x] Manual purchase receipts (Add Batch dialog)
- [x] Add Purchase button - Quick dialog to add new products with optional initial stock
- [x] Bulk Excel upload workflow (COMPLETED Feb 15, 2026)

### Inventory Decrease
- [x] Stock deduction is event-driven (Sale, Purchase Return, Expiry Write-off, Adjustment)
- [x] No direct quantity editing - uses Stock Adjustment dialog with reasons
- [x] Expiry Write-off click handler with dedicated dialog

### Stock Ledger
- [x] Non-editable, append-only ledger for all stock movements
- [x] Visible contextually as "Stock Activity" within a product (History button)
- [x] Records user who performed the action

### Settings-Driven Rules
- [x] Core inventory behaviors controlled by Settings module
- [x] Near-expiry days configurable
- [x] Return window days configurable

## P0 - Critical Optimizations (COMPLETED Feb 15, 2026)

### MongoDB Indexing
- [x] Automatic index creation on application startup
- [x] Indexes on: products (sku, barcode, name), batches (product_sku, batch_no), sales (bill_number, created_at), purchases (purchase_number), customers (phone)

### Barcode Scanner Enhancement
- [x] USB Barcode Scanner support via `useBarcodeScanner` hook
- [x] Camera-based scanning via html5-qrcode library
- [x] Manual barcode entry mode
- [x] Fast lookup endpoint: `GET /api/products/barcode/{barcode}`
- [x] Product search includes barcode field

## P1 - Core Feature Completion (COMPLETED Feb 15, 2026)

### Customer Management
- [x] Full CRUD operations (Create, Read, Update, Delete)
- [x] Customer types: regular, wholesale, institution
- [x] Customer fields: name, phone, email, address, GSTIN, credit_limit, notes
- [x] Customer statistics endpoint: `GET /api/customers/{id}/stats`
- [x] Search functionality
- [x] Excel export functionality

### Doctor Management
- [x] Full CRUD operations
- [x] Doctor fields: name, contact, specialization, clinic_address, notes
- [x] Integrated in Customers page with tabs

### Reports Module
- [x] Low Stock Report: `GET /api/reports/low-stock`
- [x] Expiry Report: `GET /api/reports/expiry?days={days}`
- [x] Sales Summary Report: `GET /api/reports/sales-summary`
- [x] Reports UI with 4 report type cards (Sales, Low Stock, Expiry, Stock)
- [x] Date range filtering for sales
- [x] Export CSV functionality
- [x] Export Excel functionality

## P2 - UI/UX and Performance (COMPLETED Feb 15, 2026)

### API Optimizations
- [x] Field selection via `fields` query parameter (e.g., `?fields=name,phone,email`)
- [x] Pagination improvements with `page` and `page_size` parameters
- [x] Standardized paginated response format with metadata

### Browser Caching
- [x] Cache utility at `/app/frontend/src/utils/cache.js`
- [x] TTL-based caching for categories, suppliers, brands, doctors, settings
- [x] `fetchWithCache()` helper for API calls
- [x] Cache invalidation support

### Excel Export
- [x] Export utility at `/app/frontend/src/utils/excelExport.js`
- [x] Uses SheetJS (xlsx) library
- [x] Export buttons on Reports page (CSV + Excel)
- [x] Export button on Customers page
- [x] Formatted exports with proper column headers

### Expiry Write-off
- [x] Write-off button appears for expired/near-expiry batches in Inventory V2
- [x] Write-off dialog with quantity input and reason dropdown
- [x] Backend endpoint: `POST /api/batches/{batch_id}/writeoff-expiry`
- [x] Expired batches highlighted with red "Expired" badge

## Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React.js
- **Database**: MongoDB
- **Authentication**: JWT + Emergent OAuth
- **Charts**: Recharts
- **Barcode**: html5-qrcode
- **Excel Export**: SheetJS (xlsx)

## Key Data Models
- `users`: User accounts with roles
- `roles`: Custom roles with granular permissions
- `settings`: Application configuration
- `products`: Product catalog with barcode field
- `stock_batches`: Inventory batches with expiry tracking
- `stock_movements`: Immutable audit trail
- `customers`: Customer data with GSTIN, credit limit
- `doctors`: Doctor/prescriber information

## Test Status
- **P0/P1 Features**: ✅ 100% passed (iteration_8.json)
- **P2 Features**: ✅ Verified via curl and screenshots
- **Excel Bulk Upload**: ✅ 100% passed (iteration_9.json) - Feb 15, 2026
- **Inventory Search-First**: ✅ 100% passed (iteration_10.json) - Feb 22, 2026
- **Medicine Detail Page**: ✅ 100% passed (iteration_11.json) - Feb 22, 2026
- **Transaction Linking**: ✅ 100% passed (iteration_12.json) - Feb 22, 2026
- **Save & Print Fix**: ✅ 100% passed (iteration_13.json) - Feb 22, 2026
- **Save Bill Flow**: ✅ 100% passed (iteration_14.json) - Feb 22, 2026
- **Bill Number Sequence**: ✅ 100% passed (iteration_15.json) - Feb 22, 2026
- **Save as Draft**: ✅ Backend tested via curl, Frontend verified - Feb 22, 2026
- **Billing UI/UX Overhaul (9 Fixes)**: ✅ Verified via screenshots - Mar 26, 2026
- **Purchases Module Overhaul**: ✅ 93.75% backend, 100% frontend (iteration_16.json) - Mar 29, 2026
- **API Cost Optimizations**: ✅ Implemented Feb 15, 2026

## NEW: Bill Number Sequence System (Feb 22, 2026)
- [x] Configurable, auto-incrementing bill number generation
- [x] Format: {PREFIX}-{PADDED_SEQUENCE} (e.g., INV-000001)
- [x] Admin configurable: Prefix, Starting Number, Sequence Length (3-8 digits)
- [x] Atomic MongoDB operations (findOneAndUpdate) for concurrency safety
- [x] Sequential numbers even with concurrent settlements
- [x] Draft bills display "Draft" as bill number (don't consume sequence)
- [x] Sales returns use RTN- prefix with separate sequence
- [x] Never reuse numbers (cancelled bills keep their numbers)
- [x] Validation blocks starting number lower than last used
- [x] Settings UI: Settings → Bill Sequence tab
- [x] Live preview of bill number format
- [x] Database: bill_number_sequences collection with unique index
- [x] Unique constraint on bills.bill_number
- [x] Future-ready: branch_id field for multi-branch support

## NEW: Save as Draft Feature (Feb 22, 2026)
- [x] Split-button dropdown on "SAVE BILL" button with "Save as Draft" option
- [x] Draft bills display "Draft" as bill number (not sequential INV-xxx)
- [x] Draft bills have status "Due" in the sales list
- [x] **NO stock deduction** when saving as draft
- [x] Regular "Save Bill" continues to work with sequential INV-xxx numbers
- [x] Dropdown shows "No stock deduction" subtitle for clarity
- [x] Dropdown closes when clicking outside

## NEW: Billing UI/UX Overhaul (Mar 26, 2026)
9 strict UI/UX fixes applied to BillingWorkspace.js and BillingOperations.js:
- [x] Fix 1: Deleted "Search Medicine (Ctrl+F)" global search from header
- [x] Fix 2: Deleted keyboard shortcuts footer bar
- [x] Fix 3: Standard page header (← back arrow + "Bills /" breadcrumb + "New Bill" title)
- [x] Fix 4: Merged subbar into single compact row (date/patient/doctor/billing-for/billed-by/payment/save)
- [x] Fix 5: Date chip converted to calendar picker with backdating support
- [x] Fix 6: Table columns reordered: # | Medicine | Batch | Expiry | MRP | Qty | Disc%/₹ | GST | Amount | ×
- [x] Fix 7: Medicine sub-line (batch no · LP ₹X · ▲margin% · salt) always visible below medicine name
- [x] Fix 8: Footer cutoff fix in Bill List (shrink-0, whitespace-nowrap, padding)
- [x] Fix 9: Payment type converted to proper dropdown selector (Cash/UPI/Credit/CC-DC/Multiple)
New components used: Shadcn Calendar, Popover, Lucide-react icons (ArrowLeft, ChevronDown, CalendarIcon)

## API Cost Optimizations (Feb 15, 2026)

### 1. API Pagination ✅
All list endpoints now support pagination:
- `GET /api/bills?page=1&page_size=50` - Bills list with filters
- `GET /api/suppliers?page=1&page_size=50` - Suppliers with search
- `GET /api/doctors?page=1&page_size=50` - Doctors with search  
- `GET /api/purchases?page=1&page_size=50` - Purchases with filters
- Max page_size: 100, Default: 50

### 2. Search Debouncing ✅ (300ms)
Implemented in:
- `BillingNew.js` - Product search with batches
- `Customers.js` - Customer/Doctor filter
- `Suppliers.js` - Supplier filter
- `InventoryV2.js` - Already had debouncing

### 3. Browser Caching ✅
Cache utility at `/utils/cache.js` with TTLs:
- Categories/Brands: 24 hours
- Suppliers/Customers/Doctors: 1 hour
- Filter options: 10 minutes
- Dashboard stats: 5 minutes
Cache invalidated on data updates.

## Prioritized Backlog

### P3 (Low Priority) - NEXT UP
- [ ] Background jobs for analytics pre-calculation
- [ ] Refactor monolithic `server.py` into modular routers
- [ ] Receipt printing functionality
- [ ] Deprecate old Inventory pages (Inventory.js, InventoryImproved.js, InventoryNew.js)
- [ ] "Notion-like" design polish across application
- [ ] User Password Self-Change UI
- [x] Excel Upload for bulk inventory import (COMPLETED Feb 15, 2026)

## Key API Endpoints

### P0 Endpoints
- `GET /api/products/barcode/{barcode}` - Fast barcode lookup
- `GET /api/products/search-with-batches?q={query}` - Product search with batches

### P1 Endpoints
- `GET/POST /api/customers` - Customer list/create (with pagination and field selection)
- `PUT/DELETE /api/customers/{id}` - Customer update/delete
- `GET /api/customers/{id}/stats` - Customer statistics
- `GET/POST /api/doctors` - Doctor list/create
- `PUT/DELETE /api/doctors/{id}` - Doctor update/delete
- `GET /api/reports/low-stock` - Low stock report
- `GET /api/reports/expiry?days={days}` - Expiry report
- `GET /api/reports/sales-summary` - Sales summary

### P2 Endpoints
- `GET /api/products?fields=name,sku&page=1&page_size=20` - Products with field selection and pagination
- `POST /api/batches/{batch_id}/writeoff-expiry` - Expiry write-off
- `POST /api/products/bulk-update` - Bulk update products (supports: location, discount_percent, gst_percent, category, schedule, brand)
- `GET /api/products/{sku}/transactions` - Get all linked transactions (sales, purchases, returns) for a product

### Excel Bulk Upload Endpoints (NEW - Feb 15, 2026)
- `GET /api/inventory/bulk-upload/template` - Download sample Excel template
- `POST /api/inventory/bulk-upload/parse` - Parse uploaded Excel file, returns job_id and auto-detected column mappings
- `POST /api/inventory/bulk-upload/validate` - Validate mapped data, returns validation results
- `POST /api/inventory/bulk-upload/import` - Start import process (background job)
- `GET /api/inventory/bulk-upload/progress/{job_id}` - Get import progress
- `GET /api/inventory/bulk-upload/error-report/{job_id}` - Download validation error report (Excel)

## File Structure (Key Files)
```
/app/
├── backend/
│   ├── server.py          # Main FastAPI app
│   └── tests/
│       ├── test_p0_p1_features.py
│       ├── test_excel_bulk_upload.py  # Excel upload tests
│       └── test_inventory_search.py   # NEW: Inventory search tests
└── frontend/
    └── src/
        ├── components/
        │   ├── BarcodeScannerModal.js
        │   ├── ExcelBulkUploadWizard.js  # 4-step Excel upload wizard
        │   └── Layout.js
        ├── pages/
        │   ├── BillingNew.js
        │   ├── BillingWorkspace.js    # NEW: Redesigned billing page
        │   ├── Customers.js
        │   ├── Reports.js
        │   ├── Dashboard.js
        │   ├── InventoryV2.js
        │   └── InventorySearch.js     # NEW: Search-first inventory page
        └── utils/
            ├── cache.js        # Browser caching utility
            └── excelExport.js  # Excel export utility
```

## Test Credentials
- Email: testadmin@pharmacy.com
- Password: admin123
