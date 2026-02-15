# PharmaCare Application - Product Requirements Document

## Original Problem Statement
The user initiated a comprehensive audit and refactoring of the PharmaCare application's Inventory module. The goal is to ensure the module is robust, scalable, and adheres to a strict set of business rules.

## User Personas
- **Admin**: Full access to all features including user management, roles, and settings
- **Manager**: Access to inventory, purchases, sales, and reports
- **Cashier**: Limited access to billing and basic inventory viewing
- **Inventory Staff**: Focused access to inventory management features

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
- **API Cost Optimizations**: ✅ Implemented Feb 15, 2026

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
│       └── test_excel_bulk_upload.py  # NEW: Excel upload tests
└── frontend/
    └── src/
        ├── components/
        │   ├── BarcodeScannerModal.js
        │   ├── ExcelBulkUploadWizard.js  # NEW: 4-step Excel upload wizard
        │   └── Layout.js
        ├── pages/
        │   ├── BillingNew.js
        │   ├── Customers.js
        │   ├── Reports.js
        │   ├── Dashboard.js
        │   └── InventoryV2.js
        └── utils/
            ├── cache.js        # Browser caching utility
            └── excelExport.js  # Excel export utility
```

## Test Credentials
- Email: testadmin@pharmacy.com
- Password: admin123
