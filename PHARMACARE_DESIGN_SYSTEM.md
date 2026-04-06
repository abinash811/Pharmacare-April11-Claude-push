== PHARMACARE DESIGN SYSTEM — READ BEFORE WRITING ANY CODE ==

App: PharmaCare | React + Tailwind CSS + Shadcn UI + MongoDB | Single Indian pharmacy

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

## Semantic Colors
- Success/Paid/Cash: `bg-green-100 text-green-700`
- Error/Due/Cancelled: `bg-red-100 text-red-700`
- Warning/Parked/Pending: `bg-amber-100 text-amber-700`
- Info/UPI: `bg-blue-100 text-blue-700`
- Credit/Card: `bg-purple-100 text-purple-700`

## Action Icons
- View: `text-blue-600` on `hover:bg-blue-50`
- Edit: `text-gray-600` on `hover:bg-gray-100`
- Delete: `text-red-600` on `hover:bg-red-50`

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
  DateRangePicker 
} from '@/components/shared';
```

## Components

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Title + subtitle + action buttons |
| `DataCard` | White card wrapper for tables |
| `TableActions` | View/Edit/Delete icon buttons |
| `SearchInput` | Search with icon |
| `StatusBadge` | Colored status pills |
| `DateRangePicker` | Date range with FY default |

---

# PAGE LAYOUT PATTERN

```
┌─────────────────────────────────────────┐
│ PageHeader (title + subtitle)           │
├─────────────────────────────────────────┤
│ Tabs | Search                           │
├─────────────────────────────────────────┤
│ Action buttons (Export | Add)           │
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
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

---

# BUTTON STYLES

| Type | Component |
|------|-----------|
| Primary | `<Button>` (Shadcn default) |
| Secondary | `<Button variant="outline">` |
| Ghost | `<Button variant="ghost" size="sm">` |
| Icon only | `<Button variant="ghost" size="sm" className="p-1.5 h-auto">` |

---

# STATUS BADGE MAPPINGS

| Status | Style |
|--------|-------|
| paid, cash, active, completed, confirmed | Green |
| due, unpaid, overdue, cancelled, inactive | Red |
| partial, parked, pending, draft | Amber |
| upi | Blue |
| credit, card, adjusted | Purple |
| regular (customer) | Blue |
| wholesale (customer) | Purple |
| institution (customer) | Green |

---

# INDIAN FINANCIAL YEAR

Default date range: 01 April to 31 March
- If month >= April (3): FY starts current year
- If month < April (0-2): FY started previous year

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
import { Plus, Eye, Edit, Trash2, Search, FileSpreadsheet } from 'lucide-react';

// Toast
import { toast } from 'sonner';
```

---

# SIDEBAR NAVIGATION ORDER

Dashboard → Billing → Inventory → Purchases → Customers → Suppliers → Reports → GST Report → Settings → Users → Roles

---

== END OF DESIGN SYSTEM ==
