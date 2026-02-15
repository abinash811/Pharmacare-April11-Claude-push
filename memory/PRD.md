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
- [ ] Bulk Excel upload workflow (UI placeholder exists)

### Inventory Decrease
- [x] Stock deduction is event-driven (Sale, Purchase Return, Expiry Write-off, Adjustment)
- [x] No direct quantity editing - uses Stock Adjustment dialog with reasons

### Stock Ledger
- [x] Non-editable, append-only ledger for all stock movements
- [x] Visible contextually as "Stock Activity" within a product (History button)
- [x] Records user who performed the action

### Settings-Driven Rules
- [x] Core inventory behaviors controlled by Settings module
- [x] Near-expiry days configurable
- [x] Return window days configurable

### Inventory Health Data
- [x] UI summary cards showing Critical/Warning/Healthy counts (clickable for filtering)
- [x] Filters panel with Status, Category, Brand dropdowns
- [x] Clear all filters functionality
- [x] Export button removed per user request

### Data Integrity
- [x] Inventory totals derived from underlying data (batches -> ledger entries)

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

## Core Requirements (Billing & Returns Module)

### Billing Features
- [x] Product search with FEFO batch selection
- [x] Barcode scanner integration
- [x] Multiple payment methods (Cash, Card, UPI, Credit)
- [x] Split payment support
- [x] Per-item GST%, discount, quantity editing
- [x] Draft bill functionality (save without payment)
- [x] Edit draft bills
- [x] Stock deduction on paid bills
- [x] Bill list with filters (status, payment method, time period)
- [x] View bill details

### Returns Features (Integrated in Billing)
- [x] Return mode in same billing page (?type=return)
- [x] Select original bill to return from
- [x] Display original bill items with checkboxes for selection
- [x] Quantity validation (cannot return more than purchased)
- [x] Return window warning (configurable in Settings)
- [x] Multiple refund methods (Cash, Card, UPI, Credit Note)
- [x] Refund reason selection
- [x] Stock restoration on return

## Core Requirements (Purchases Module)

### Purchase Features
- [x] Create new purchase from supplier
- [x] Search/Add products with batch, expiry, qty, cost price, MRP, GST
- [x] Save as Draft or Confirm
- [x] Edit draft purchases
- [x] Stock automatically created on confirm
- [x] Purchase list with filters

### Purchase Returns Features (Integrated in Purchases)
- [x] Return mode in same page (?type=return)
- [x] Select original purchase to return from
- [x] Display purchase items with checkboxes for selection
- [x] Quantity validation (cannot return more than purchased)
- [x] Return reason selection per item
- [x] Multiple return reasons (Damaged, Expired, Wrong Item, Quality Issue, Excess Stock)
- [x] Stock deduction on return confirm
- [x] Batch number mandatory for new purchases (validation on Confirm Purchase)
- [x] Batch number auto-fetched and displayed in returns flow

## What's Been Implemented

### Latest Session (Feb 15, 2026)
- **P0 Complete**: MongoDB indexing on startup, Enhanced barcode scanner (USB + Camera + Manual)
- **P1 Complete**: Customer CRUD with stats, Doctor CRUD, Reports (Low Stock, Expiry, Sales)
- **Testing**: 100% pass rate - 20 backend tests, all frontend verifications passed
- **Model Fixes**: Customer and Doctor models updated with all required fields

### Previous Sessions Summary
1. **Purchases Module** - Full CRUD operations
2. **Purchase Returns Module** - Complete frontend pages and backend endpoints
3. **Enhanced Billing Page** - Advanced batch selector with FEFO workflow
4. **Full RBAC System** - User Management, Customizable Roles & Permissions
5. **Core Inventory V2 System** - Severity sorting, pagination, batch management
6. **Settings Module** - Application-wide configuration
7. **Dashboard Analytics** - Charts, metrics, insights using Recharts
8. **Supplier Management** - Full CRUD with delete protection
9. **Sales & Returns UX Refactor** - Unified Record Workspace pattern

## Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React.js
- **Database**: MongoDB
- **Authentication**: JWT + Emergent OAuth
- **Charts**: Recharts
- **Barcode**: html5-qrcode

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
- **Test Files**: 
  - /app/test_reports/iteration_8.json
  - /app/backend/tests/test_p0_p1_features.py

## Prioritized Backlog

### P2 (Medium Priority) - NEXT UP
- [ ] Responsive design across all modules (mobile, tablet, desktop)
- [ ] API optimizations (field selection, pagination improvements)
- [ ] Browser caching for static data (categories, suppliers)
- [ ] Excel export for reports (in addition to CSV)
- [ ] Expiry Write-off click handler implementation

### P3 (Low Priority)
- [ ] Refactor monolithic `server.py` into modular routers
- [ ] Background jobs for analytics pre-calculation
- [ ] Receipt printing functionality
- [ ] Deprecate old Inventory pages (Inventory.js, InventoryImproved.js, InventoryNew.js)
- [ ] "Notion-like" design polish across application
- [ ] User Password Self-Change UI
- [ ] Excel Upload for bulk inventory import

## Test Credentials
- Email: testadmin@pharmacy.com
- Password: admin123

## Key API Endpoints

### P0 Endpoints
- `GET /api/products/barcode/{barcode}` - Fast barcode lookup
- `GET /api/products/search-with-batches?q={query}` - Product search with batches

### P1 Endpoints
- `GET/POST /api/customers` - Customer list/create
- `PUT/DELETE /api/customers/{id}` - Customer update/delete
- `GET /api/customers/{id}/stats` - Customer statistics
- `GET/POST /api/doctors` - Doctor list/create
- `PUT/DELETE /api/doctors/{id}` - Doctor update/delete
- `GET /api/reports/low-stock` - Low stock report
- `GET /api/reports/expiry?days={days}` - Expiry report
- `GET /api/reports/sales-summary` - Sales summary

## File Structure (Key Files)
```
/app/
├── backend/
│   ├── server.py          # Main FastAPI app (needs refactoring)
│   └── tests/
│       ├── test_p0_p1_features.py
│       ├── test_dashboard_analytics.py
│       └── test_supplier_management.py
└── frontend/
    └── src/
        ├── components/
        │   ├── BarcodeScannerModal.js
        │   └── Layout.js
        └── pages/
            ├── BillingNew.js
            ├── Customers.js
            ├── Reports.js
            ├── Dashboard.js
            └── ...
```
