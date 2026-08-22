# PharmaCare — Roadmap
# Version: 1.3 | Last updated: August 22, 2026
# Audience: Claude, all developers
# Rule: Before building anything, check here first. If it's planned, follow the agreed design.
#        If it's Phase 2+, do NOT build it now — no premature architecture.

---

## STATUS LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ | Built and working |
| 🔄 | In progress — partially built |
| 📋 | Planned — design agreed, not yet built |
| 💡 | Idea — under consideration, not confirmed |
| 🚫 | Out of scope for Phase 1 |

---

## PHASE 1 — SINGLE STORE (Current)

### Core Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| JWT authentication | ✅ | Login, register, token refresh |
| Multi-tenancy (pharmacy_id isolation) | 🔄 | Enforced on the paths that have been audited; a real signup-flow bug (fixed) proved the pattern "forgot to scope by pharmacy_id" exists — full query audit not yet done. See `13_DEPLOYMENT.md` PRE-LAUNCH BLOCKERS #2. |
| Soft deletes | ✅ | `is_deleted` + `deleted_at` on all tables |
| Audit logging | ✅ | All state changes logged |
| PostgreSQL + SQLAlchemy async | ✅ | Migrated from MongoDB |
| Alembic migrations | ✅ | Schema version controlled |
| Design system (tokens, shared components) | ✅ | AppButton, PageHeader, PageTabs, FilterPills, etc. |
| 300-line file rule enforced | ✅ | All oversized pages split into folder/index.jsx + components/ |
| Zero raw `<button>` tags | 🔄 | Not actually true — `scripts/design-guard.sh` Rule 1 currently finds 38 violations across the app. Rule enforced on new/changed code via pre-commit; existing violations are unfixed tech debt. |
| Zero Shadcn `<Button>` in pages | 🔄 | Not actually true — Rule 5 currently finds 2 (`ScheduleHWarning.jsx`, `FinaliseModal.jsx`). Same as above — enforced going forward, not yet cleaned up. |
| Consistent page layout | ✅ | All list pages use `px-8 py-6 min-h-screen bg-page` + PageHeader |
| Consistent filter pills | ✅ | All pages use shared FilterPills component |
| Subtitles removed from all PageHeaders | ✅ | April 19, 2026 |

### Billing (Sales)

| Feature | Status | Notes |
|---------|--------|-------|
| Create draft bill | ✅ | DRAFT- prefix, no stock deducted |
| Settle bill (paid / due / partial) | ✅ | Sequential INV- number, stock deducted |
| Bill number — atomic sequential | ✅ | DB sequence, no gaps, no duplicates |
| Snapshot billing | ✅ | Name, MRP, GST stored at time of sale |
| GST calculation (integer paise) | ✅ | CGST + SGST, 0/5/12/18% |
| Schedule H1 validation | ✅ | HTTP 400 without doctor name |
| Schedule H1 register auto-create | ✅ | On every H1 settlement |
| Sales return (RTN- prefix) | ✅ | Stock restored, GST reversed |
| Credit / due bills | ✅ | balance_paise tracking |
| Record payment on due bill | ✅ | `POST /api/payments` |
| Bill PDF download | 🔄 | Endpoint exists, PDF template WIP |
| Bill print (browser) | ✅ | Thermal (80mm/58mm) + A4/A5, default set in Settings → Receipt & Print — was listed 📋 here, already built; moved here from the stale CLAUDE.md status list |
| Discount at bill level | ✅ | Bill-level discount_paise |
| Discount at line item level | ✅ | Per-item disc_percent |
| Patient search — add-new inline | ✅ | PatientCombobox: typeahead, /customers endpoint, walk-in + add-new mini-form |
| Doctor search — add-new inline | 🔄 | DoctorDropdown has typeahead + DB suggestions; needs the same "type a name with no match → Add [name]" inline flow PatientCombobox already has |
| Batch selection UX in medicine row | 📋 | Not discoverable today — needs a visual cue (chip with chevron) |
| WhatsApp — add custom number | 🔄 | Button exists; "Add custom number" flow incomplete |
| Split payment (cash + UPI on one bill) | 📋 | |
| Day-end closing / Z-report | 📋 | |

### Inventory

