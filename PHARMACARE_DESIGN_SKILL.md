# PHARMACARE DESIGN SKILL
# ⚠️  READ THIS ENTIRE FILE BEFORE TOUCHING ANY UI FILE — NO EXCEPTIONS ⚠️
# This file supersedes both PHARMACARE_DESIGN_SYSTEM.md and ~/skills/user/pharmacare-design/SKILL.md

App: PharmaCare | React + Tailwind CSS + Shadcn UI | Single Indian pharmacy

---

## COMPONENT LIBRARY

- **Shadcn/UI exclusively**
- Never Ant Design, Never MUI, Never any other component library
- If Shadcn doesn't have it, build custom following Shadcn patterns using the same tokens

---

## COLORS

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#4682B4` | Actions and active states ONLY |
| Sidebar bg | `#1a2332` | Dark Navy |
| Page background | `#f8f9fa` | Page canvas |
| Surface | `#ffffff` | Cards, tables, modals |
| Border | `#e5e7eb` | All borders |
| Text Primary | `#111827` | Main text |
| Text Secondary | `#374151` | Supporting text |
| Text Muted | `#6b7280` | Helper text, icons |
| Text Disabled | `#9ca3af` | Disabled state |
| Hover Row | `#f0f7ff` | Tables only |
| Focus Ring | `#4682B4` | Focus states |
| Primary Hover | `#3a6fa0` | Button hover |
| Primary Active | `#2d5a8a` | Button active/pressed |

### Semantic Colors — MUTED ONLY (bg-X-50, never bg-X-100)

| State | Background | Text | Border |
|-------|-----------|------|--------|
| Success | `bg-green-50` | `text-green-700` | `border-green-200` |
| Warning | `bg-amber-50` | `text-amber-700` | `border-amber-200` |
| Error | `bg-red-50` | `text-red-700` | `border-red-200` |
| Info | `bg-blue-50` | `text-blue-700` | `border-blue-200` |

### COLOR RULES — NON-NEGOTIABLE

1. Steel Blue `#4682B4` appears **ONLY** on primary buttons, active sidebar item, links, focus rings
2. **NO bright colors anywhere** — all semantic colors are muted (`bg-X-50 text-X-700`)
3. **Maximum ONE primary button per page**
4. No color on page backgrounds, table rows, or headers
5. Icons are always `text-gray-400` (`#6b7280`) unless inside a colored badge or action button

### BANNED COLORS — Never use anywhere

- `bg-teal-500`, `bg-teal-600`, `text-teal-500`, `text-teal-600`, any teal variant
- `#13ecda`, `#00CED1`, `#00B5B8` or any bright cyan/teal hex
- `bg-blue-600` as a standalone background (only `bg-blue-600/20` opacity variant is allowed in sidebar)
- `bg-X-100` semantic shades — use `bg-X-50` always

---

## TYPOGRAPHY

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Page Title | 24px (`text-2xl`) | `font-semibold` | `text-gray-900` |
| Page Subtitle | 14px (`text-sm`) | `font-normal` | `text-gray-500` |
| Section Title | 18px (`text-lg`) | `font-semibold` | `text-gray-900` |
| Table Header | 11px (`text-[11px]`) | `font-medium` | `text-gray-500 uppercase tracking-wider` |
| Table Body Primary | 14px (`text-sm`) | `font-medium` | `text-gray-900` |
| Table Body Secondary | 13px (`text-xs`) | `font-normal` | `text-gray-500` |
| Button | 14px (`text-sm`) | `font-semibold` | — |
| Badge | 12px (`text-xs`) | `font-medium` | — |
| Caption | 12px (`text-xs`) | `font-normal` | `text-gray-500` |
| Amount/Number | 14px (`text-sm`) | `font-semibold` | `text-gray-900 tabular-nums` |
| Batch Number | any | `font-mono` | `text-gray-700` |

---

## SPACING

