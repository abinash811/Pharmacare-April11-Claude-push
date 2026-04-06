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

## Available Components

### PageHeader
```jsx
import { PageHeader } from '@/components/shared';

<PageHeader 
  title="Customers & Doctors"
  subtitle="Manage customer and referring doctor information"
  actions={<Button>Add Customer</Button>}
  className=""  // optional
/>
```
**Props:**
- `title` (string, required) - Main page title
- `subtitle` (string, optional) - Muted subtitle text  
- `actions` (ReactNode, optional) - Action buttons for right side
- `className` (string, optional) - Additional CSS classes

### DataCard
```jsx
import { DataCard } from '@/components/shared';

<DataCard noPadding={true} className="">
  <table>...</table>
</DataCard>
```
**Props:**
- `children` (ReactNode, required) - Card content
- `noPadding` (boolean, default: `true`) - Remove padding for tables
- `className` (string, optional) - Additional CSS classes

### TableActions
```jsx
import { TableActions } from '@/components/shared';

<TableActions
  onView={() => handleView(item)}
  onEdit={() => handleEdit(item)}
  onDelete={() => handleDelete(item)}
  className=""
/>
// Only shows buttons for handlers that are provided
```
**Props:**
- `onView` (function, optional) - View handler → Eye icon (blue)
- `onEdit` (function, optional) - Edit handler → Edit icon (gray)
- `onDelete` (function, optional) - Delete handler → Trash2 icon (red)
- `className` (string, optional) - Additional CSS classes

### SearchInput
```jsx
import { SearchInput } from '@/components/shared';

<SearchInput
  value={searchQuery}
  onChange={setSearchQuery}  // receives string value directly
  placeholder="Search..."
  className="w-64"
/>
```
**Props:**
- `value` (string, required) - Current input value
- `onChange` (function, required) - Handler receives value string (not event)
- `placeholder` (string, default: "Search...") - Placeholder text
- `className` (string, optional) - Additional CSS classes for container

### StatusBadge
```jsx
import { StatusBadge, CustomerTypeBadge, PaymentStatusBadge } from '@/components/shared';

// Basic usage
<StatusBadge status="paid" />
<StatusBadge status="due" />
<StatusBadge status="same_as_original" />  // Auto-formats to "Same as Original"

// With fallback for null values
<StatusBadge status={null} fallback="Regular" />

// Custom label override
<StatusBadge status="partial" label="Partially Paid" />

// Specialized badges
<CustomerTypeBadge type={customer.customer_type} />  // Defaults to "Regular"
<PaymentStatusBadge status={bill.status} paymentMethod={bill.payment_method} />
```
**Props:**
- `status` (string, required) - Status value (case-insensitive)
- `label` (string, optional) - Custom label override
- `fallback` (string, default: "-") - Text for null/undefined status
- `className` (string, optional) - Additional CSS classes

**Auto-formatted Labels (LABEL_MAPPINGS):**
| Database Value | Displayed As |
|----------------|--------------|
| `same_as_original` | "Same as Original" |
| `credit_to_account` | "Credit to Account" |
| `adjust_outstanding` | "Adjusted" |

### DateRangePicker
```jsx
import { DateRangePicker, getFinancialYearRange } from '@/components/shared';

// As component
<DateRangePicker
  dateRange={dateRange}  // { start: Date|null, end: Date|null }
  onDateRangeChange={setDateRange}
  className=""
/>

// Use utility function for FY calculation
const fyRange = getFinancialYearRange();
// Returns { start: Date, end: Date } for current Indian FY
```
**Props:**
- `dateRange` (object, required) - `{ start: Date|null, end: Date|null }`
- `onDateRangeChange` (function, required) - Handler for range changes
- `className` (string, optional) - Additional CSS classes

**Quick Date Range Options:**
- Today
- This Month  
- Last Month
- This FY (Indian Financial Year)
- All Time

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

## Status Badge Colors (Current)
| Status | Background | Text | Notes |
|--------|------------|------|-------|
| paid, cash, active, completed, confirmed | `bg-green-100` | `text-green-700` | Success states |
| due, unpaid | `bg-amber-100` | `text-amber-700` | Warning (changed from red) |
| overdue, cancelled, inactive | `bg-red-100` | `text-red-700` | Error states |
| partial, parked, pending, draft | `bg-amber-100` | `text-amber-700` | Pending states |
| upi | `bg-blue-100` | `text-blue-700` | Payment method |
| credit, card, adjusted, credit_to_account | `bg-purple-100` | `text-purple-700` | Credit-related |
| same_as_original | `bg-gray-100` | `text-gray-700` | Neutral |
| regular (customer type) | `bg-blue-100` | `text-blue-700` | Customer type |
| wholesale (customer type) | `bg-purple-100` | `text-purple-700` | Customer type |
| institution (customer type) | `bg-green-100` | `text-green-700` | Customer type |
| default/unknown | `bg-gray-100` | `text-gray-700` | Fallback |

## Action Icon Colors
- View icon: `text-blue-600` with `hover:bg-blue-50`
- Edit icon: `text-gray-600` with `hover:bg-gray-100`
- Delete icon: `text-red-600` with `hover:bg-red-50`
- Print icon: `text-gray-600` with `hover:bg-gray-100`
- WhatsApp icon: `text-green-600` with `hover:bg-green-50`

