# PHARMACARE — PROGRESS TRACKER
# Update this file after every completed task
# Last updated: April 13, 2026

---

## CURRENT STATUS
**Branch:** claude/compassionate-agnesi
**Phase:** Phase 3 COMPLETE — all 15 routers migrated to PostgreSQL
**Overall Progress:** ~45% of full refactor complete

---

## PHASES OVERVIEW

| Phase | What | Status |
|-------|------|--------|
| Phase 1 | PostgreSQL setup + SQLAlchemy models | ✅ DONE |
| Phase 2 | Split server.py into router files | ✅ DONE |
| Phase 3 | Migrate queries: MongoDB → PostgreSQL | ✅ DONE |
| Phase 4 | Frontend constants, utils, hooks | ⏳ NOT STARTED |
| Phase 5 | Add TypeScript to frontend | ⏳ NOT STARTED |
| Phase 6 | Break down giant page files | ⏳ NOT STARTED |
| Phase 7 | Fix broken/inconsistent pages | ⏳ NOT STARTED |
| Phase 8 | Missing features | ⏳ NOT STARTED |

---

## PHASE 1 — PostgreSQL Setup ✅ COMPLETE

### Files Created
- `backend/database.py` — SQLAlchemy async engine + session
- `backend/config.py` — environment variables
- `backend/models/__init__.py`
- `backend/models/pharmacy.py` — pharmacies + pharmacy_settings tables
- `backend/models/users.py` — roles + users + audit_logs tables
- `backend/models/products.py` — products + stock_batches + stock_movements
- `backend/models/suppliers.py` — suppliers table
- `backend/models/purchases.py` — purchases + items + payments + returns
- `backend/models/customers.py` — customers + doctors tables
- `backend/models/billing.py` — bills + items + sales_returns + schedule_h1
- `backend/migrations/` — Alembic migration setup

### What Works
- PostgreSQL installed and running locally
- Database `pharmacare` created
- All 21 tables created in PostgreSQL
- All indexes in place
- All money stored as INTEGER paise (₹1 = 100 paise)
- All PKs are UUID

---

## PHASE 2 — Backend Router Split ✅ COMPLETE