| Context | Value |
|---------|-------|
| Page padding | `px-8 py-6` |
| Card padding | `p-6` |
| Table cell | `px-4 py-3` |
| Table row height | `h-10` (40px — Zoho density) |
| Filter bar gap | `gap-3` |
| Button gap | `gap-2` |
| Section gap | `gap-6` |
| Modal padding | `p-6` |

---

## SIDEBAR — EXACT SPECIFICATION

| Property | Value |
|----------|-------|
| Width | `200px` fixed (`w-[200px]`) |
| Background | `#1a2332` |
| Text inactive | `text-gray-300` |
| Active item | `bg-blue-600/20 text-white` |
| Hover | `bg-white/5 hover:text-white` |
| Icon size | `w-4 h-4` (16px) |
| Item height | `h-9` (36px) |
| Item padding | `px-3` |
| Font size | `text-[13px] font-medium` |
| Section label | `text-[10px] font-medium uppercase tracking-widest text-gray-500 px-3 mt-4 mb-1` |

### Nav Groups (exact order)

```
DAILY OPS     → Dashboard, Billing, Inventory, Purchases
RELATIONSHIPS → Customers, Suppliers
REPORTS       → Reports, GST Report, Stock Log
COMPLIANCE    → Sch H1 Register, Audit Log
ADMIN         → Settings, Team
```

- Bottom strip: user avatar + name + role badge + Logout button
- Role badges: Admin `bg-purple-100 text-purple-700` · Manager `bg-blue-100 text-blue-700` · Cashier `bg-green-100 text-green-700` · Inventory `bg-orange-100 text-orange-700`

---

## PAGE LAYOUT — IDENTICAL ACROSS ALL PAGES

```
┌──────────────────────────────────────────────────────────────┐
│ [Page Title]              [Secondary CTA] [+ Primary CTA]    │
│ [X items total / subtitle]                                   │
├──────────────────────────────────────────────────────────────┤
│ [Search input]  [Filter chips]  [Date range if needed]       │
├──────────────────────────────────────────────────────────────┤
│ TABLE                                                        │
│ COL HEADER  COL HEADER  COL HEADER             ACTIONS       │
│ row data    row data    row data                👁  ✏  🗑    │
│ row data    row data    row data                👁  ✏  🗑    │
├──────────────────────────────────────────────────────────────┤
│ Showing 1–40 of 123                   [< 1 2 3 ... >]        │
└──────────────────────────────────────────────────────────────┘
```

---

## BUTTONS

### Primary
```
bg-[#4682B4] text-white h-10 px-4 rounded-lg text-sm font-semibold
hover:bg-[#3a6fa0] active:bg-[#2d5a8a] disabled:opacity-50
Label examples: "+ New Bill", "+ New Purchase", "+ Add Product"
```

### Secondary
```
bg-white border border-[#4682B4] text-[#4682B4] h-10 px-4 rounded-lg text-sm font-semibold
hover:bg-blue-50
```

### Destructive
```
bg-red-600 text-white h-10 px-4 rounded-lg text-sm font-semibold
hover:bg-red-700
```

### Ghost
```
bg-transparent text-gray-600 h-10 px-4 rounded-lg text-sm font-medium
hover:bg-gray-100
```

### Icon Button (table actions only)
```
h-8 w-8 rounded-md flex items-center justify-center
text-gray-400 hover:text-gray-600 hover:bg-gray-100
```

### Action Icon Colors
- View: `text-gray-400 hover:text-[#4682B4] hover:bg-blue-50`
- Edit: `text-gray-400 hover:text-gray-700 hover:bg-gray-100`
- Delete: `text-gray-400 hover:text-red-600 hover:bg-red-50`
- Print: `text-gray-400 hover:text-gray-600 hover:bg-gray-100`
- WhatsApp: `text-gray-400 hover:text-green-600 hover:bg-green-50`

### States
- **Disabled**: `opacity-50 cursor-not-allowed`
- **Loading**: Spinner icon + "Saving…" text + disabled

---

## TABLES

