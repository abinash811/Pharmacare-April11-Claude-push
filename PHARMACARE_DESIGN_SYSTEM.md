== PHARMACARE DESIGN SYSTEM — READ BEFORE WRITING ANY CODE ==

App: PharmaCare | React + Tailwind CSS + Shadcn UI + MongoDB | Single Indian pharmacy

---

# PRIMARY COLOR STANDARD

**PRIMARY COLOR: Steel Blue**
| Property | Value |
|----------|-------|
| Hex | `#4682B4` |
| HSL | `207 44% 49%` |
| Tailwind custom | `text-[#4682B4]`, `bg-[#4682B4]` |
| Shadcn CSS variable | `--primary: 207 44% 49%` |
| Darker shade (hover) | `#3a6d96` |
| Light tint (10% opacity) | `bg-[#4682B4]/10` |

**Usage:**
- All primary action buttons (`<Button>` with `variant="default"`)
- Active sidebar navigation item (`bg-[#4682B4]`)
- Clickable table links (bill numbers, purchase numbers) (`text-[#4682B4]`)
- DateRangePicker active state
- Focus rings (`focus:ring-primary`)
- Breadcrumb hover states (`hover:text-[#4682B4]`)

**BANNED — Never use:**
- `bg-teal-500`, `bg-teal-600`, `text-teal-500`, `text-teal-600`
- `hover:bg-teal-600`, `border-teal-*`, `focus:ring-teal-*`
- Any teal color variant anywhere in the codebase

---

# DESIGN REFERENCE: CUSTOMERS PAGE

The `/app/frontend/src/pages/Customers.js` file is the official design reference. All modules must match it exactly.

---

# GLOBAL RULES

1. App name is PharmaCare. Never rename it.
2. Do NOT refactor server.py into routers.
3. Do NOT delete or deprecate existing working pages without explicit request.
4. All new pages must match the Customers page design.
5. No hardcoded or dummy data anywhere.
6. Never show NaN — handle null/undefined values with fallbacks.
7. Do NOT rewrite files — use search_replace for edits.
8. Do NOT add new libraries without explicit approval.

---

# COLOR TOKENS

