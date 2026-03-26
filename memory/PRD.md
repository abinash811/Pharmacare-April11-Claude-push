# PharmaCare Application - Product Requirements Document

## Original Problem Statement
The user initiated a comprehensive audit and refactoring of the PharmaCare application's Inventory module. The goal is to ensure the module is robust, scalable, and adheres to a strict set of business rules.

## User Personas
- **Admin**: Full access to all features including user management, roles, and settings
- **Manager**: Access to inventory, purchases, sales, and reports
- **Cashier**: Limited access to billing and basic inventory viewing
- **Inventory Staff**: Focused access to inventory management features

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