### Files Created
- `backend/routers/__init__.py`
- `backend/routers/auth_helpers.py` — JWT + password helpers
- `backend/routers/auth.py` — /auth/* routes
- `backend/routers/users.py` — /users/* routes
- `backend/routers/settings.py` — /settings/*, /roles/*, /permissions
- `backend/routers/inventory.py` — /medicines/*, /products/*, /inventory/*
- `backend/routers/batches.py` — /stock/batches/*, /stock-movements/*
- `backend/routers/billing.py` — /bills/*, /payments/*, /refunds/*
- `backend/routers/customers.py` — /customers/*, /doctors/*
- `backend/routers/reports.py` — /reports/*, /analytics/*, /compliance/*
- `backend/routers/suppliers.py` — /suppliers/*
- `backend/routers/purchases.py` — /purchases/*
- `backend/routers/purchase_returns.py` — /purchase-returns/*
- `backend/routers/sales_returns.py` — /sales-returns/*
- `backend/utils/excel.py` — bulk upload logic
- `backend/main.py` — FastAPI app + all routers registered
- `backend/deps.py` — SQLAlchemy async session (get_db, AsyncSessionLocal)

### Note
All router files have been migrated to PostgreSQL (Phase 3 complete).
server.py is UNTOUCHED — still the original working backend (MongoDB).
The new routers are ready to replace server.py once integration tested.

---

## PHASE 3 — MongoDB → PostgreSQL Migration ✅ COMPLETE

### Router Migration Status (15 of 15 complete)

| Router | MongoDB → PostgreSQL | Commit | Status |
|--------|---------------------|--------|--------|
| deps.py | ✅ | 62b9200 | Complete |
| auth_helpers.py | ✅ | 62b9200 | Complete |
| auth.py | ✅ | 62b9200 | Complete |
| users.py | ✅ | 9ab2fc6 | Complete |
| settings.py | ✅ | 9ab2fc6 | Complete |
| customers.py | ✅ | 1d983a5 | Complete |
| suppliers.py | ✅ | 1d983a5 | Complete |
| inventory.py | ✅ | eeef0f6 | Complete |
| batches.py | ✅ | eeef0f6 | Complete |
| purchases.py | ✅ | 6e0eb99 | Complete |
| purchase_returns.py | ✅ | 6e0eb99 | Complete |
| sales_returns.py | ✅ | eb3d680 | Complete |
| billing.py | ✅ | d2131b3 | Complete |
| reports.py | ✅ | e20f1dd | Complete |
| excel.py (utils) | ✅ | 224915d | Complete |

---

## PHASE 4 — Frontend Constants & Utils ⏳ NOT STARTED

### Files to Create
- `frontend/src/constants/pharmacy.js` — drug schedules, GST rates, HSN codes
- `frontend/src/constants/routes.js` — all route strings
- `frontend/src/constants/api.js` — all API endpoint strings
- `frontend/src/utils/currency.js` — formatCurrency, formatINR
- `frontend/src/utils/dates.js` — formatDate, getFinancialYear
- `frontend/src/utils/gst.js` — calculateGST, getGSTSlab
- `frontend/src/utils/validation.js` — validateGSTIN, validatePhone
- `frontend/src/lib/axios.js` — configured Axios instance
- `frontend/src/hooks/useDebounce.js`
- `frontend/src/hooks/useApiCall.js`
- `frontend/src/hooks/usePagination.js`

---

## PHASE 5 — TypeScript Migration ⏳ NOT STARTED

Convert all .js/.jsx files to .ts/.tsx
Add TypeScript configuration
Add type definitions for all data models

---

## PHASE 6 — Break Down Giant Files ⏳ NOT STARTED

### Files to Refactor

| File | Current Lines | Target Lines | Status |
|------|--------------|--------------|--------|
| BillingWorkspace.js | 2,054 | ~150 | ❌ |
| InventorySearch.js | 1,591 | ~150 | ❌ |
| PurchaseNew.js | 1,231 | ~150 | ❌ |
| MedicineDetail.js | 1,108 | ~150 | ❌ |
| Settings.js | 666 | ~150 | ❌ |
| Customers.js | 771 | ~150 | ❌ |
| Suppliers.js | 747 | ~150 | ❌ |
| Dashboard.js | 519 | ~150 | ❌ |
| Reports.js | 509 | ~150 | ❌ |

---

## PHASE 7 — Fix Broken Pages ⏳ NOT STARTED

| Issue | File | Status |
|-------|------|--------|
| Wrong Button component | Settings.js | ❌ |
| Custom Dialog instead of Shadcn | Users.js | ❌ |
| Custom Dialog instead of Shadcn | RolesPermissions.js | ❌ |
| Doesn't follow design system | Dashboard.js | ❌ |
| Hand-rolled tabs, no PageHeader | Reports.js | ❌ |
| Raw date inputs, no PageHeader | GSTReport.js | ❌ |
| Inventory shows nothing on load | InventorySearch.js | ❌ |
| No unsaved changes guard | BillingWorkspace.js | ❌ |
| Filters don't re-fetch from server | BillingOperations.js | ❌ |
| No pagination UI | All list pages | ❌ |

---

## PHASE 8 — Missing Features ⏳ NOT STARTED

| Feature | Status |
|---------|--------|
| Pagination UI on all list pages | ❌ |
| Barcode scanner connected to billing | ❌ |
| Barcode scanner connected to inventory | ❌ |
| Print/PDF for purchases | ❌ |
| Print/PDF for returns | ❌ |
| Stock movement log page | ❌ |
| Mobile responsive layout | ❌ |
| BillDetail page | ❌ |
| Schedule H1 drug register page | ❌ |
| Audit log viewer page | ❌ |

---

## WHAT IS CURRENTLY WORKING

The original `server.py` (MongoDB) is UNTOUCHED and still the running backend.
The new PostgreSQL routers (`backend/routers/*`) are fully migrated and ready for integration testing.
All these features work right now via server.py:

✅ Login / logout / authentication
✅ Billing — create, edit, park, finalize, print
✅ Inventory — search, filter, bulk Excel upload, expiry write-off
✅ Purchases — create, edit, mark as paid, detail view
✅ Purchase Returns — create, confirm, detail view
✅ Sales Returns — create, detail view, list
✅ Customers & Doctors — full CRUD
✅ Suppliers — full CRUD, purchase history
✅ Users — add, edit, deactivate, password change
✅ Roles & Permissions — custom roles, permission matrix
✅ Settings — billing config, bill sequences
✅ Reports — sales, stock, expiry
✅ GST Report — GST breakup, CSV export
✅ Dashboard — analytics overview

---

## NEXT TASK

Phase 4 — Frontend constants, utils, hooks:
- Create frontend/src/constants/ (pharmacy, routes, api)
- Create frontend/src/utils/ (currency, dates, gst, validation)
- Create frontend/src/lib/axios.js
- Create frontend/src/hooks/ (useDebounce, useApiCall, usePagination)
