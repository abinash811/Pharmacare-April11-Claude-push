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

### Completed Features (Jan 2025)
1. **Purchases Module** - Fixed API prefix issues, full CRUD operations
2. **Purchase Returns Module** - Complete frontend pages and backend endpoints
3. **Enhanced Billing Page** - Advanced batch selector with FEFO workflow
4. **Full RBAC System**
   - User Management (CRUD operations)
   - Customizable Roles & Permissions with granular controls
5. **Customers Page** - Fixed import error
6. **Core Inventory V2 System**
   - Backend: GET /api/inventory with severity sorting and pagination
   - Frontend: InventoryV2.js with summary cards, status badges, search
   - Add Batch, Stock Adjustment, Movement History features
7. **Settings Module** - Application-wide configuration management

### Bug Fixes Applied (Jan 3, 2025)
- Fixed endpoint mismatch: `POST /api/batches` → `POST /api/stock/batches`
- Fixed endpoint mismatch: `GET /api/stock/movements` → `GET /api/stock-movements`
- Fixed backend KeyError in stock batches when `product_sku` field missing

### New Features Added (Jan 3, 2025)
- Added "Add Purchase" button to add new products directly with optional initial stock
- Added Filters panel with Status, Category, Brand dropdowns
- Added clickable summary cards for quick filtering by status
- Removed Export button per user request
- Backend: New GET /api/inventory/filters endpoint
- Backend: GET /api/inventory now accepts status_filter, category_filter, brand_filter params

### Billing & Returns Enhancement (Jan 3, 2025)
- Enhanced returns flow: Select items from original bill with checkboxes
- Return quantity validation (cannot exceed purchased qty)
- Return window warning from configurable settings
- Edit draft bills feature with PUT /api/bills/{id} endpoint
- Added Returns section to Settings (return_window_days, require_original_bill, allow_partial_return)
- Fixed bill status calculation (was showing 'due' instead of 'paid')
- Removed separate Sales Returns module (consolidated into Billing page)

### Bug Fixes (Jan 3, 2025 - Session 2)
- Fixed "Failed to save bill" error on sales returns - Made BillItem fields optional
- Fixed sales return status - Returns with refund data now show "paid" instead of "due"
- Added Edit (pencil) button to draft bills in BillingList.js - only shows for draft status

### Purchase Module Consolidation (Jan 3, 2025)
- Created PurchaseNew.js - Consolidated purchase and purchase return in single page
- Updated PurchasesList.js - Added tabs for Purchases/Returns, summary cards, proper actions
- Added PUT /api/purchases/{id} endpoint for editing draft purchases
- Removed separate purchase return files (CreatePurchaseReturn.js, PurchaseReturnsList.js, PurchaseReturnDetail.js)
- Updated routes and navigation

### Purchase Batch Number Enhancement (Jan 22, 2026)
- Batch number is now mandatory when creating/confirming a purchase
- Validation error toast shown if batch number is empty when clicking "Confirm Purchase"
- Purchase returns now display batch number in the selection table (in blue badge)
- Batch number is auto-fetched from original purchase and displayed in Return Items table
- Batch column shown for both new purchases (editable input) and returns (read-only badge)

### Dashboard Analytics Enhancement (Jan 23, 2026)
- Comprehensive dashboard with Key Metrics cards (Today/Week/Month/Total sales with % change indicators)
- Sales Trend area chart (last 14 days) using Recharts library
- Category-wise sales pie chart (displays "No category data" if products lack category)
- Top 5 Selling Products with revenue and quantity sold
- Top 5 Customers with purchase value and order count
- Enhanced Low Stock alerts with clickable "View All" link
- Enhanced Expiring Soon alerts with clickable "View All" link
- Recent Bills section with clickable entries
- Quick Stats row (Pending Payments, Draft Bills, Monthly Returns, Stock Value)
- Refresh button to reload dashboard data
- New backend endpoint: GET /api/analytics/dashboard

### Supplier Management Module (Feb 11, 2026)
- Full CRUD operations for suppliers (Create, Read, Update, Delete)
- Supplier model enhanced with is_active field for activate/deactivate functionality
- Delete protection: Cannot delete supplier if purchases exist (returns error with count)
- Toggle status endpoint: PATCH /api/suppliers/{id}/toggle-status
- Supplier summary endpoint: GET /api/suppliers/{id}/summary (read-only purchase insights)
- Search by name and phone number
- Purchase page only shows active suppliers (active_only=true filter)
- Deactivated suppliers remain visible in historical purchases
- Permissions structure added for suppliers module
- No changes to inventory, billing, or ledger logic (reference-only module)

## Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React.js
- **Database**: MongoDB
- **Authentication**: JWT + Emergent OAuth

## Key Data Models
- `users`: User accounts with roles
- `roles`: Custom roles with granular permissions
- `settings`: Application configuration
- `products`: Product catalog
- `stock_batches`: Inventory batches with expiry tracking
- `stock_movements`: Immutable audit trail

## Test Status
- **InventoryV2 Page**: ✅ 100% passed (Backend + Frontend)
- **InventoryV2 Filters & Add Purchase**: ✅ 100% passed (16 backend + all frontend tests)
- **Purchase Batch Number Features**: ✅ 100% passed (validation + auto-fetch)
- **Dashboard Analytics**: ✅ 100% passed (12 backend + all frontend tests)
- **Test Reports**: 
  - /app/test_reports/iteration_2.json (core features)
  - /app/test_reports/iteration_3.json (filters & add purchase)
  - /app/test_reports/iteration_4.json (purchase batch number features)
  - /app/test_reports/iteration_5.json (dashboard analytics)

## Prioritized Backlog

### P1 (High Priority)
- [ ] Implement Expiry Write-off click handler logic
- [ ] Implement Excel Upload functionality for bulk inventory import

### P2 (Medium Priority)
- [ ] User Password Self-Change UI
- [ ] Complete Supplier Management UI with full CRUD

### P3 (Low Priority)
- [ ] Deprecate old Inventory page after user approval
- [ ] Enhance Sales Returns page with configurable return window
- [ ] "Notion-like" design polish across application

## Test Credentials
- Email: testadmin@pharmacy.com
- Password: admin123
