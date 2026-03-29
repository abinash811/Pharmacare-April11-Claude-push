# PharmaCare - Pharmacy Management System

## Original Problem Statement
Build a standalone pharmacy billing and inventory management tool for Indian pharmacies. The system includes:
- Billing & Sales Returns (COMPLETED)
- Purchases & Purchase Returns (IN PROGRESS)
- Inventory Management
- Supplier Management
- Customer Management
- Reports & Analytics

## Tech Stack
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB

## User Personas
- Pharmacy Owner/Admin
- Billing Staff
- Inventory Manager

## Core Requirements

### Phase 1: Foundation (COMPLETED)
- User authentication
- Dashboard with key metrics
- Basic CRUD for products, customers, suppliers

### Phase 2: Billing & Sales (COMPLETED)
- Billing workspace with barcode scanning
- Sales returns management
- Receipt printing
- Customer credit management

### Phase 3: Purchases & Purchase Returns (IN PROGRESS)
- Purchase list with filters (All, Cash, Credit, Due)
- New purchase workspace with:
  - Distributor selection
  - Product search and batch entry
  - MM/YY expiry format
  - PTR, MRP, GST tracking
  - LIFA/LILA batch priority
- Invoice breakdown modal with adjustments
- Draft/Parked purchase support
- Purchase returns workflow

### Phase 4: Supplier Management (UPCOMING)
- Supplier outstanding balance tracking
- Payment history
- Record payment functionality

### Phase 5: Reports & Analytics (FUTURE)
- Sales reports
- Purchase reports
- Inventory valuation
- GST reports

---

## What's Been Implemented

### March 29, 2026 - Purchases Module UI Fixes
- **Fix 1**: Table inputs converted to HTML5 editable inputs with blue focus rings
- **Fix 2**: Footer z-index fixed to prevent badge overlap
- **Fix 3**: Purchase list columns: Sr., Bill no., Entry date, Bill date, Entry by, Distributor, Amount, Payment
- **Fix 4**: Distributor chip widened to 220px with tooltip for long names
- **Fix 5**: Confirm & Save button opens Invoice Breakdown modal
- **Fix 6**: Invoice Breakdown modal with editable fields (Discount, CESS, CN, TCS, Extra Charges)

### Earlier Completed Work
- Purchase backend logic: LP updates, supplier outstanding tracking
- Purchase UI overhaul matching Billing workspace design
- Read-only purchase detail view (PurchaseDetail.js)
- Draft/Parked purchase editing

---

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] 5 UI fixes for Purchases module

### P1 (High Priority) - NEXT
- [ ] Overhaul Suppliers Module (Outstanding balances, Record Payment pages)

### P2 (Medium Priority)
- [ ] Purchase Returns List workflow

### P3 (Low Priority/Future)
- [ ] Refactor `server.py` into routers (USER EXPLICITLY SAID NOT TO DO YET)
- [ ] Apply PharmaSync design to remaining modules (Customers, Reports)
- [ ] Delete legacy files (Inventory.js, BillingNew.js, etc.)

---

## Key Files
- `/app/frontend/src/pages/PurchasesList.js` - Purchase list page
- `/app/frontend/src/pages/PurchaseNew.js` - New/Edit purchase workspace
- `/app/frontend/src/pages/PurchaseDetail.js` - Read-only purchase view
- `/app/backend/server.py` - Main backend API

## Credentials for Testing
- **Email**: testadmin@pharmacy.com
- **Password**: admin123