## Backgrounds
- Page background: `bg-gray-50` (#f9fafb)
- Card background: `bg-white` (#ffffff)
- Table header: `bg-gray-50` (#f9fafb)
- Hover row: `hover:bg-gray-50`

## Text
- Heading: `text-gray-800` (#1f2937) — page titles, bold text
- Body: `text-gray-600` (#4b5563) — table cells, labels
- Muted: `text-gray-500` (#6b7280) — subtitles, secondary text
- Light: `text-gray-400` (#9ca3af) — icons, placeholders

## Semantic Colors (UPDATED)
- Success/Paid/Cash: `bg-green-100 text-green-700`
- Warning/Due/Unpaid: `bg-amber-100 text-amber-700` (changed from red)
- Error/Overdue/Cancelled: `bg-red-100 text-red-700`
- Pending/Parked/Draft: `bg-amber-100 text-amber-700`
- Info/UPI: `bg-blue-100 text-blue-700`
- Credit/Card: `bg-purple-100 text-purple-700`

## Action Icons
- View: `text-blue-600` on `hover:bg-blue-50`
- Edit: `text-gray-600` on `hover:bg-gray-100`
- Delete: `text-red-600` on `hover:bg-red-50`
- Print: `text-gray-600` on `hover:bg-gray-100`
- WhatsApp: `text-green-600` on `hover:bg-green-50`

## Buttons
- Primary (Add): Shadcn `<Button>` (auto uses `--primary` = Steel Blue `#4682B4`)
- Secondary: Shadcn `variant="outline"`
- Ghost: Shadcn `variant="ghost" size="sm"`
- Custom (when needed): `bg-[#4682B4] hover:bg-[#3a6d96] text-white`

---

# TYPOGRAPHY

- Font family: System default (Tailwind sans)
- Page title: `text-2xl font-bold text-gray-800`
- Subtitle: `text-sm text-gray-500`
- Table headers: `text-xs font-semibold text-gray-600 uppercase`
- Table cells: Default (text-sm inherited)
- Badge text: `text-xs font-medium`

---

# SHARED COMPONENTS

All shared components are in `/app/frontend/src/components/shared/`

## Import
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
  getFinancialYearRange
} from '@/components/shared';
```

## Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `PageHeader` | Title + subtitle + action buttons | title, subtitle, actions, className |
| `DataCard` | White card wrapper for tables | children, noPadding (default: true), className |
| `TableActions` | View/Edit/Delete icon buttons | onView, onEdit, onDelete, className |
| `SearchInput` | Search with icon | value, onChange (receives string), placeholder, className |
| `StatusBadge` | Colored status pills | status, label, fallback, className |
| `CustomerTypeBadge` | Customer type badge | type (defaults to "Regular") |
| `PaymentStatusBadge` | Payment status badge | status, paymentMethod |
| `DateRangePicker` | Date range with FY default | dateRange, onDateRangeChange, className |
| `getFinancialYearRange` | Utility function | Returns { start, end } for current FY |

---

# PAGE LAYOUT PATTERNS

## Pattern A: List Pages
```
┌─────────────────────────────────────────┐
│ PageHeader (title + subtitle + actions) │
├─────────────────────────────────────────┤
│ Filters Row                             │
│ [Search] [DatePicker] [Pills]   [Stats] │
├─────────────────────────────────────────┤
│                                         │
│  DataCard                               │
│  ┌─────────────────────────────────┐   │
│  │ Table Header (gray bg, border)   │   │
│  ├─────────────────────────────────┤   │
│  │ Row 1                            │   │
│  ├─────────────────────────────────┤   │
│  │ Row 2                            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

## Pattern B/C: Detail and Create Pages
```
┌─────────────────────────────────────────┐
│ Header Bar (white bg, border-b)         │
├─────────────────────────────────────────┤
│                                         │
│  bg-gray-50 padding                     │
│  ┌─────────────────────────────────┐   │
│  │ White card section 1             │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ White card section 2 (table)     │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│ Footer Bar (white bg, totals)           │
└─────────────────────────────────────────┘
```

---

# TABLE PATTERN

```jsx
<DataCard>
  <table className="w-full">
    <thead className="bg-gray-50 border-b">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="divide-y">
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">Content</td>
        <td className="px-4 py-3 text-right">
          <TableActions onView={} onEdit={} onDelete={} />
        </td>
      </tr>
    </tbody>
  </table>
</DataCard>
```

---

# MODAL PATTERN

```jsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Subtitle</DialogDescription>
    </DialogHeader>
    
    <form className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Fields */}
      </div>
      
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button type="submit" className="bg-teal-500 hover:bg-teal-600 text-white">Save</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

---

# BUTTON STYLES

| Type | Component |
|------|-----------|
| Primary (Add) | `<Button>` (uses `--primary` CSS var = Steel Blue) |
| Secondary | `<Button variant="outline">` |
| Ghost | `<Button variant="ghost" size="sm">` |
| Icon only | `<Button variant="ghost" size="sm" className="p-1.5 h-auto">` |
| Custom primary | `<Button className="bg-[#4682B4] hover:bg-[#3a6d96] text-white">` |

---

# STATUS BADGE MAPPINGS (CURRENT)

| Status | Style | Notes |
|--------|-------|-------|
| paid, cash, active, completed, confirmed | Green | Success |
| due, unpaid | Amber | Warning (changed from red) |
| overdue, cancelled, inactive | Red | Error |
| partial, parked, pending, draft | Amber | Pending |
| upi | Blue | Payment method |
| credit, card, adjusted, credit_to_account | Purple | Credit |
| same_as_original | Gray | Neutral |
| regular (customer) | Blue | Customer type |
| wholesale (customer) | Purple | Customer type |
| institution (customer) | Green | Customer type |

## Label Auto-Formatting
StatusBadge automatically converts database snake_case to readable labels:
| Database Value | Displayed As |
|----------------|--------------|
| `same_as_original` | "Same as Original" |
| `credit_to_account` | "Credit to Account" |
| `adjust_outstanding` | "Adjusted" |

---

# SPECIAL ACTIONS

## WhatsApp Send (Billing)
In BillingOperations.js, the third action icon is WhatsApp for sending bills:
```jsx
const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    {/* WhatsApp logo path */}
  </svg>
);

// Usage
<Button variant="ghost" size="sm" title="Send via WhatsApp">
  <WhatsAppIcon className="w-4 h-4 text-green-600" />
</Button>
```

---

# INDIAN FINANCIAL YEAR

Default date range: 01 April to 31 March
- If month >= April (3): FY starts current year
- If month < April (0-2): FY started previous year

```javascript
import { getFinancialYearRange } from '@/components/shared';

const fyRange = getFinancialYearRange();
// { start: Date, end: Date }
```

---

# NUMBER FORMATTING

Use Indian locale for currency:
```javascript
amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
// 1,23,456.00

`₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
// ₹1,23,456.00
```

---

# REQUIRED IMPORTS FOR LIST PAGES

```javascript
// React
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Shadcn UI
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Shared Components
import { PageHeader, DataCard, TableActions, SearchInput, StatusBadge, DateRangePicker } from '@/components/shared';

// Icons
import { Plus, Eye, Edit, Trash2, Search, FileSpreadsheet, Printer } from 'lucide-react';

// Toast
import { toast } from 'sonner';
```

---

# SIDEBAR NAVIGATION ORDER

Dashboard → Billing → Inventory → Purchases → Customers → Suppliers → Reports → GST Report → Settings → Users → Roles

---

# WORKFLOW CHECKLIST

## Before Coding
- [ ] Read PHARMACARE_RULES.md
- [ ] Read PHARMACARE_DESIGN_SYSTEM.md
- [ ] Check if shared component exists
- [ ] Match Customers page design

## After Coding
- [ ] List every file changed
- [ ] List every file NOT touched
- [ ] Confirm zero functionality broken
- [ ] Take screenshots for visual changes

---

== END OF DESIGN SYSTEM ==
