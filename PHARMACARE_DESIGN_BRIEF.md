# PHARMACARE — Complete Design Brief
*Single-file context for design conversations on claude.ai*
*Paste this entire file, then upload screenshots of the pages you want to change.*

---

## What Is This App

**PharmaCare** is a web-based pharmacy management system for a single Indian pharmacy. It handles billing, inventory, purchases, customers, suppliers, GST reporting, and team management. It runs in a browser on a desktop (minimum 1280px wide), used by pharmacists, cashiers, and managers throughout the day.

**Tech stack:** React, Tailwind CSS, Shadcn/UI components, FastAPI backend, PostgreSQL  
**Primary color:** Steel Blue `#4682B4`  
**Font:** System UI (no custom font loaded)  
**Component library:** Shadcn/UI exclusively — no MUI, no Ant Design

---

## Design System — Quick Reference

| Token | Value |
|-------|-------|
| Primary action | `#4682B4` Steel Blue |
| Primary hover | `#3a6fa0` |
| Sidebar background | `#1a2332` Dark Navy |
| Page background | `#f8f9fa` |
| Surface (cards/tables) | `#ffffff` |
| Table row hover | `#f0f7ff` |
| Border | `#e5e7eb` |
| Page padding | `px-8 py-6` |
| Table header | `text-[11px] font-medium text-gray-500 uppercase tracking-wider` |
| Row height | `h-10` (40px — compact/Zoho density) |
| Amounts | `font-semibold tabular-nums text-gray-900`, right-aligned, `₹` prefix |
| Batch numbers | `font-mono` |
| Badges | `text-xs font-medium px-2 py-0.5 rounded-full bg-X-50 text-X-700 border border-X-200` |
| Page title | `text-2xl font-semibold text-gray-900` |

---

## App Structure

### Navigation Sidebar
- Fixed left sidebar, `200px` wide, dark navy `#1a2332` background
- Always visible on desktop, never collapses
- 5 nav groups with section labels:

```
DAILY OPS       Dashboard · Billing · Inventory · Purchases
RELATIONSHIPS   Customers · Suppliers
REPORTS         Reports · GST Report · Stock Log
COMPLIANCE      Schedule H1 Register · Audit Log
ADMIN           Settings · Team
```

- Bottom strip: user avatar + name + role badge + Logout button
- Active item: `bg-blue-600/20 text-white`, inactive: `text-gray-300`