```
Container:  bg-white rounded-xl border border-gray-200 overflow-hidden
Header row: bg-gray-50 border-b border-gray-200
Header th:  text-[11px] font-medium text-gray-500 uppercase tracking-wider | px-4 py-3
Data rows:  h-10 border-b border-gray-100 last:border-0 | hover:bg-[#f0f7ff]
            Add `group` class to <tr> for hover-only action visibility
```

| Cell type | Class |
|-----------|-------|
| Primary text | `text-sm font-medium text-gray-900` |
| Secondary text | `text-xs text-gray-500` (below primary, same cell) |
| Amount | `text-sm font-semibold text-gray-900 text-right tabular-nums` |
| Batch number | `text-sm font-mono text-gray-700` |
| Actions | `text-right` — `opacity-0 group-hover:opacity-100 transition-opacity` |

- Sticky header always
- Empty state required for every table (see Empty States section)

### Table JSX Pattern

```jsx
<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Column
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="group h-10 border-b border-gray-100 last:border-0 hover:bg-[#f0f7ff]">
          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">Content</td>
          <td className="px-4 py-2.5 text-right">
            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* icon buttons */}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## SHARED COMPONENTS

All shared components live in `frontend/src/components/shared/`

### Import
```javascript
import {
  PageHeader,
  DataCard,
  TableActions,
  SearchInput,
  StatusBadge,
  CustomerTypeBadge,
  PaymentStatusBadge,
  DateRangePicker,
  getFinancialYearRange,
  InlineLoader,
  ConfirmDialog,
  DeleteConfirmDialog,
  PaginationBar,
  PageSkeleton,
  EmptyState,
} from '@/components/shared';
```

### Component Reference

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `PageHeader` | Title + subtitle + action buttons | `title`, `subtitle`, `actions`, `className` |
| `DataCard` | White card wrapper for tables | `children`, `noPadding` (default: true), `className` |
| `TableActions` | View/Edit/Delete icon buttons | `onView`, `onEdit`, `onDelete`, `className` |
| `SearchInput` | Search with magnifier icon | `value`, `onChange` (receives string), `placeholder`, `className` |
| `StatusBadge` | Colored status pills | `status`, `label`, `fallback`, `className` |
| `CustomerTypeBadge` | Customer type badge | `type` (defaults to "Regular") |
| `PaymentStatusBadge` | Payment status badge | `status`, `paymentMethod` |
| `DateRangePicker` | Date range with FY default | `dateRange`, `onDateRangeChange`, `className` |
| `getFinancialYearRange` | Returns current FY `{ start, end }` | utility function |
| `InlineLoader` | Inline spinner with text | `text` |
| `ConfirmDialog` | Generic confirm | `open`, `onClose`, `onConfirm`, `title`, `description`, `confirmLabel`, `isDestructive`, `isLoading` |
| `DeleteConfirmDialog` | Delete confirm variant | `open`, `onClose`, `onConfirm`, `itemName`, `isLoading` |
| `PaginationBar` | Pagination row | spread `{...pg}` from `usePagination` |
| `PageSkeleton` | Full-page loading skeleton | none |
| `EmptyState` | Empty table state | `icon`, `title`, `description`, `action` |

---

## STATUS BADGE MAPPINGS

| Status value(s) | Color | Label shown |
|----------------|-------|-------------|
| `paid`, `cash`, `active`, `completed`, `confirmed` | Green (`bg-green-50 text-green-700`) | Paid / Active / etc. |
| `due`, `unpaid` | Amber (`bg-amber-50 text-amber-700`) | Due / Unpaid |
| `overdue`, `cancelled`, `inactive`, `returned` | Red (`bg-red-50 text-red-700`) | Overdue / Cancelled / etc. |
| `partial`, `parked`, `pending`, `draft` | Amber (`bg-amber-50 text-amber-700`) | Partial / Parked / etc. |
| `upi` | Blue (`bg-blue-50 text-blue-700`) | UPI |
| `credit`, `card`, `adjusted`, `credit_to_account` | Purple (`bg-purple-50 text-purple-700`) | Credit / Card / etc. |
| `same_as_original` | Gray (`bg-gray-100 text-gray-600`) | Same as Original |
| `regular` (customer) | Blue (`bg-blue-50 text-blue-700`) | Regular |
| `wholesale` (customer) | Purple (`bg-purple-50 text-purple-700`) | Wholesale |
| `institution` (customer) | Green (`bg-green-50 text-green-700`) | Institution |

### Label Auto-Formatting
`StatusBadge` converts snake_case to readable labels:

| Database value | Displayed as |
|----------------|-------------|
| `same_as_original` | "Same as Original" |
| `credit_to_account` | "Credit to Account" |
| `adjust_outstanding` | "Adjusted" |

---

## BADGES — SIZE & SHAPE

```
text-xs font-medium px-2 py-0.5 rounded-full
```

| Badge | Class |
|-------|-------|
| Cash / Active | `bg-green-50 text-green-700 border border-green-200` |
| UPI / Info | `bg-blue-50 text-blue-700 border border-blue-200` |
| Due / Warning | `bg-amber-50 text-amber-700 border border-amber-200` |
| Parked / Neutral | `bg-gray-100 text-gray-600 border border-gray-200` |
| Returned / Error | `bg-red-50 text-red-700 border border-red-200` |
| Low Stock | `bg-amber-50 text-amber-700` |
| Expired | `bg-red-50 text-red-700` |
| Schedule H | `bg-amber-50 text-amber-700` |
| Schedule X | `bg-red-50 text-red-700` |

---

## EMPTY STATES

```
Container: py-16 flex flex-col items-center justify-center text-center
Icon:      w-12 h-12 text-gray-300 mx-auto mb-3
Title:     text-sm font-medium text-gray-900
Subtitle:  text-sm text-gray-500 mt-1
CTA:       Primary button if creation is possible
           No CTA if it is a filtered/search empty state