## Button Colors
- Primary teal: `bg-teal-500 hover:bg-teal-600 text-white` (Add buttons)
- Secondary: Shadcn `variant="outline"`
- Ghost: Shadcn `variant="ghost" size="sm"`

---

# 4. LAYOUT PATTERNS

## List Page Structure (Pattern A)
```jsx
<div className="min-h-screen bg-gray-50 p-6">
  {/* Header */}
  <PageHeader title="..." subtitle="..." actions={...} />
  
  {/* Filters Row */}
  <div className="flex justify-between items-center gap-4 mb-4">
    <div className="flex items-center gap-4">
      <SearchInput ... />
      <DateRangePicker ... />
      {/* Filter pills */}
    </div>
  </div>
  
  {/* Data Table */}
  <DataCard>
    <table>...</table>
  </DataCard>
</div>
```

## Detail/Create Page Structure (Pattern B/C)
```jsx
<div className="min-h-screen flex flex-col bg-gray-50">
  {/* Header bar */}
  <header className="bg-white border-b ...">...</header>
  
  {/* Main content - already has white card sections */}
  <main className="flex-1 overflow-auto p-4">
    {/* Content sections with bg-white rounded-xl border */}
  </main>
  
  {/* Footer with totals */}
  <footer className="bg-white border-t ...">...</footer>
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
        <Button type="submit" className="bg-teal-500 hover:bg-teal-600 text-white">Save</Button>
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
| Print | `Printer` | `text-gray-600` |
| Phone | `Phone` | `text-gray-600` |
| Email | `Mail` | `text-gray-500` |
| User | `User` | Inherits |
| Back | `ArrowLeft` | Inherits |

## WhatsApp Icon (Custom SVG)
Used in BillingOperations.js for "Send via WhatsApp" action:
```jsx
const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149..."/>
  </svg>
);
```

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
import { getFinancialYearRange } from '@/components/shared';

const fyRange = getFinancialYearRange();
// Returns { start: Date (01 Apr), end: Date (31 Mar) }
```

**Logic:**
- If current month >= April (3): FY starts current year
- If current month < April (0-2): FY started previous year

---

# 9. NUMBER FORMATTING

## Indian Locale
Use `en-IN` locale for currency formatting:
```javascript
// Currency
amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
// Output: 1,23,456.00

// With rupee symbol
`₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
// Output: ₹1,23,456.00
```

---

# 10. FORM RULES

- Required fields: Mark with `*` in label
- Labels: Use Shadcn `<Label>` component
- Inputs: Use Shadcn `<Input>` component
- Layout: Two-column grid (`grid grid-cols-2 gap-4`)
- Full-width fields: Use `col-span-2`
- Currency: Show `₹` prefix, 2 decimal places, en-IN locale
- Phone: 10 digits max
- GSTIN: 15 characters, uppercase

---

# 11. TOAST MESSAGES

## Library
Use `sonner` for toasts.

## Patterns
```javascript
import { toast } from 'sonner';

toast.success('Customer added successfully');
toast.success('Data exported to Excel');
toast.error('Failed to load data');
toast.error(error.response?.data?.detail || 'Failed to save');
toast.info('Print functionality coming soon');
```

## Rules
- Success: `[Entity] [action] successfully`
- Error: Show actual error, fallback to generic
- Info: For non-critical notifications
- Never show toasts for background operations

---

# 12. WORKFLOW RULES

## Before Making Changes
1. Read this file and PHARMACARE_DESIGN_SYSTEM.md
2. Check if a shared component already exists
3. Match Customers page design exactly

## After Making Changes
1. List every file changed
2. List every file NOT touched
3. Confirm zero functionality was broken
4. Take screenshots for visual changes

## Non-Negotiable
1. **Do NOT rewrite files** — use search_replace for edits
2. **Do NOT add new libraries** without explicit approval
3. **Do NOT refactor server.py** into routers
4. **Do NOT delete working pages** without explicit request

---

# 13. NON-NEGOTIABLE RULES

1. **Customers page is the reference** — all pages must match it exactly
2. **Use shared components** — never duplicate component code
3. **Never show NaN** — handle null/undefined values gracefully
4. **Use Shadcn UI** — Button, Input, Card, Dialog, Tabs from `@/components/ui`
5. **Use lucide-react** — for all icons (except WhatsApp)
6. **Use sonner** — for all toasts
7. **Gray-50 background** — page background is always `bg-gray-50`
8. **White cards** — tables/content go in white DataCard
9. **Uppercase table headers** — `text-xs font-semibold text-gray-600 uppercase`
10. **Indian Financial Year** — default date ranges
11. **en-IN locale** — for number formatting

---

# 14. FILE STRUCTURE

```
/app/frontend/src/
├── components/
│   ├── ui/              # Shadcn components (DO NOT MODIFY)
│   └── shared/          # PharmaCare shared components
│       ├── index.js           # Exports all components
│       ├── DateRangePicker.jsx
│       ├── PageHeader.jsx
│       ├── DataCard.jsx
│       ├── TableActions.jsx
│       ├── SearchInput.jsx
│       └── StatusBadge.jsx    # StatusBadge, CustomerTypeBadge, PaymentStatusBadge
├── pages/
│   ├── Customers.js     # DESIGN REFERENCE
│   └── ...
└── utils/
    └── cache.js
```

---

# END OF RULES FILE
