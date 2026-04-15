# PHARMACARE — PROGRESS TRACKER
# Update this file after every completed task
# Last updated: April 16, 2026

---

## CURRENT STATUS
**Branch:** main
**Phase:** Phase 7 — Fix Broken Pages ⏳ NOT STARTED
**Overall Progress:** ~85% of full refactor complete

---

## PHASES OVERVIEW

| Phase | What | Status |
|-------|------|--------|
| Phase 1 | PostgreSQL setup + SQLAlchemy models | ✅ DONE |
| Phase 2 | Split server.py into router files | ✅ DONE |
| Phase 3 | Migrate queries: MongoDB → PostgreSQL | ✅ DONE + VERIFIED |
| Phase 4 | Frontend constants, utils, hooks | ✅ DONE |
| Phase 5 | Add TypeScript to frontend | ✅ DONE |
| Phase 6 | Break down giant page files | ✅ DONE |
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

## PHASE 3 — MongoDB → PostgreSQL Migration ✅ COMPLETE + VERIFIED

### Verification (April 15, 2026)
- Full `backend_test.py` suite run against `http://localhost:8000`: **35/35 passed (100%)**
- `bcrypt` pinned to `4.0.1` in `backend/requirements.txt`
- Fixed: Draft bill 500 error — replaced hardcoded `"Draft"` bill_number with unique
  `DRAFT-<hex8>` placeholder to avoid UNIQUE(pharmacy_id, bill_number) collision
- Commit: `e5f07dc`

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

## PHASE 4 — Frontend Constants & Utils ✅ COMPLETE

### Verification (April 15, 2026)
All 11 files built, tested (structural node checks), and committed to both branches.

| File | Tests | Commit | Purpose |
|------|-------|--------|---------|
| `constants/pharmacy.js` | ✅ | 9db7100 | Drug schedules, GST rates, HSN codes, statuses |
| `constants/routes.js` | ✅ | 9db7100 | All 26 route paths + dynamic builders |
| `constants/api.js` | ✅ | 39a5562 | 50+ API endpoints + qs() builder |
| `utils/currency.js` | 30/30 | e8f22ed | formatCurrency, paise↔rupee, compact, margin |
| `utils/dates.js` | 30/30 | 5ed5155 | formatDate, expiry, FY range, presets |
| `utils/gst.js` | 38/38 | 0db1112 | calcLineGST, calcBillTotals, liability |
| `utils/validation.js` | 48/48 | 5bb5ff6 | GSTIN, PAN, phone, amount, runValidators |
| `lib/axios.js` | 14/14 | eff19b8 | Configured instance + auth interceptors |
| `hooks/useDebounce.js` | 18/18 | de76746 | useDebounce + useDebouncedCallback |
| `hooks/useApiCall.js` | 35/35 | 0d95feb | useApiCall, useFetch, useParallelFetch |
| `hooks/usePagination.js` | 31/31 | 4c07824 | Server + client-side pagination state |

---

## PHASE 5 — TypeScript Migration ✅ COMPLETE

### Verification (April 15, 2026) — 39/39 structural checks passing

