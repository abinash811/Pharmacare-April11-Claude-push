# PHARMACARE RULES — MASTER REFERENCE FILE
# Last updated: April 2026

## HOW TO USE THIS FILE
Read this file before writing ANY new code. The Customers page is the official design reference.

---

# 1. DESIGN REFERENCE

## The Customers Page is the Official Standard
All modules must match the Customers page design exactly. When building new features or updating existing pages, open `/app/frontend/src/pages/Customers.js` and match it pixel-for-pixel.

---

# 2. SHARED COMPONENTS

## Import Path
```javascript
import { PageHeader, DataCard, TableActions, SearchInput, StatusBadge, DateRangePicker } from '@/components/shared';
```

## Available Components

### PageHeader
```jsx
import { PageHeader } from '@/components/shared';

<PageHeader 
  title="Customers & Doctors"
  subtitle="Manage customer and referring doctor information"
  actions={<Button>Add Customer</Button>}
/>
```

### DataCard
```jsx
import { DataCard } from '@/components/shared';

<DataCard>
  <table>...</table>
</DataCard>
```

### TableActions
```jsx
import { TableActions } from '@/components/shared';

<TableActions
  onView={() => handleView(item)}
  onEdit={() => handleEdit(item)}
  onDelete={() => handleDelete(item)}
/>
// Only shows buttons for handlers that are provided
```

### SearchInput
```jsx
import { SearchInput } from '@/components/shared';

<SearchInput
  value={searchQuery}
  onChange={handleSearchChange}
  placeholder="Search..."
  className="w-64"
/>
```

### StatusBadge
```jsx
import { StatusBadge, CustomerTypeBadge, PaymentStatusBadge } from '@/components/shared';

<StatusBadge status="paid" />
<StatusBadge status="due" />
<StatusBadge status={null} fallback="Regular" />

<CustomerTypeBadge type={customer.customer_type} />
<PaymentStatusBadge status={bill.status} paymentMethod={bill.payment_method} />
```

### DateRangePicker
```jsx
import { DateRangePicker } from '@/components/shared';

<DateRangePicker
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
/>
// Defaults to Indian Financial Year (01 Apr - 31 Mar)
```

---

# 3. COLOR TOKENS