### Global Layout Pattern (every listing page)
```
┌─ Sticky Page Header ─────────────────────────────────────────────┐
│  Page Title (text-2xl font-semibold)    [Secondary] [+ Primary]  │
│  Subtitle / item count                                            │
├─ Filter Bar ─────────────────────────────────────────────────────┤
│  [Search input]  [Filter chips: All Cash UPI Due…]  [Date Range] │
├─ Table ──────────────────────────────────────────────────────────┤
│  COL HEADER   COL HEADER   COL HEADER              ACTIONS       │
│  row          row          row                      👁 ✏ 🗑      │
│  row          row          row                      👁 ✏ 🗑      │
├─ Pagination ─────────────────────────────────────────────────────┤
│  Showing 1–20 of 123                         [< 1 2 3 ... >]     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Every Page — Current Layout Description

---

### 1. Dashboard
**Route:** `/dashboard`  
**Purpose:** Overview of today's sales, alerts, and quick stats

**Current layout:**
```
Header row: "Dashboard" title + Refresh button (right)
─────────────────────────────────────────────────────
Row 1: 4 MetricCards in a grid (Today's Sales / This Week / This Month / Total Sales)
       Each card: icon + title + large value + % change badge + subtitle
       Colors: green / blue / purple / indigo (one per card)
─────────────────────────────────────────────────────
Row 2: Charts (2 columns)
       Left: Sales trend line chart (daily, last 30 days)
       Right: Category sales donut/bar chart
─────────────────────────────────────────────────────
Row 3: Insights (2 columns)
       Left: Top Products list
       Right: Top Customers list
─────────────────────────────────────────────────────
Row 4: Alerts panel (3 columns)
       Low Stock warnings · Expiring Soon warnings · Recent Bills
─────────────────────────────────────────────────────
Row 5: 4 QuickStatCards (Pending Payments / Draft Bills / Returns / Stock Value)
       Smaller cards, clickable, navigate to relevant page
```

**Known violations:** Page wrapper uses `p-6 bg-gray-50` → should be `px-8 py-6`. MetricCard and QuickStatCard use `indigo` color variant (non-standard) → should be `blue`.

---

### 2. Billing / Sales & Billing
**Route:** `/billing`  
**Purpose:** List of all sales bills — view, print, WhatsApp share

**Current layout:**
```
Header: "Sales & Billing" + bill count
        [Sales Returns] [+ New Bill]
─────────────────────────────────────────────────────
Filter bar:
  Left:  [Search: bill no., patient...]   [All] [Cash] [UPI] [Due] [Parked] chips
  Right: [Date Range picker]
─────────────────────────────────────────────────────
Table columns:
  Bill #  |  Date & Time  |  Customer  |  Items  |  Amount  |  Payment  |  Status  |  Actions
  
  Bill # → blue link, font-mono
  Amount → ₹ right-aligned, font-semibold tabular-nums
  Payment → badge (Cash=green, UPI=blue, Credit=purple)
  Status → badge (Paid=green, Due=amber, Parked=gray, Returned=red)
  Actions (hover only): 👁 View · 🖨 Print · 📱 WhatsApp
─────────────────────────────────────────────────────
Pagination bar
```

**Empty state:** Icon + "No bills found" + "Create your first bill" button  
**Loading state:** Skeleton rows (5 rows matching column widths)

---

### 3. Billing Workspace (New Bill)
**Route:** `/billing/new` or `/billing/new/:id`  
**Purpose:** Full-screen bill creation workspace — the most complex page in the app

**Current layout:**
```
Top bar (sticky): Bill # · Date · Customer selector · Doctor selector · [Settings] [Save Draft] [Finalise]
─────────────────────────────────────────────────────
Main split (2 panels):
  Left (60%): Medicine search input → results dropdown with batch details
              Items table: Medicine · Batch · Qty · MRP · Discount · GST · Net
              Each row editable — qty, discount inline edit
              
  Right (40%): Bill summary panel
               Subtotal / Item Discounts / Bill Discount / GST / CESS
               Grand Total (large, prominent)
               Payment method tabs: Cash / UPI / Credit
               [Finalise Bill] primary button
─────────────────────────────────────────────────────
Finalise modal: Payment confirmation + grand total
```

**This page is the core workflow.** It needs to be fast, keyboard-friendly, and visually clean. Currently uses `slate-*` colors throughout and `font-black` on totals — both violations.

---

### 4. Bill Detail
**Route:** `/billing/:id`  
**Purpose:** Read-only view of a completed bill + print

**Current layout:**
```
Header: Bill # (font-mono, blue) · Status badge · [Print] [Back]
─────────────────────────────────────────────────────
Two-column layout:
  Left column:
    Patient info card: name, phone, address, GSTIN
    Doctor info (if referred)
    
  Right column:
    Bill summary: date, bill type, payment method
    Amount breakdown: subtotal / discount / GST / net amount

Items table:
  Medicine | Batch | Qty | MRP | Discount | GST | Net Amount
  
Footer totals: Subtotal · Discount · GST (CGST + SGST shown separately) · Grand Total
```

---

### 5. Purchases List
**Route:** `/purchases`  
**Purpose:** List of all purchase invoices from suppliers

**Current layout:**
```
Header: "Purchases" + count  
        [+ New Purchase]
─────────────────────────────────────────────────────
Filter bar:
  [Search: supplier, invoice #]   [All] [Cash] [Credit] [Due]   [Date Range]
─────────────────────────────────────────────────────
Table columns:
  Invoice #  |  Date  |  Supplier  |  Items  |  Amount  |  Payment Status  |  Actions
  
  Amount → ₹ right-aligned, tabular-nums
  Payment Status → badge (Paid=green, Unpaid=amber, Partial=amber)
  Actions (hover): 👁 View · ✏ Mark as Paid (if unpaid)
─────────────────────────────────────────────────────
Mark as Paid → inline dialog (Shadcn Dialog) with amount + method fields
Pagination bar
```

---

### 6. Purchase New / Edit
**Route:** `/purchases/new`  
**Purpose:** Record a new purchase from a supplier

**Current layout:**
```
Top bar: Supplier selector · Invoice # · Date · [Settings] [Save Draft] [Confirm Purchase]
─────────────────────────────────────────────────────
Items table (editable):
  Medicine search → add row
  Columns: Medicine · Batch · Expiry · Qty · PTR · MRP · Discount · GST · Net
  
Summary panel (right side or bottom):
  Total items · GST breakdown (CGST / SGST) · Grand Total
  
[Confirm Purchase] primary CTA
```

---

### 7. Sales Returns List
**Route:** `/billing/returns`  
**Purpose:** List of all sales return transactions

**Current layout:** Same structure as Billing list. Columns: Return # · Original Bill · Date · Customer · Items · Amount · Method · Status · Actions

---

### 8. Sales Return Create
**Route:** `/billing/returns/new`  
**Purpose:** Create a sales return against an original bill

**Current layout:**
```
Select original bill → loads bill items
Check items to return + qty
Refund method selection: Cash / Credit to Account / Adjust Outstanding
Net amount display (prominent, red text)
[Process Return] primary button
```

---

### 9. Purchase Returns List
**Route:** `/purchases/returns`  
**Purpose:** List of purchase returns to suppliers  
**Layout:** Same pattern as Purchases list. ✅ Mostly compliant.

---

### 10. Purchase Return Create / Detail
**Route:** `/purchases/returns/new` and `/purchases/returns/:id`  
**Purpose:** Return goods to supplier against a purchase invoice

**Known violations (heavy):** Uses banned teal hex `#0C7A6B` throughout for all primary text, amounts, and links. Uses `#CC2F2F` for return amounts instead of `text-red-600`. Uses custom `fixed inset-0` modal.

---

### 11. Inventory
**Route:** `/inventory`  
**Purpose:** Search and manage all medicines/products in stock

**Current layout:**
```
Header bar: "Inventory" title · stock summary stats · [+ Add Stock] [Bulk Upload]
─────────────────────────────────────────────────────
Search bar: Large search input (full width)
            Active filter chips below search (removable)
            [🔧 Filters] button → opens FilterDrawer on right
─────────────────────────────────────────────────────
Initial state (before search): 
  Large empty state with summary stats:
  Total Products · Low Stock count · Expiring Soon count · Out of Stock count
  Each stat is a clickable card that applies the filter

After search:
  Bulk action bar (when items selected): # selected · [Bulk Update] button
  Table: ☐ · Medicine · SKU · Batch · Stock · Expiry · MRP · Cost · Category · Actions
  Actions (hover): ✏ Edit · ± Adjust Stock
─────────────────────────────────────────────────────
Pagination
```

**Filter Drawer (right slide-in):**
- Category · Schedule (H/X/OTC) · Stock Status (Low/Out/OK) · Expiry filter
- [Apply Filters] [Clear All] buttons

**Known violations:** Entire teal theme (`#E6FAFA`, `#00A3A3`, `#B2F5F5`) on bulk bar, filter chips, and empty state circles. All need to change to standard gray/green.

---

### 12. Medicine Detail
**Route:** `/inventory/:sku`  
**Purpose:** Full detail view of a single medicine — batches, transactions, ledger

**Current layout:**
```
Header: Medicine name · SKU (font-mono) · Schedule badge · Category badge
        [Edit Product] [Back]
─────────────────────────────────────────────────────
3 tabs (Shadcn tabs):
  Batches    — table of all batches: Batch # · Expiry · Qty · MRP · PTR · Status
  Ledger     — stock movement history: Date · Type · Qty · Batch · Reference
  Transactions — purchase/sale history: Date · Type · Party · Qty · Amount
```

---

### 13. Customers & Doctors
**Route:** `/customers`  
**Purpose:** Manage patient/customer records and referring doctors

**Current layout (recently redesigned):**
```
Sticky header rectangle: "Customers & Doctors" title + subtitle
─────────────────────────────────────────────────────
Horizontal tab row (underline style):
  [👤 Customers (N)]   [🩺 Doctors (N)]
─────────────────────────────────────────────────────
Filter bar:
  Left: [Search by name, phone…]
  Right: [Export Excel] [+ Add Customer] or [+ Add Doctor]
─────────────────────────────────────────────────────
Customers Table columns:
  Customer  |  Contact (phone + email)  |  Type badge  |  Credit Limit  |  Actions
  Type badge: Regular=blue · Wholesale=purple · Institution=green
  Actions (hover): 👁 View · ✏ Edit · 🗑 Delete

Doctors Table columns:
  Doctor (name + clinic)  |  Contact  |  Specialization badge  |  Actions
  Actions (hover): ✏ Edit · 🗑 Delete
─────────────────────────────────────────────────────
Pagination
```

---

### 14. Suppliers
**Route:** `/suppliers`  
**Purpose:** Manage supplier records + view purchase history + record payments

**Current layout:**
```
Header: "Suppliers" + count + filter chips [All] [Active] [Inactive] [Outstanding]
        [Date Range]   [Search]   [+ Add Supplier]
─────────────────────────────────────────────────────
Split layout:
  Left (60%): Suppliers table
    Supplier name + contact person
    Phone + email
    GSTIN (font-mono, gray chip)
    Outstanding amount (red if > 0)
    Status badge (Active=green / Inactive=red)
    Click row → opens detail panel on right
    
  Right (40%): Detail panel (shown when supplier selected)
    Supplier name + status + GSTIN
    [Edit] [Record Payment] buttons
    Outstanding balance (large, red if > 0, green if zero)
    
    2 sub-tabs:
      Overview — address, contact details, bank info
      History  — purchase invoice table (Invoice # · Date · Amount · Status)
    
    Payment history section below
─────────────────────────────────────────────────────
Pagination (left panel)
```

**Known violations:** Uses `#0C7A6B` teal on purchase numbers, `#CC2F2F` and `#166B3E` hardcoded on outstanding amounts. Custom `fixed inset-0` modals for Form and Payment.

---

### 15. GST Report
**Route:** `/gst`  
**Purpose:** GST summary — Output Tax vs Input Tax Credit, net liability

**Current layout:**
```
Header: "GST Report" + date range selector
─────────────────────────────────────────────────────
Summary cards (2 columns):
  Output Tax (Sales GST collected)  |  Input Tax Credit (Purchase GST paid)
  Net Liability = Output - Input
  
Each card shows: 5% / 12% / 18% / 28% breakdowns as sub-rows

Net Liability card (full width):
  Shows whether pharmacy owes GST or has credit
  Color: red if liability, green if credit
─────────────────────────────────────────────────────
Export buttons: [Export CSV] [Export Excel]
```

**Known violations:** Uses `bg-emerald-*` for credit state — should use `bg-green-*`. `text-blue-600` / `text-green-600` on section labels → `text-gray-500`.

---

### 16. Reports
**Route:** `/reports`  
**Purpose:** Business intelligence reports — sales, low stock, expiry, inventory value

**Current layout:**
```
Header: "Reports" title
─────────────────────────────────────────────────────
Report type selector (4 cards in a row):
  📈 Sales Report  |  ⚠ Low Stock  |  🕐 Expiry Report  |  📦 Stock Report
  Active card highlighted in blue
─────────────────────────────────────────────────────
Filter row (changes per report type):
  Sales: [Date range] [Refresh] [Export CSV] [Export Excel]
  Low Stock: [Refresh] [Export]
  Expiry: [Days threshold input] [Refresh] [Export]
  Inventory: [Refresh] [Export]
─────────────────────────────────────────────────────
Results table (changes per report type):
  Sales:     Bill # · Date · Customer · Items · Payment · Amount
  Low Stock: Product · Current Stock · Reorder Level · Shortage · Status
  Expiry:    Product · Batch · Stock · Expiry Date · Days Left
  Inventory: Product · Category · Batches · Total Stock · Value
─────────────────────────────────────────────────────
Summary totals row at bottom of each table
```

**Known violations:** All `<th>` use `font-semibold text-gray-600` → should be `font-medium text-gray-500 uppercase tracking-wider text-[11px]`. All table row hover uses `hover:bg-gray-50` → `hover:bg-[#f0f7ff]`.

---

### 17. Stock Movement Log
**Route:** `/stock-log`  
**Purpose:** Audit trail of every stock quantity change

**Current layout:**
```
Header: "Stock Movement Log" + [Refresh] button
─────────────────────────────────────────────────────
Filter bar: [Search by product/SKU]   [Type filter chips: All Sale Purchase Adjustment Opening]   [Date Range]
─────────────────────────────────────────────────────
Table columns:
  Date · Medicine (SKU) · Batch · Movement Type badge · Qty Change (+/-) · Stock After · Reference
  
  Movement type badges: Sale=blue · Purchase=green · Adjustment=orange · Opening=purple
  Qty Change: green (+) for additions, red (-) for reductions
─────────────────────────────────────────────────────
Pagination
```

---

### 18. Audit Log
**Route:** `/audit`  
**Purpose:** System-wide audit trail — who did what and when

**Current layout:**
```
Header: "Audit Log" + [Refresh] button
─────────────────────────────────────────────────────
Filter bar: [Search]   [Action type filter: All Create Update Delete Login…]   [Date Range]
─────────────────────────────────────────────────────
Table columns:
  Timestamp · User · Action badge · Entity Type · Entity ID · Description
  
  Action badges: create=green · update=blue · delete=red · login=purple · bill_parked=amber
─────────────────────────────────────────────────────
Pagination
```

**Known violations:** All action type badge colors use `bg-X-100` → should be `bg-X-50`.

---

### 19. Schedule H1 Register
**Route:** `/schedule-h1`  
**Purpose:** Legal compliance register for Schedule H1 medicines dispensed

**Current layout:**
```
Header: "Schedule H1 Register"
─────────────────────────────────────────────────────
Filter bar: [Search]   [Date Range]   [Export]
─────────────────────────────────────────────────────
Table columns:
  S.No · Date · Patient Name · Age/Gender · Medicine · Batch · Qty · Doctor · Bill #
  
  All data read-only (auto-populated from billing)
─────────────────────────────────────────────────────
Pagination
```
✅ Mostly compliant — no major violations.

---

### 20. Settings
**Route:** `/settings`  
**Purpose:** Pharmacy configuration — 3-tab page

**Current layout:**
```
Header: "Settings" + [Save Changes] button (hidden on Billing Config tab)
─────────────────────────────────────────────────────
3 Shadcn tabs:

Tab 1 — Pharmacy Profile:
  Fields: Pharmacy Name · Address · GSTIN · Drug License Number
  [Save Profile] button

Tab 2 — Billing Config:
  Section: Bill Sequences
    Table of prefix + counter + last used
    [+ New Sequence] · each row has configure action
    Configure modal: prefix / starting number / reset options
    
  Section: Billing Behaviour  
    Toggles: Allow draft bills · Auto-print on finalise · Require doctor for Schedule H
    [Save Billing Settings]
    
  Section: Returns Policy
    Toggles: Allow partial returns · Auto-create credit note
    Return window: [N] days
    [Save Returns Policy]

Tab 3 — Preferences:
  Fields: Currency · Timezone
  Section: Inventory Rules
    Near expiry threshold: [N] days
    Toggles: Block expired stock · Allow near-expiry sale · Low stock alerts
  [Save Preferences]
```

---

### 21. Team
**Route:** `/team`  
**Purpose:** Manage pharmacy staff and roles — merged single-page (replaced separate Users + Roles pages)

**Current layout:**
```
Header: "Team" title
─────────────────────────────────────────────────────
2 Shadcn tabs:

Tab 1 — Members:
  Header: member count + [+ Invite Member]
  Search: [Search by name or email]
  
  Table columns:
    User · Email · Role badge · Status · Last Active · Actions
    Role badges: Admin=purple · Manager=blue · Cashier=green · Inventory=amber
    Status: Active=green · Inactive=red
    Actions (hover): ✏ Edit · 🔑 Change Password · ✕ Deactivate / ✓ Activate

  Dialogs: Invite Member · Edit Member · Change Password — all Shadcn Dialogs

Tab 2 — Roles & Permissions:
  Roles list on left (Admin / Manager / Cashier / Inventory Staff)
  Permissions matrix on right:
    Rows = permission names
    Column = checkboxes
  [Save Permissions] button
```

---

## Current Known Violations (to fix before any redesign)

These are code-level issues that will be fixed separately. Do NOT design around them:

| Issue | Files affected | Fix |
|-------|---------------|-----|
| Banned teal hex (`#0C7A6B`, `#0d9488`, `#E6FAFA`) | PurchaseReturn*, Suppliers*, Inventory*, BillingWorkspace | Replace with `text-[#4682B4]` or `text-red-600` |
| Raw `axios` import | 14 legacy files | Replace with `api` from `@/lib/axios` |
| Custom `fixed inset-0` modals | ~20 files | Replace with Shadcn `<Dialog>` |
| `bg-X-100` badges | AuditLog, BillingWorkspace, MedicineDetail | Change to `bg-X-50` |
| `font-black` on amounts | BillingWorkspace, SalesReturn, PurchaseReturn | Change to `font-semibold tabular-nums` |
| `slate-*` / `rose-*` colors | BillingWorkspace throughout | Change to `gray-*` / `red-*` |

---

## What Works Well (Do Not Change)

- Customers & Doctors horizontal tab layout — recently designed, compliant ✅
- Team page 2-tab layout — recently designed, compliant ✅
- Settings 3-tab layout — recently designed, compliant ✅
- BillingOperations filter chips and search bar ✅
- PurchasesList filter chips ✅
- All shared components (`SearchInput`, `StatusBadge`, `DeleteConfirmDialog`, `PaginationBar`) ✅
- Sidebar nav structure and groups ✅

---

## Shared Components Available

| Component | Use |
|-----------|-----|
| `<PageHeader>` | Title + subtitle + action buttons |
| `<SearchInput>` | Search with debounce + clear button |
| `<StatusBadge>` | Colored status pill |
| `<DateRangePicker>` | Date range with FY default |
| `<PaginationBar>` | Prev/next + page numbers |
| `<DeleteConfirmDialog>` | Destructive confirmation modal |
| `<PageSkeleton>` | Full-page loading skeleton |
| `<EmptyState>` | Empty table state with icon |
| `<DataCard>` | White card wrapper for tables |
| `<TableActions>` | View/Edit/Delete icon button group |

---

## How to Use This Brief

1. Paste this entire file into claude.ai as your first message
2. Upload screenshots of the specific pages you want to redesign
3. Describe your design change — Claude will have full context of the layout, components, and constraints

*Generated from live codebase — April 2026*