```

---

## MODALS

```
Overlay:    bg-black/40 backdrop-blur-sm
Container:  bg-white rounded-xl shadow-lg
```

| Size | Width | Use |
|------|-------|-----|
| Small | `max-w-sm` | Confirmations, simple warnings |
| Medium | `max-w-lg` | Standard forms |
| Large | `max-w-3xl` | Complex workflows, permissions matrix |

```
Header: px-6 py-4 border-b border-gray-100
        Title: text-base font-semibold text-gray-900
        X close button: top-right ghost icon button
Body:   px-6 py-4
Footer: px-6 py-4 border-t border-gray-100 flex justify-end gap-2
        [Cancel — ghost button] [Primary action — bg-[#4682B4] button]
```

### Modal JSX Pattern

```jsx
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
      {/* fields */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose}
          className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit"
          className="h-10 px-4 rounded-lg bg-[#4682B4] text-white text-sm font-semibold hover:bg-[#3a6fa0]">
          Save
        </button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

---

## FORM INPUTS

```
Input:    h-10 px-3 rounded-lg border border-gray-300 text-sm
          focus:border-[#4682B4] focus:ring-1 focus:ring-[#4682B4] focus:outline-none
          placeholder:text-gray-400
Label:    text-xs font-medium text-gray-700 mb-1 (block)
Error:    text-xs text-red-600 mt-1
Helper:   text-xs text-gray-500 mt-1
Select:   Same as Input + ChevronDown icon
Textarea: Same border/focus as Input, resize-none
Search:   Same as Input + Search icon on left
```

---

## TOASTS

```
Library:  sonner  (<Toaster position="top-right" richColors />)
Duration: 3s auto-dismiss — errors stay until dismissed
```

Always show a toast for every async action — both success and error.

---

## LOADING STATES

- **Table**: 3 animated skeleton rows matching column widths — **never** a spinner
- **Button**: Spinner icon + "Saving…" / "Loading…" text + `disabled`
- **Page**: `<PageSkeleton />` — **never** a blank white screen

---

## SPECIAL ACTIONS

### WhatsApp Send (Billing list)

```jsx
const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
             -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075
             -.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059
             -.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52
             .149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52
             -.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51
             -.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372
             -.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074
             .149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625
             .712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413
             .248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.849L.057 24l6.304-1.654
             A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882
             a9.878 9.878 0 01-5.034-1.378l-.361-.214-3.741.981.998-3.648-.235-.374
             A9.878 9.878 0 012.118 12C2.118 6.533 6.533 2.118 12 2.118
             S21.882 6.533 21.882 12 17.467 21.882 12 21.882z"/>
  </svg>
);

// In table actions:
<button className="h-8 w-8 rounded-md flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Send via WhatsApp">
  <WhatsAppIcon className="w-4 h-4" />
</button>
```

---

## INDIAN FINANCIAL YEAR

Default date range: 1 April → 31 March

```javascript
import { getFinancialYearRange } from '@/components/shared';
const { start, end } = getFinancialYearRange();
// start = 1 Apr of current FY, end = 31 Mar of next FY
```

Logic: if `month >= 3` (April+) → FY starts this calendar year; else → FY started last calendar year.

---

## NUMBER & CURRENCY FORMATTING

Always use Indian locale:

```javascript
// Display
`₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
// → ₹1,23,456.00

// In JSX table cells:
<td className="px-4 py-2.5 text-sm font-semibold text-right tabular-nums text-gray-900">
  ₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
</td>
```

- Always `₹` prefix
- Right-aligned in tables
- `tabular-nums` and `font-semibold` always
- Never show `NaN` — use `|| 0` fallback

---

## PHARMACY-SPECIFIC RULES

1. **Rupee amounts** — `₹` prefix, right-aligned, `tabular-nums`, `font-semibold`
2. **Expiry dates** — Red (`text-red-600`) if expired; Amber (`text-amber-600`) if expiring within 90 days
3. **Batch numbers** — Always `font-mono`
4. **GST breakup** — Always show CGST + SGST separately, never combined
5. **Drug schedules** — Schedule H → amber badge; Schedule X → red badge
6. **Stock quantity** — Always show unit (tablets, strips, bottles)
7. **Bill numbers** — `font-mono`, `text-[#4682B4]` link color, always clickable/navigable

---

## SETTINGS PAGE — 3 TABS (single page)

1. **Pharmacy Profile** — name, address, GSTIN, drug license number
2. **Billing Config** — bill sequence, invoice prefix, draft bills, auto-print, returns policy
3. **Preferences** — currency, timezone, expiry alert threshold, low stock alerts

---

## TEAM PAGE — 2 TABS (merged, single page)

Replaces the separate `/users` and `/roles` pages. Both legacy routes still work.

1. **Members** — user list, invite, edit, deactivate/activate
2. **Roles** — roles list with permissions matrix

---

## REQUIRED IMPORTS — LIST PAGES

```javascript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { toast } from 'sonner';

// Shadcn UI
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Shared
import {
  PageHeader, DataCard, SearchInput, StatusBadge,
  DateRangePicker, PaginationBar, DeleteConfirmDialog, InlineLoader,
} from '@/components/shared';
import { useDebounce } from '@/hooks/useDebounce';
import usePagination from '@/hooks/usePagination';

// Icons
import { Plus, Eye, Edit, Trash2, FileSpreadsheet, Printer } from 'lucide-react';
```

---

## GLOBAL RULES

1. App name is **PharmaCare** — never rename it
2. Do NOT refactor `server.py` / `main.py` into routers unless explicitly asked
3. Do NOT delete or deprecate existing working pages without explicit instruction
4. No hardcoded or dummy data anywhere — all data comes from API
5. Never show `NaN` — always handle null/undefined with `|| 0` or `|| '—'` fallbacks
6. Do NOT add new npm libraries without explicit approval
7. Always use `api` from `@/lib/axios` — never raw `axios` for authenticated calls
8. All pages must follow the identical layout pattern (see Page Layout section)

---

## INTERACTIONS & TRANSITIONS

- All color/bg transitions: `transition-colors duration-150`
- Sidebar item transition: `transition-all duration-150`
- Button hover: immediate — no delay (`duration-150`)
- Card hover shadow: `hover:shadow-md transition-shadow duration-150`
- Links: `text-[#4682B4] hover:underline`
- Modal open: fade in `duration-200`
- Toast slide-in: from right `duration-300`
- Table row hover: `transition-colors duration-100`

---

## EMPTY STATE — JSX PATTERN

```jsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
    <IconName className="w-6 h-6 text-gray-300" />
  </div>
  <p className="text-sm font-medium text-gray-900 mb-1">No bills found</p>
  <p className="text-xs text-gray-500 mb-4">Try adjusting your search or filters</p>
  {/* Only show CTA if user can create AND this is NOT a filtered empty state */}
  <Button className="h-10 px-4 bg-[#4682B4] text-white text-sm font-semibold rounded-lg hover:bg-[#3a6fa0]">
    + New Bill
  </Button>
</div>
```

**Rules:**
- Show CTA only when the list is empty and user has create permission
- No CTA for filtered/search empty states — show "Try adjusting your search" instead
- Icon goes inside a `bg-gray-100` rounded circle, always `text-gray-300`

---

## DATE RANGE PICKER — COMPACT DROPDOWN

**Trigger button** (always a single compact button):
```
h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50
```
Display: calendar icon + date range text + ChevronDown icon

**When active/custom range selected:**
```
border-[#4682B4] text-[#4682B4]
```

**Dropdown layout** (opens below button, not a giant overlay):
1. Preset list first — each item is a full-width clickable row:
   - Today
   - This Week
   - This Month
   - Last Month
   - This Financial Year ← default selection on page load
   - All Time
   - Custom…
2. Selecting "Custom" expands a compact two-month calendar below the preset list
3. All other presets close the dropdown immediately on click

**Preset item style:**
```
px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer
Active/selected: bg-[#4682B4]/10 text-[#4682B4] font-medium
```

Use `getFinancialYearRange()` from `@/components/shared` for "This Financial Year" default.

---

## FILTER CHIPS

Used for status/type filters above tables (e.g. All / Cash / UPI / Due / Parked).

```jsx
{/* Inactive chip */}
<button className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
  Cash
</button>

{/* Active chip */}
<button className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white transition-all">
  Cash
</button>
```

**Chip bar layout:**
```jsx
<div className="flex items-center gap-1">
  {['all', 'cash', 'upi', 'due', 'parked'].map(f => (
    <button
      key={f}
      onClick={() => setActiveFilter(f)}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
        activeFilter === f
          ? 'bg-gray-900 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
    </button>
  ))}
</div>
```

---

## PAGE HEADER — JSX PATTERN

Every listing page must use this exact structure:

```jsx
<div className="flex items-start justify-between mb-6">
  <div>
    <h1 className="text-2xl font-semibold text-gray-900">Page Title</h1>
    <p className="text-sm text-gray-500 mt-0.5">123 items total</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Secondary CTA — outline style */}
    <button className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
      <FileSpreadsheet className="w-4 h-4 text-gray-500" />
      Export Excel
    </button>
    {/* Primary CTA — ONE per page max */}
    <button className="h-10 px-4 rounded-lg bg-[#4682B4] text-white text-sm font-semibold hover:bg-[#3a6fa0] transition-colors flex items-center gap-2">
      <Plus className="w-4 h-4" />
      New Bill
    </button>
  </div>
</div>
```

**Rules:**
- Title always `text-2xl font-semibold text-gray-900`
- Subtitle always `text-sm text-gray-500 mt-0.5` — show live count when available
- Maximum ONE primary (blue) button in the header
- Secondary buttons use `border border-gray-300 text-gray-700 hover:bg-gray-50`

---

## SKELETON LOADING — JSX PATTERN

Use inside `<tbody>` when `loading === true`. Always 3–5 rows matching the column count of the table.

```jsx
{loading ? (
  Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="h-10 border-b border-gray-100">
      <td className="px-4 py-2.5">
        <div className="h-4 bg-gray-100 rounded animate-pulse w-32" />
      </td>
      <td className="px-4 py-2.5">
        <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
      </td>
      <td className="px-4 py-2.5">
        <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="h-4 bg-gray-100 rounded animate-pulse w-16 ml-auto" />
      </td>
    </tr>
  ))
) : (
  /* actual rows */
)}
```

**Rules:**
- Skeleton widths should approximate real content widths (`w-32`, `w-24`, `w-20`, etc.)
- Never use a spinner in place of a table skeleton
- Amount columns: skeleton is right-aligned (`ml-auto`)
- Use `<PageSkeleton />` for full-page loads (before any data arrives), table skeleton for in-table refreshes

---

## TEXT TRUNCATION

| Cell type | Max width | Truncate? | Tooltip |
|-----------|-----------|-----------|---------|
| Customer/supplier name | `max-w-[200px]` | Yes | `title={fullName}` |
| Address / notes | `max-w-[200px]` | Yes | `title={fullText}` |
| Email | `max-w-[160px]` | Yes | `title={email}` |
| Medicine name | `max-w-[220px]` | Yes | `title={name}` |
| Bill number | Never truncate | No | — |
| Phone number | Never truncate | No | — |
| Amount / date | Never truncate | No | — |
| Batch number | Never truncate | No | — |

```jsx
{/* Truncation pattern */}
<div className="max-w-[200px] truncate text-sm font-medium text-gray-900" title={customer.name}>
  {customer.name}
</div>
```

---

## DELETE CONFIRMATION DIALOG — PATTERN

Always use `<DeleteConfirmDialog>` from `@/components/shared`. **Never use `window.confirm()`.**

```jsx
{/* In state */}
const [delState, setDelState] = useState({ open: false, item: null, loading: false });

{/* Open it */}
onDelete={(item) => setDelState({ open: true, item, loading: false })}

{/* Confirm handler */}
const handleConfirmDelete = async () => {
  setDelState(p => ({ ...p, loading: true }));
  const ok = await deleteItem(delState.item.id);
  setDelState({ open: !ok, item: ok ? null : delState.item, loading: false });
};

{/* Dialog */}
<DeleteConfirmDialog
  open={delState.open}
  onClose={() => setDelState({ open: false, item: null, loading: false })}
  onConfirm={handleConfirmDelete}
  itemName={delState.item?.name ? `bill "${delState.item.name}"` : 'this bill'}
  isLoading={delState.loading}
/>
```

**Visual spec (for reference — already implemented in shared component):**
- Size: `max-w-sm`
- Title: `Delete [Item Name]?`
- Body: `This action cannot be undone.`
- Footer: Ghost `Cancel` + Destructive red `Delete` button
- Shows spinner on Delete button while `isLoading`

---

## SCREEN SIZES & RESPONSIVE BEHAVIOUR

| Breakpoint | Width | Behaviour |
|------------|-------|-----------|
| Minimum supported | 1280px | All columns visible, sidebar always shown |
| Optimal | 1440px | Standard layout |
| Wide | 1920px | Content area expands, sidebar stays `w-[200px]` |
| Tablet (below 1024px) | — | Not officially supported — degrade gracefully |
| Mobile (below 768px) | — | Sidebar becomes a drawer, hamburger menu shown |

**Column visibility rules:**
- Below 1280px: hide secondary/optional columns (e.g. GSTIN, email, clinic address)
- Use Tailwind `hidden xl:table-cell` for columns that should hide at 1280px
- Primary columns (name, amount, status, actions) always visible

**Sidebar on desktop:** Always visible, never auto-collapses. Fixed `w-[200px]`.

---

## TAB COMPONENT — EXACT SPEC

Two tab styles exist: **Underline tabs** (page-level) and **Shadcn Tabs** (within a page section).

### Underline Tabs (page-level — Customers, Settings, Team)

```jsx
{/* Tab bar */}
<div className="border-b border-gray-200 flex gap-6 mb-6">
  {tabs.map(tab => (
    <button
      key={tab.key}
      onClick={() => setActive(tab.key)}
      className={active === tab.key
        ? 'border-b-2 border-[#4682B4] text-[#4682B4] font-medium text-sm pb-2 px-1 -mb-px'
        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm pb-2 px-1 -mb-px transition-colors duration-150'
      }
    >
      {tab.label}
      {tab.count !== undefined && (
        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
          active === tab.key ? 'bg-[#4682B4]/10 text-[#4682B4]' : 'bg-gray-100 text-gray-500'
        }`}>
          {tab.count}
        </span>
      )}
    </button>
  ))}