| File | Commit | Key Types Added |
|------|--------|-----------------|
| `frontend/tsconfig.json` | 65e096b | strict, allowJs, @/* alias, ES2020 |
| `package.json` (devDeps) | 65e096b | typescript@5.7, @types/react, @types/node |
| `src/types/index.ts` | da6ecba | 40 entity interfaces + PaginatedResponse<T> |
| `utils/currency.ts` | 169893b | FormatCurrencyOptions, all fn signatures |
| `utils/dates.ts` | f90d271 | DateInput, ExpiryStyle, ExpiryStatusValue |
| `utils/gst.ts` | f90d271 | calcLineGST/calcBillTotals return objects |
| `utils/validation.ts` | f90d271 | ValidationResult, runValidators |
| `lib/axios.ts` | f90d271 | InternalAxiosRequestConfig |
| `hooks/useDebounce.ts` | f90d271 | generic \<T\>, Parameters\<T\> |
| `hooks/useApiCall.ts` | f90d271 | execute\<T\>, useFetch\<T\> |
| `hooks/usePagination.ts` | f90d271 | slice\<T\>, typed setPage |
| `constants/pharmacy.ts` | f90d271 | SelectOption interface |
| `constants/routes.ts` | f90d271 | routeTo typed Record |
| `constants/api.ts` | f90d271 | qs params typed |

**Note:** All `.js` originals kept alongside `.ts` files for gradual migration.
Page components (`.tsx`) will be converted as part of Phase 6 refactor.

---

## PHASE 6 — Break Down Giant Files ✅ COMPLETE (April 16, 2026)

**Rule enforced:** No file over 300 lines. Every page broken into `index.jsx` orchestrator + `hooks/` + `components/`.
**Pattern:** `api` + `apiUrl` throughout; Phase 4 date/currency/debounce utilities used everywhere.

### File-by-File Summary

#### BillingWorkspace (2,054 → 12 files) — Commit `e0ea0a3`
| File | Lines |
|------|-------|
| `hooks/useBillItems.js` | 111 |
| `hooks/useBillActions.js` | 212 |
| `components/ScheduleHWarning.jsx` | 68 |
| `components/PrintReceipt.jsx` | 138 |
| `components/PatientSearchModal.jsx` | 149 |
| `components/DoctorDropdown.jsx` | 146 |
| `components/BillingHeader.jsx` | 138 |
| `components/BillingSubbar.jsx` | 279 |
| `components/BillingTable.jsx` | 235 |
| `components/BillingFooter.jsx` | 170 |
| `components/FinaliseModal.jsx` | 154 |
| `index.jsx` | 232 |

#### InventorySearch (1,591 → 11 files) — Commit `5ae85cf`
| File | Lines |
|------|-------|
| `hooks/useInventory.js` | 108 |
| `hooks/useInventoryFilters.js` | 62 |
| `components/InventoryHeader.jsx` | 78 |
| `components/InventoryFilters.jsx` | 118 |
| `components/InventoryTable.jsx` | 145 |
| `components/BatchPanel.jsx` | 148 |
| `components/ExpiryWriteoffModal.jsx` | 112 |
| `components/BulkUploadModal.jsx` | 138 |
| `components/ProductFormModal.jsx` | 222 |
| `components/EditBatchModal.jsx` | 149 |
| `index.jsx` | 151 |

#### PurchaseNew (1,231 → 9 files) — Commit `a387a9e`
| File | Lines |
|------|-------|
| `hooks/usePurchaseItems.js` | 80 |
| `components/PurchaseHeader.jsx` | 65 |
| `components/SupplierDropdown.jsx` | 91 |
| `components/PurchaseSubbar.jsx` | 126 |
| `components/PurchaseItemsTable.jsx` | 186 |
| `components/PurchaseFooter.jsx` | 71 |
| `components/PurchaseSettingsModal.jsx` | 106 |
| `components/InvoiceBreakdownModal.jsx` | 154 |
| `index.jsx` | 266 |

#### MedicineDetail (1,108 → 8 files) — Commit `bc36c17`
| File | Lines |
|------|-------|
| `hooks/useMedicineDetail.js` | 109 |
| `components/MedicineDetailHeader.jsx` | 96 |
| `components/MedicineDetailTabs.jsx` | 40 |
| `components/BatchesTab.jsx` | 140 |
| `components/TransactionTab.jsx` | 142 |
| `components/LedgerTab.jsx` | 61 |
| `components/MedicineEditModal.jsx` | 152 |
| `index.jsx` | ~120 |

#### Customers (771 → 7 files) — Commit `aeefb9b`
| File | Lines |
|------|-------|
| `hooks/useCustomers.js` | 101 |
| `components/CustomersTable.jsx` | 122 |
| `components/DoctorsTable.jsx` | 94 |
| `components/CustomerFormDialog.jsx` | 102 |
| `components/DoctorFormDialog.jsx` | 77 |
| `components/CustomerDetailDialog.jsx` | 122 |
| `index.jsx` | 165 |

#### Suppliers (747 → 6 files) — Commit `9646f24`
| File | Lines |
|------|-------|
| `hooks/useSuppliers.js` | 81 |
| `components/SuppliersList.jsx` | 90 |
| `components/SupplierDetailPanel.jsx` | 170 |
| `components/SupplierFormModal.jsx` | 106 |
| `components/SupplierPaymentModal.jsx` | 69 |
| `index.jsx` | 154 |

#### Dashboard (519 → 7 files) — Commit `4e6d2a6`
| File | Lines |
|------|-------|
| `hooks/useDashboard.js` | 29 |
| `components/MetricCard.jsx` | 47 |
| `components/QuickStatCard.jsx` | 35 |
| `components/SalesCharts.jsx` | 98 |
| `components/InsightsList.jsx` | 96 |
| `components/AlertsPanel.jsx` | 128 |
| `index.jsx` | 96 |

#### Settings (666 → 8 files) — Commit `4302e18`
| File | Lines |
|------|-------|
| `hooks/useSettings.js` | 80 |
| `components/SettingsTabs.jsx` | 40 |
| `components/InventoryTab.jsx` | 51 |
| `components/BillingTab.jsx` | 33 |
| `components/ReturnsTab.jsx` | 48 |
| `components/GeneralTab.jsx` | 56 |
| `components/BillSequenceTab.jsx` | 176 |
| `index.jsx` | 101 |

#### Reports (509 → 5 files) — Commit `286e982`
| File | Lines |
|------|-------|
| `hooks/useReports.js` | 96 |
| `components/ReportTypeCards.jsx` | 41 |
| `components/ReportFilters.jsx` | 88 |
| `components/ReportTables.jsx` | 146 |
| `index.jsx` | 102 |

### Phase 6 Totals
- **9 monolithic files** (8,204 total lines) → **73 focused files** (max 279 lines each)
- Every file passes the 300-line rule
- All raw `axios`+`${API}/...` replaced with `api` + `apiUrl.*`
- All inline `formatCurrency`/`formatDate` replaced with Phase 4 utilities

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

**Phase 7 — Fix Broken Pages:**
Work through each issue in the Phase 7 table above. Start with the highest-impact items:
1. Remove inline `Button` from Settings — use Shadcn `Button`
2. Replace custom dialogs in Users.js + RolesPermissions.js with Shadcn Dialog
3. Fix BillingOperations.js filters to re-fetch from server on change
4. Add unsaved-changes guard to BillingWorkspace
5. Standardise all list pages to use PageHeader + consistent toolbar
6. Add pagination UI to all list pages (hook already built in Phase 4)
