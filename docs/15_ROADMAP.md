# PharmaCare — Roadmap
# Version: 1.0 | Last updated: April 18, 2026
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
| Multi-tenancy (pharmacy_id isolation) | ✅ | Every table, every query |
| Soft deletes | ✅ | `is_deleted` + `deleted_at` on all tables |
| Audit logging | ✅ | All state changes logged |
| PostgreSQL + SQLAlchemy async | ✅ | Migrated from MongoDB |
| Alembic migrations | ✅ | Schema version controlled |
| Design system (tokens, shared components) | ✅ | AppButton, PageHeader, PageTabs, FilterPills, etc. |
| 300-line file rule enforced | ✅ | All oversized pages split into folder/index.jsx + components/ |
| Zero raw `<button>` tags | ✅ | All pages use AppButton exclusively |
| Zero Shadcn `<Button>` / `<Card>` in pages | ✅ | Replaced with AppButton and plain divs |
| Consistent page layout | ✅ | All list pages use `px-8 py-6 min-h-screen bg-[#F8FAFB]` + PageHeader |
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
| Bill print (browser) | 📋 | Print-optimized layout |
| Discount at bill level | ✅ | Bill-level discount_paise |
| Discount at line item level | ✅ | Per-item disc_percent |

### Inventory

| Feature | Status | Notes |
|---------|--------|-------|
| Product catalog (CRUD) | ✅ | With drug schedule, GST rate, HSN |
| Stock batches (CRUD) | ✅ | batch_number, expiry, MRP, cost |
| FEFO batch selection | ✅ | Earliest expiry consumed first |
| Stock movements log | ✅ | All changes traced (purchase/sale/adjustment) |
| Low stock alerts | ✅ | Threshold from settings, shown in Dashboard AlertsPanel |
| Expiry alerts | ✅ | Threshold from settings, shown in Dashboard AlertsPanel |
| Manual stock adjustment | ✅ | With reason note, audit logged |
| Bulk upload (Excel) | 🔄 | Backend done, frontend UX incomplete |
| Inventory search | ✅ | By name, SKU, batch number |
| Stock report (qty on hand) | ✅ | `/api/inventory` list |

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