## Page Background
- Page background: `bg-gray-50` (#f9fafb)
- Card background: `bg-white` (#ffffff)

## Text Colors
- Headings: `text-gray-800` (#1f2937)
- Body text: `text-gray-600` (#4b5563)
- Muted text: `text-gray-500` (#6b7280)
- Light muted: `text-gray-400` (#9ca3af)

## Status Badge Colors
| Status | Background | Text |
|--------|------------|------|
| Paid / Cash / Active / Completed | `bg-green-100` | `text-green-700` |
| Due / Unpaid / Cancelled / Inactive | `bg-red-100` | `text-red-700` |
| Partial / Parked / Pending / Draft | `bg-amber-100` | `text-amber-700` |
| UPI | `bg-blue-100` | `text-blue-700` |
| Credit / Card / Adjusted | `bg-purple-100` | `text-purple-700` |
| Regular (customer type) | `bg-blue-100` | `text-blue-700` |
| Default/Unknown | `bg-gray-100` | `text-gray-700` |

## Action Icon Colors
- View icon: `text-blue-600` with `hover:bg-blue-50`
- Edit icon: `text-gray-600` with `hover:bg-gray-100`
- Delete icon: `text-red-600` with `hover:bg-red-50`

## Button Colors
- Primary: Shadcn default (dark background)
- Outline: Shadcn `variant="outline"`
- Primary teal (legacy): `bg-[#13ecda]` with `text-gray-900`

---

# 4. LAYOUT PATTERNS

## Page Structure
```jsx
<div className="min-h-screen bg-gray-50 p-6">
  {/* Header */}
  <PageHeader title="..." subtitle="..." actions={...} />
  
  {/* Optional Tabs/Filters */}
  <Tabs>...</Tabs>
  
  {/* Action Bar (Export, Add buttons) */}
  <div className="mb-4 flex justify-end gap-2">
    <Button variant="outline">Export Excel</Button>
    <Button>Add Item</Button>
  </div>
  
  {/* Data Table */}
  <DataCard>
    <table>...</table>
  </DataCard>
</div>
```

## Table Structure
```jsx
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
    </tr>
  </tbody>
</table>
```

## Table Header Style
- Background: `bg-gray-50`
- Border: `border-b`
- Text: `text-xs font-semibold text-gray-600 uppercase`
- Padding: `px-4 py-3`

## Table Row Style
- Dividers: `divide-y` on tbody (bottom borders only)
- Hover: `hover:bg-gray-50`
- Cell padding: `px-4 py-3`

## Empty State
```jsx
<tr>
  <td colSpan="X" className="px-6 py-12 text-center text-gray-500">
    <Icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
    <p>No items found</p>
  </td>
</tr>
```

---

# 5. MODAL/DIALOG PATTERNS

## Structure
```jsx
<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Subtitle description</DialogDescription>
    </DialogHeader>
    
    <form className="space-y-4">
      {/* Two-column grid for fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Field 1</Label>
          <Input />
        </div>
        <div>
          <Label>Field 2</Label>
          <Input />
        </div>
        {/* Full width for address/notes */}
        <div className="col-span-2">
          <Label>Address</Label>
          <Input />
        </div>
      </div>
      
      <DialogFooter>
        <Button type="button" variant="outline">Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

---

# 6. TABS PATTERN

```jsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="tab1">
  <div className="flex justify-between items-center gap-4 mb-6">
    <TabsList>
      <TabsTrigger value="tab1" className="data-[state=active]:bg-blue-50">
        <Icon className="w-4 h-4 mr-2" />
        Tab 1 ({count})
      </TabsTrigger>
      <TabsTrigger value="tab2">
        <Icon className="w-4 h-4 mr-2" />
        Tab 2 ({count})
      </TabsTrigger>
    </TabsList>
    
    <SearchInput value={search} onChange={setSearch} className="w-64" />
  </div>
  
  <TabsContent value="tab1">...</TabsContent>
  <TabsContent value="tab2">...</TabsContent>
</Tabs>
```

---

# 7. ICON RULES

## Library
Use `lucide-react` ONLY — never use another icon library.

## Common Icons
| Action | Icon | Color |
|--------|------|-------|
| Add | `Plus` | Inherits |
| Edit | `Edit` | `text-gray-600` |
| Delete | `Trash2` | `text-red-600` |
| View | `Eye` | `text-blue-600` |
| Search | `Search` | `text-gray-400` |
| Close | `X` | Inherits |
| Download/Export | `Download` or `FileSpreadsheet` | Inherits |
| Phone | `Phone` | `text-gray-600` |
| Email | `Mail` | `text-gray-500` |
| User | `User` | Inherits |

## Icon Sizes
- Inline with text: `w-4 h-4`
- Standalone: `w-5 h-5`
- Empty state: `w-12 h-12`

---

# 8. INDIAN FINANCIAL YEAR

## Date Range Default
All date pickers default to Indian Financial Year: 01 April to 31 March

## Dynamic Calculation
```javascript
const getFinancialYearRange = () => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // FY starts in April (month 3)
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  
  const start = new Date(fyStartYear, 3, 1); // 01 April
  const end = new Date(fyStartYear + 1, 2, 31); // 31 March
  
  return { start, end };
};
```

---

# 9. FORM RULES

- Required fields: Mark with `*` in label
- Labels: Use Shadcn `<Label>` component
- Inputs: Use Shadcn `<Input>` component
- Layout: Two-column grid (`grid grid-cols-2 gap-4`)
- Full-width fields: Use `col-span-2`
- Currency: Show `₹` prefix, 2 decimal places
- Phone: 10 digits max
- GSTIN: 15 characters, uppercase

---

# 10. TOAST MESSAGES

## Library
Use `sonner` for toasts.

## Patterns
```javascript
toast.success('Customer added successfully');
toast.success('Data exported to Excel');
toast.error('Failed to load data');
toast.error(error.response?.data?.detail || 'Failed to save');
```

## Rules
- Success: `[Entity] [action] successfully`
- Error: Show actual error, fallback to generic
- Never show toasts for background operations

---

# 11. NON-NEGOTIABLE RULES

1. **Customers page is the reference** — all pages must match it exactly
2. **Use shared components** — never duplicate component code
3. **Never show NaN** — handle null/undefined values gracefully
4. **Use Shadcn UI** — Button, Input, Card, Dialog, Tabs from `@/components/ui`
5. **Use lucide-react** — for all icons
6. **Use sonner** — for all toasts
7. **Gray-50 background** — page background is always `bg-gray-50`
8. **White cards** — tables/content go in white cards
9. **Uppercase table headers** — `text-xs font-semibold text-gray-600 uppercase`
10. **Indian Financial Year** — default date ranges

---

# 12. FILE STRUCTURE

```
/app/frontend/src/
├── components/
│   ├── ui/              # Shadcn components (DO NOT MODIFY)
│   └── shared/          # PharmaCare shared components
│       ├── index.js
│       ├── DateRangePicker.jsx
│       ├── PageHeader.jsx
│       ├── DataCard.jsx
│       ├── TableActions.jsx
│       ├── SearchInput.jsx
│       └── StatusBadge.jsx
├── pages/
│   ├── Customers.js     # DESIGN REFERENCE
│   └── ...
└── utils/
    └── cache.js
```

---

# END OF RULES FILE