</div>
```

### Shadcn Tabs (within-section — Team sub-tabs)

```jsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="mb-6">
    <TabsTrigger value="members">Members</TabsTrigger>
    <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
  </TabsList>
  <TabsContent value="members" forceMount className={activeTab !== 'members' ? 'hidden' : ''}>
    {/* content */}
  </TabsContent>
</Tabs>
```

Use `forceMount` + conditional `hidden` class to prevent unmount/remount on tab switch (preserves scroll position and form state).

---

## SEARCH INPUT BEHAVIOUR

- **Debounce:** Always 300ms — use `useDebounce` hook from `@/hooks/useDebounce`
- **Clear button:** Show `×` icon button on the right when input has a value; clears on click
- **Loading indicator:** Show a subtle spinner on the right side while an API call is in flight (only for server-side search; client-side filter needs no spinner)
- **Placeholder:** Always describe the searchable fields — e.g. `"Search by name, phone…"` not just `"Search…"`
- **Keyboard:** `Escape` clears the input

```jsx
{/* Standard usage */}
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 300);

<SearchInput
  value={query}
  onChange={setQuery}
  placeholder="Search by name, phone…"
  className="w-64"
/>
```

The `SearchInput` shared component handles the clear button and magnifier icon internally. Pass `isLoading` prop if the search triggers an API call.

---

## RULES — MUST FOLLOW BEFORE TOUCHING ANY UI FILE

1. Read this file in full before writing a single line of UI code
2. Never use Ant Design, MUI, Bootstrap, or any library other than Shadcn
3. Maximum **ONE** primary (`bg-[#4682B4]`) button per page
4. Never use bright colors — only muted semantic variants (`bg-X-50 text-X-700`)
5. Every page follows the identical header → filter bar → table → pagination layout
6. Steel Blue `#4682B4` is used **only** for: primary buttons, active sidebar, bill/purchase number links, focus rings
7. Table rows are always `h-10` (40px Zoho density)
8. Table actions are icon buttons, visible **on row hover only** (`opacity-0 group-hover:opacity-100`)
9. Every table must have an empty state component
10. Every form must show a loading/disabled state on submit
11. Show a toast for every async action — both success and error
12. Never hardcode color values — always use the tokens defined in this file
13. Settings is one tabbed page — never split into separate routes
14. Team is one tabbed page — Users and Roles are always merged
15. Batch numbers always use `font-mono`
16. Rupee amounts always use `tabular-nums font-semibold` and right-align in tables

---

## WORKFLOW CHECKLIST

### Before writing any code
- [ ] Read this entire file
- [ ] Check if a shared component already exists for what you need
- [ ] Confirm the page layout matches the spec above

### After writing code
- [ ] List every file changed
- [ ] List every file deliberately NOT touched
- [ ] Confirm zero existing functionality is broken
- [ ] Confirm no banned colors were introduced
- [ ] Confirm no new libraries were added

---

*This file supersedes PHARMACARE_DESIGN_SYSTEM.md and ~/skills/user/pharmacare-design/SKILL.md.*
*Last updated: April 2026*