> Rewritten August 22, 2026 as a complete, code-verified use-case checklist
> (not a sample) — every row below was checked against the real router/model
> code, not assumed from memory. Work this list top to bottom, one row at a
> time, so a change doesn't drift ahead of what's actually verified. The
> previous version of this table claimed "Bulk upload (Excel) 🔄 backend
> done" — that was false; no such endpoint exists anywhere in the codebase
> (verified by grep, zero hits beyond Python's own `import` keyword). Doc
> drift like that is exactly what this rewrite is meant to stop.

**A. Product Catalog** — `backend/routers/inventory.py`, `models/products.py::Product`

| Use case | Status | Where | Notes |
|---|---|---|---|
| Create product | ✅ | `POST /products` | SKU auto-generated if omitted |
| Edit product | ✅ | `PUT /products/{id}` | Admin-only |
| Soft-delete product | ✅ | `DELETE /products/{id}` | Blocked if any batch has `quantity_on_hand > 0` |
| List / search products (name, SKU, brand, manufacturer) | ✅ | `GET /products` | |
| Product detail page | ✅ | `pages/MedicineDetail` | |
| Barcode / SKU lookup for billing | ✅ | `GET /products/barcode/{barcode}` | |
| Typeahead search with live batch/stock data | ✅ | `GET /products/search-with-batches` | Powers the billing item search |
| Categories / GST rates / dosage forms as one source of truth | ✅ | `GET /products/meta` | Frontend dropdowns read this, not a hardcoded local list |
| HSN code auto-derived from category (not free-typed) | ✅ | `CATEGORY_HSN_MAP` in `constants.py` | |
| Drug schedule (OTC/H/H1/X) | ✅ | `drug_schedule` column | Drives the H1 doctor-required billing check |
| Reorder level (per product) | ✅ | `reorder_level` column | Drives `/inventory` health severity — see gap below on the *other* two low-stock definitions |
| Reorder quantity (per product) | 🔄 | `reorder_quantity` column | Column exists and is set on create; nothing reads it yet — no "suggested purchase qty" feature consumes it |
| Bulk field update (GST%, category, schedule, discount%, location) | ✅ | `POST /products/bulk-update` | Backend also allows `brand`; `BulkUpdateModal.jsx` doesn't expose it in the UI — minor, not a bug |
| Bulk import via Excel/CSV | ❌ **Not built** | — | No endpoint, no parser, no UI anywhere in the repo. Correcting this table's previous false "🔄 backend done" claim |
| Barcode/label printing | ❌ **Not built** | — | No print-label code found |
| Multi-unit conversion (strip vs. box via `units_per_pack`) | ✅ | used in `billing.py`, `batches.py` | |
| Storage "location" field | 🔄 | `storage_location` (free-text string) + `location_id` param (always `"default"`) | Not a real multi-location system — matches Phase 1's single-store scope, but the `location_id` param on 3 endpoints is vestigial and misleading; either wire it or remove it |

**B. Batch & Stock Tracking** — `backend/routers/batches.py`, `models/products.py::StockBatch`

| Use case | Status | Where | Notes |
|---|---|---|---|
| Create batch (manual entry) | ✅ | `POST /stock/batches` | Rejects duplicate batch number per product, rejects already-past expiry |
| Create batch via Purchase/GRN confirm | ✅ | see Purchases section below | |
| Edit batch | ✅ | `PUT /stock/batches/{id}` | Admin-only |
| Soft-disable batch | ✅ | `DELETE /stock/batches/{id}` | Blocked if `quantity_on_hand > 0` |
| FEFO batch selection at billing | ✅ | ordered by `expiry_date` | Earliest-expiring active batch offered first |
| Batch list per product | ✅ | `MedicineDetail → BatchesTab` | |

**C. Stock Movements & Adjustments**

| Use case | Status | Where | Notes |
|---|---|---|---|
| Movement log on every stock change | ✅ | `StockMovement` model, `_record_movement()` helper | opening/sale/purchase/adjustment/writeoff/return all traced |
| Movement history view | ✅ | `GET /stock-movements`, `MedicineDetail → LedgerTab` | Paginated |
| Manual stock adjustment (add/remove + reason) | ✅ | `POST /batches/{id}/adjust` | Blocks a result below 0 |
| Expired-batch write-off | ✅ | `POST /batches/{id}/writeoff-expiry` | Blocks writing off a batch that isn't actually expired yet |
| Physical stock take / cycle count reconciliation | ❌ **Not built** | — | No code anywhere counts physical stock against system stock and reconciles the difference. Real gap for a compliance product — this is normally how shrinkage/theft/counting-error gets caught |

**D. Inventory Health / Alerts** — `GET /inventory`, `GET /inventory/filters`

| Use case | Status | Where | Notes |
|---|---|---|---|
| Health list: out_of_stock / expired / near_expiry / low_stock / healthy | ✅ | `inventory.py::get_inventory_with_health` | Severity-sorted, paginated |
| Filter by category / brand / status | ✅ | `GET /inventory/filters` | |
| Near-expiry threshold, configurable | ✅ | `PharmacySettings.near_expiry_threshold_days` | Same value read consistently by both `/inventory` and `/analytics/dashboard` — verified consistent |
| ⚠ Low-stock threshold — **three different definitions, unreconciled** | ❌ **Real gap** | see below | Not one bug — three separate, disagreeing implementations live in the codebase right now |

**Low-stock gap, in detail (found and verified this pass, not yet fixed):**
1. `GET /inventory` (the Inventory list page) uses each **product's own** `reorder_level`.
2. `GET /analytics/dashboard` (Dashboard alerts) uses the **pharmacy-wide** `PharmacySettings.low_stock_threshold_days` setting, checked **per batch**, not per product's summed stock.
3. `GET /reports/dashboard` (Dashboard's top stat cards) **hardcodes `10`**, ignoring both the per-product `reorder_level` and the pharmacy-wide setting entirely.

A pharmacist can set a product's reorder level to 50 and see it flagged "low stock" on the Inventory page, while the Dashboard stat card — same product, same moment — uses a hardcoded 10 and doesn't flag it at all. This wasn't visible until the three endpoints were read side by side. Needs a decision (which definition is *the* definition) before a fix, not just a patch to one endpoint.

**E. Settings → Inventory tab enforcement** — `frontend/src/pages/Settings/components/InventoryTab.jsx`, `backend/routers/settings.py`

| Use case | Status | Where | Notes |
|---|---|---|---|
| "Block expired stock from billing" toggle | ❌ **Not enforced, not even persisted** | `settings.py:207` | `GET /settings` returns this field **hardcoded to `True`** — there is no DB column backing it. Flipping the toggle in the UI does nothing; `billing.py` never checks a batch's `expiry_date` before allowing a sale |
| "Allow near-expiry sale (with warning)" toggle | ❌ **Not enforced, not even persisted** | `settings.py:208` | Same as above — hardcoded `True` on GET, never read anywhere in `billing.py` |
| "Enable low stock alerts on dashboard" toggle | ✅ | `alert_low_stock_enabled` column, read by `/analytics/dashboard` | Server returns both the data and the flag; the frontend is responsible for honoring the flag when rendering `AlertsPanel` — confirm this client-side check exists before treating the feature as fully done |
| Near-expiry alert days | ✅ | `near_expiry_threshold_days` column | Persisted and read correctly, unlike the two toggles above |

---

### Inventory's cross-cutting dependents

> Per Manifesto rule 11: these are the sections that read or are shaped by
> Inventory data. Any change to Inventory's schema or business rules must be
> checked against every row here in the same change, not after.

**Dashboard / Analytics** (`GET /reports/dashboard`, `GET /analytics/dashboard`, `pages/Dashboard`)
- Total active product count — ✅ (`reports.py::get_dashboard_stats`)
- Total stock value (Σ `quantity_on_hand × cost_price_paise`) — ✅
- Low stock count — 🔄 **uses the hardcoded-10 definition**, see gap above
- Expiring-soon count — ✅ (30-day fixed window on this endpoint specifically — note this is a *third* expiry window, separate from the configurable `near_expiry_threshold_days` used elsewhere; worth reconciling in the same pass as the low-stock fix)
- AlertsPanel (low stock + near expiry + drug license expiry) — ✅ data side; 🔄 verify frontend actually gates on `low_stock_enabled`/`near_expiry_enabled` flags
- Sales charts / insights — ✅, not inventory-dependent, out of scope here

**Settings** (`pages/Settings/components/InventoryTab.jsx`, `GeneralTab`, `GSTTab`)
- Near-expiry day threshold — ✅ wired end-to-end
- Low-stock day threshold — 🔄 wired to `/analytics/dashboard` only, not to `/inventory` or `/reports/dashboard` (see gap above)
- Block-expired-stock / allow-near-expiry-sale toggles — ❌ UI-only, no backend column, no enforcement (see above)
- Default GST rate / HSN mapping (Tax & GST tab) — ✅ applied at product-create time via `CATEGORY_HSN_MAP`

**Billing** (already covered in depth in `docs/07_BUSINESS_LOGIC.md` and `docs/08_ARCHITECTURE.md`'s cross-cutting map — cross-referenced, not repeated here)
- FEFO batch consumption, MRP-vs-batch check, H1 doctor-required check, stock-oversell guard — ✅ all built and verified this session
- Expired-batch sale blocking — ❌ **not built**, ties directly to the Settings gap above: even if the toggle worked, nothing downstream would enforce it

**Purchases** (`routers/purchases.py`, cross-referenced in the table below)
- Confirming a purchase creates `StockBatch` rows and `StockMovement` entries — ✅

**Reports** (`docs/07_BUSINESS_LOGIC.md`'s GST report section)
- GST report reads `Product.gst_rate`/`hsn_code` at time of sale (frozen on the bill/purchase line item, not live-joined) — ✅, already documented
- Schedule H1 register reads `Product.drug_schedule` — ✅, already documented

### Purchases

| Feature | Status | Notes |
|---------|--------|-------|
| Create purchase (draft) | ✅ | |
| Confirm purchase (stock in) | ✅ | Creates batches, stock movements |
| Purchase number (PUR-YYYYMMDD-XXXX) | ✅ | |
| Purchase return | ✅ | Stock deducted, GRN reversed |
| Supplier management (CRUD) | ✅ | |
| Link purchase to supplier | ✅ | |
| Purchase history per supplier | ✅ | |

### Customers

| Feature | Status | Notes |
|---------|--------|-------|
| Customer CRUD | ✅ | |
| Customer purchase history | ✅ | |
| Credit limit per customer | 💡 | Not yet designed |
| Loyalty / points | 🚫 | Phase 2 |

### Reports

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard analytics | ✅ | Revenue, bills, top products, dynamic thresholds from settings |
| Drug license expiry banner | ✅ | Amber strip above metrics, dismissible, links to Settings |
| GST report (GSTR-1 summary) | ✅ | Grouped by HSN, date range |
| Sales report | ✅ | By date range |
| Margin report | 🔄 | Data exists, UI WIP |
| Stock valuation report | 📋 | Cost × qty on hand |
| Purchase report | ✅ | By date range, supplier |
| Expiry report | 📋 | Batches expiring in N days |
| Schedule H1 register | ✅ | Read-only compliance view |
| Audit log viewer | ✅ | Read-only, all actions |

### Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Pharmacy profile (name, address, GSTIN, logo, DL, FSSAI, PAN) | ✅ | Drag & drop logo, inline validation, DL expiry warning |
| Receipt & Print settings | ✅ | Live bill preview, paper size (A4/A5/58mm/80mm), show/hide toggles, header/footer |
| Tax & GST settings | ✅ | Composition scheme, IGST toggle, default rate, HSN defaults, round off |
| Notifications settings | ✅ | Low stock, near expiry, drug license alerts — toggle + threshold stepper |
| Bill number prefix + sequence config | ✅ | |
| Inventory settings | ✅ | Near expiry days, low stock threshold |
| Billing settings | ✅ | Draft bills, auto-print |
| Returns settings | ✅ | Return window, partial returns |
| Team management (add/remove users) | ✅ | |
| Role assignment | ✅ | admin / manager / cashier / inventory_staff |

---

## MANIFESTO ITEMS NOT YET BUILT

These are confirmed requirements from CLAUDE.md `WHAT'S NEXT`. Build in this order:

### 1. Sheets (right-side drawers) — `📋 Planned`

Replace all centered modals for data-entry forms.

- **What:** Shadcn `<Sheet side="right">`, 480px wide
- **Where:** New bill form, new purchase form, add/edit medicine, add supplier
- **Why:** Industry standard (Linear, Notion) — better for complex forms than centered modals
- **Rule:** All new data-entry forms must use Sheet. No new centered modals.

### 2. Zod + react-hook-form on all forms — `📋 Planned`

- **What:** Every form uses `zodResolver` with a schema
- **Where:** All forms in Billing, Purchases, Inventory, Settings
- **Why:** Consistent validation, type-safe, eliminates uncontrolled inputs
- **Rule:** No new form without a Zod schema

### 3. Error retry states — `📋 Planned`

- **What:** Network errors show Shadcn `<Alert variant="destructive">` + Retry button
- **Where:** Every page that fetches data
- **Why:** No silent failures
- **Rule:** Every `catch` block must display something. See `12_ERROR_HANDLING.md`.

### 4. Command Palette — `📋 Planned`

- **What:** `Cmd+K` opens global search
- **Searches:** Bills (by number/customer), medicines, customers, suppliers
- **UI:** Shadcn `<Command>` component
- **Rule:** Does not block any current work. Build after Sheets + Zod.

### 5. Speed keys — `📋 Planned`

- `n` = new (context-aware — new bill on billing page, new product on inventory)
- `f` = open filter panel
- `/` = focus search
- `Esc` = close sheet/modal
- `Enter` = confirm primary action

---

## AUTH OVERHAUL — `📋 Planned` (build as one sprint)

All auth improvements must be built together — they share the same architectural change (stateless JWT → DB-backed sessions).

### 6. Forgot password / reset flow — `📋 Planned`

- **What:** "Forgot password?" on login → email with reset link → user sets new password
- **Why:** Currently no self-service recovery. If a user forgets their password, they are locked out.
- **Needs:** Email infrastructure (SMTP / SendGrid), password reset token table in DB
- **Rule:** Reset tokens expire in 1 hour. Single use only.

### 7. Admin force-logout / session management — `📋 Planned`

- **What:** Admin can see all active sessions per user (device, IP, last seen) and remotely log them out
- **Where:** Team → Members → click member → Sessions panel
- **Why:** Staff leave, devices go missing, suspicious after-hours logins. Pharmacy handles PII + financial data — session control is a compliance requirement.
- **Needs:** `user_sessions` table (user_id, device, ip, last_seen, token_ref), token blacklist or DB-backed refresh tokens, `GET /users/{id}/sessions`, `DELETE /sessions/{id}` endpoints
- **Rule:** Logging out a session must take effect within seconds — not at next JWT expiry.

### 8. Admin reset password for other users — `📋 Planned`

- **What:** Admin sets a temporary password for any user from Team → Members
- **Why:** Cashier forgets password → billing counter stops. Admin must be able to unblock them instantly.
- **Needs:** Shares infra with #6 and #7. Build in same sprint.

---

## PHASE 2 — MULTI-STORE CHAINS `🚫 Do not build now`

| Feature | Notes |
|---------|-------|
| Chain / HQ account | One account, multiple store locations |
| Store switcher in sidebar | |
| Cross-store stock transfer | |
| Centralized purchase orders | HQ orders for all stores |
| Chain-level GST reports | |
| Store-level P&L | |

> **Do not add `chain_id`, `store_id`, or any multi-store column to Phase 1 tables.** It creates premature complexity. Phase 2 will be a migration sprint.

---

## PHASE 3 — PLATFORM `🚫 Do not build now`

| Feature | Notes |
|---------|-------|
| Patient app (prescription refills) | |
| Doctor portal (e-prescriptions) | |
| Distributor integration (live price lists) | |
| Government reporting API (CDSCO) | |
| WhatsApp / SMS reminders (refills, dues) | |
| Accounting integration (Tally, Zoho Books) | |

---

## WHAT NOT TO BUILD (ever, in Phase 1)

| Request | Why not |
|---------|---------|
| IGST support | All sales are intra-state in Phase 1 |
| Multi-currency | Indian market only |
| Online pharmacy (sell to patients online) | Regulatory complexity, out of scope |
| Controlled substance (Schedule X) billing | Requires different compliance system |
| Insurance claims / CGHS | Phase 3+ |
| AI drug interaction checker | Not a pharmacy management feature |
| Hard delete anything | Compliance — forever forbidden |

---

## KNOWN ISSUES / TECH DEBT

| Issue | Priority | Notes |
|-------|----------|-------|
| Sheets not implemented — forms use centered modals | High | Next sprint |
| Zod not on all forms — some use uncontrolled inputs | High | Next sprint |
| Bill PDF template incomplete | Medium | Renderer exists, layout WIP |
| Low stock / expiry alerts surfaced in Dashboard AlertsPanel | ✅ | Done — thresholds read from PharmacySettings |
| Bulk upload UX incomplete | Medium | Backend done |
| Margin report UI WIP | Low | Data available via API |
| No CI/CD pipeline | Medium | Manual deploys today |
| No staging environment | Medium | Dev → prod directly today |
| Feature flags not connected to Roadmap items | Medium | All 📋 items should ship behind a flag |

---

*Update this file when a feature ships (✅) or a new item is confirmed (📋).*
*Owner: developer who builds the feature updates the status row.*
