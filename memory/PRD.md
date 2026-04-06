# PharmaCare - Pharmacy Management System

## Original Problem Statement
Build a standalone pharmacy billing and inventory management tool for Indian pharmacies. The system includes:
- Billing & Sales Returns (COMPLETED)
- Purchases & Purchase Returns (COMPLETED)
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

---

## What's Been Implemented

### April 6, 2026 - Purchase Returns Module (COMPLETED)

**Frontend:**
- `PurchaseReturnCreate.js` - New purchase return screen following Pattern B:
  - Pre-fills items from original purchase via `purchase_id` query param
  - Shows Original Qty (read-only) and Return Qty (editable with validation)
  - Validates return qty ≤ max returnable qty (original - already returned)
  - Invoice Breakdown Modal following Pattern E
  - Subbar with Date, Supplier (read-only), Invoice#, Billed By, Payment Type

- `PurchaseReturnDetail.js` - Read-only view following Pattern C:
  - Shows PRET-XXXX number with CONFIRMED badge
  - Original purchase reference link
  - More dropdown with Edit (Non-Financial/Financial) and Print options

**Backend:**
- `GET /api/purchases/{id}/items-for-return` - Returns items with already-returned quantities
- `POST /api/purchase-returns` - Creates return atomically:
  - Generates PRET-XXXX number
  - Deducts stock immediately
  - Decrements supplier outstanding
  - Adds to supplier payment_history
  - Updates original purchase with return reference
  - Status is "confirmed" immediately (no separate confirm step)
- `PUT /api/purchase-returns/{id}` - Edit return (non-financial and financial)
- Qty validation: return qty + already returned ≤ original qty

**Navigation Fixes:**
- `PurchaseDetail.js` → More dropdown → "Purchase Return" → `/purchases/returns/create?purchase_id={id}`
- `PurchasesList.js` → "Purchase Return" button shows info toast (returns must be created from existing purchase)
- Removed unused `purchaseType` variable from `PurchaseNew.js`

### Earlier Completed Work
- Purchase backend logic: LP updates, supplier outstanding tracking
- Purchase UI overhaul matching Billing workspace design
- Read-only purchase detail view (PurchaseDetail.js)
- Draft/Parked purchase editing
- 5 strict UI fixes for Purchases module

---

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Purchase Returns Module - Complete Creation Flow

### P1 (High Priority) - NEXT
- [ ] Overhaul Suppliers Module:
  - Outstanding balances display
  - Record Payment pages
  - Payment history table

### P2 (Medium Priority)
- [ ] Purchase Returns List view (separate tab/page)
- [ ] Apply PharmaSync design to Suppliers, Customers, Reports

### P3 (Low Priority/Future)
- [ ] Refactor `server.py` into routers (USER EXPLICITLY SAID NOT TO DO YET)
- [ ] Delete legacy files

---

## Design System Reference
See `/app/PHARMACARE_DESIGN_SYSTEM.md` for:
- Color tokens
- Typography
- Component patterns (A-F)
- Module connection rules

## Key Files
- `/app/frontend/src/pages/PurchaseReturnCreate.js` - NEW
- `/app/frontend/src/pages/PurchaseReturnDetail.js` - NEW
- `/app/frontend/src/pages/PurchasesList.js` - Updated navigation
- `/app/frontend/src/pages/PurchaseDetail.js` - Updated navigation
- `/app/frontend/src/pages/PurchaseNew.js` - Removed dead code
- `/app/frontend/src/App.js` - Added routes
- `/app/backend/server.py` - Added endpoints

## Credentials for Testing
- **Email**: testadmin@pharmacy.com
- **Password**: admin123
