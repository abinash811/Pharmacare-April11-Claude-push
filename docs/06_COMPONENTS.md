# PharmaCare — Shared Components
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Before building any UI, check if a shared component already handles it.
#        Never rebuild what already exists. When a new shared component is created,
#        document it here in the same PR.

---

## IMPORT PATH

All shared components import from one place:

```jsx
import {
  AppButton,
  PageHeader,
  PageTabs,
  SearchInput,
  StatusBadge,
  CustomerTypeBadge,
  PaymentStatusBadge,
  TableSkeleton,
  PageSkeleton,
  InlineLoader,
  CardSkeleton,
  EmptyState,
  BillingEmptyState,
  PurchasesEmptyState,
  SalesReturnsEmptyState,
  PurchaseReturnsEmptyState,
  SuppliersEmptyState,
  CustomersEmptyState,
  InventoryEmptyState,
  SearchEmptyState,
  ErrorEmptyState,
  ConfirmDialog,
  DeleteConfirmDialog,
  DiscardConfirmDialog,
  PaginationBar,
  DataCard,
  DateRangePicker,
  TableActions,
  FilterPills,
} from '@/components/shared';
```

**Never import directly from the file:**
```jsx
// ❌ Wrong
import AppButton from '@/components/shared/AppButton';

// ✅ Correct
import { AppButton } from '@/components/shared';
```

---

## COMPONENT INDEX

| Component | Purpose | Anti-pattern it prevents |
|-----------|---------|------------------------|
| `AppButton` | Every button in the app | Raw `<button>` tags with wrong colors/weights |
| `PageHeader` | Every page title + actions | Inline `<h1>` with inconsistent styling |
| `PageTabs` | Every tab bar | Custom tab UI with wrong active state colors |
| `SearchInput` | Search with icon | Raw `<input>` without consistent icon/style |
| `StatusBadge` | Colored status chips | Hardcoded bg colors per status |
| `TableSkeleton` | Table loading state | Empty white box while loading |
| `InlineLoader` | Section loading state | Manual spinner divs |
| `PageSkeleton` | Full page loading | Blank screen on first load |
| `CardSkeleton` | Card loading state | Missing loading for card grids |
| `EmptyState` | No-data placeholder | Plain "No data found" text |
| `ConfirmDialog` | Confirmation modal | Custom confirm UIs |
| `DeleteConfirmDialog` | Delete confirmation | Inconsistent delete warning copy |
| `DiscardConfirmDialog` | Unsaved changes warning | Silent navigation away from dirty forms |
| `PaginationBar` | Page navigation | Custom pagination with wrong styling |
| `DataCard` | Metric/KPI card wrapper | Raw divs with inconsistent card styling |
| `DateRangePicker` | Date range selection | Custom date inputs |
| `TableActions` | Row action buttons (view/edit/delete) | Inline action buttons with wrong sizing |

---

## 1. AppButton

**File:** `frontend/src/components/shared/AppButton.jsx`

The only way to render any interactive button in PharmaCare.
Raw `<button>` tags are caught by ESLint and will fail the pre-commit hook.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'danger' \| 'ghost'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `icon` | `ReactNode` | — | Icon shown before label |
| `iconOnly` | `boolean` | `false` | Square button, no label |
| `loading` | `boolean` | `false` | Shows spinner, disables click |
| `disabled` | `boolean` | `false` | Disables click |
| `className` | `string` | `''` | Layout overrides ONLY (width, margin) |
| `...rest` | — | — | All standard button props (onClick, type, data-testid) |

### Variant Reference

| Variant | Background | Text | Hover | Use for |
|---------|-----------|------|-------|---------|
| `primary` | `bg-brand` | `text-white` | `hover:bg-brand-dark` | Main CTA — max one per page |
| `secondary` | `bg-gray-100` | `text-gray-700` | `hover:bg-gray-200` | Cancel, back, lesser actions |
| `outline` | `bg-white` + `border-gray-200` | `text-gray-700` | `hover:bg-gray-50` | Export, print, secondary CTA |
| `danger` | `bg-red-600` | `text-white` | `hover:bg-red-700` | Delete, irreversible actions |
| `ghost` | none | `text-gray-600` | `hover:bg-gray-100` | Icon-only, subtle, table actions |

### Usage

```jsx
// Primary — main action
<AppButton onClick={handleSettle} loading={settling}>
  Settle Bill
</AppButton>

// Secondary — dismiss/cancel
<AppButton variant="secondary" onClick={onClose}>
  Cancel
</AppButton>

// Outline — secondary CTA
<AppButton variant="outline" icon={<Printer className="w-4 h-4" />}>
  Print Bill
</AppButton>

// Danger — destructive
<AppButton variant="danger" loading={deleting} onClick={handleDelete}>
  Delete Batch
</AppButton>

// Ghost icon-only
<AppButton
  variant="ghost"
  icon={<MoreVertical className="w-4 h-4" />}
  iconOnly
  aria-label="More options"
/>

// Loading state
<AppButton loading={saving}>
  Save Changes
</AppButton>
// → shows spinner, disables click, keeps button width stable

// Sizes
<AppButton size="sm">Small</AppButton>
<AppButton size="lg" icon={<Plus className="w-4 h-4" />}>Large</AppButton>

// Full width (layout override)
<AppButton className="w-full">Apply Filters</AppButton>

// Form submit
<AppButton type="submit" loading={submitting}>
  Create Account
</AppButton>
```

### Anti-patterns

```jsx
// ❌ Raw button tag
<button className="bg-brand text-white px-4 py-2 rounded-lg" onClick={save}>
  Save
</button>

// ❌ Wrong text color on brand bg
<AppButton className="text-gray-900">Save</AppButton>

// ❌ Using className to override colors
<AppButton className="bg-green-600 text-white">Approve</AppButton>
// → Use variant="primary" and if green is needed, create a new variant

// ❌ font-medium on button
<AppButton className="font-medium">Save</AppButton>
// → AppButton already applies font-semibold

// ❌ Manual spinner
<button disabled={loading}>
  {loading && <Spinner />} Save
</button>
// → Use loading prop on AppButton
```

---

## 2. PageHeader

**File:** `frontend/src/components/shared/PageHeader.jsx`

Every page's top header. Bleeds edge-to-edge inside the `px-8 py-6` page wrapper.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Page title — `text-xl font-bold` |
| `subtitle` | `string` | — | Muted count or description |
| `actions` | `ReactNode` | — | Buttons on the right side |
| `className` | `string` | `''` | Extra classes on the header div |

### Usage

```jsx
// Minimal
<PageHeader title="Reports" />

// With subtitle (counts, descriptions)
<PageHeader
  title="Inventory"
  subtitle="2,341 products · 48 near expiry"
/>

// With actions
<PageHeader
  title="Billing"
  subtitle="Manage bills and sales returns"
  actions={
    <>
      <AppButton variant="outline" icon={<Download className="w-4 h-4" />}>
        Export
      </AppButton>
      <AppButton icon={<Plus className="w-4 h-4" />}>
        New Bill
      </AppButton>
    </>
  }
/>
```

### Anti-patterns

```jsx
// ❌ Inline h1 in page root
<div className="px-8 py-6">
  <h1 className="text-2xl font-semibold">Billing</h1>
</div>

// ❌ Wrong title size
<PageHeader title="Billing" className="text-2xl" />
// → Title is always text-xl font-bold — don't override

// ❌ Non-AppButton in actions
<PageHeader actions={
  <button className="bg-brand text-white px-4 py-2 rounded">New Bill</button>
} />
// → actions must contain only AppButton components
```

---

## 3. PageTabs

**File:** `frontend/src/components/shared/PageTabs.jsx`

Standard underline tab bar. Used for all multi-view pages.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `Array<TabItem>` | `[]` | Tab definitions |
| `activeTab` | `string` | required | Key of the active tab |
| `onChange` | `(key: string) => void` | required | Called when tab is clicked |
| `noBleed` | `boolean` | `false` | Disable edge-to-edge bleed for sticky layouts |
| `className` | `string` | `''` | Extra classes |

**TabItem shape:**
```ts
{
  key: string       // unique identifier, used in onChange
  label: string     // display text
  icon?: LucideIcon // optional icon before label
  count?: number    // optional count badge
}
```

### Usage

```jsx
// Route-based tabs (tab click navigates to different route)
const BILLING_TABS = [
  { key: 'bills',   label: 'Bills',        count: billCount },
  { key: 'returns', label: 'Sales Returns', count: returnCount },
];

// On /billing page — activeTab is 'bills'
<PageTabs
  tabs={BILLING_TABS}
  activeTab="bills"
  onChange={(key) => {
    if (key === 'returns') navigate('/billing/returns');
  }}
/>

// On /billing/returns page — activeTab is 'returns'
<PageTabs
  tabs={BILLING_TABS}
  activeTab="returns"
  onChange={(key) => {
    if (key === 'bills') navigate('/billing');
  }}
/>

// State-based tabs (tab click changes local state)
const SETTINGS_TABS = [
  { key: 'inventory',     label: 'Inventory' },
  { key: 'billing',       label: 'Billing' },
  { key: 'bill_sequence', label: 'Bill Sequence' },
  { key: 'returns',       label: 'Returns' },
  { key: 'general',       label: 'General' },
];

<PageTabs
  tabs={SETTINGS_TABS}
  activeTab={activeTab}
  onChange={setActiveTab}
/>

// With icons
const TEAM_TABS = [
  { key: 'members', label: 'Members', icon: Users,  count: memberCount },
  { key: 'roles',   label: 'Roles',   icon: Shield },
];
<PageTabs tabs={TEAM_TABS} activeTab={activeTab} onChange={setActiveTab} />

// noBleed — Customers page sticky layout
<PageTabs
  tabs={CUSTOMER_TABS}
  activeTab={section}
  onChange={setSection}
  noBleed
/>
```

### Anti-patterns

```jsx
// ❌ Custom tab UI
<div className="flex border-b">
  {tabs.map(tab => (
    <button
      key={tab.key}
      className={tab.key === active ? 'border-b-2 border-blue-600' : ''}
      onClick={() => setActive(tab.key)}
    >
      {tab.label}
    </button>
  ))}
</div>

// ❌ Shadcn Tabs component for page navigation
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
// → Shadcn Tabs is pill/segment style, not underline — use PageTabs

// ❌ Wrong active color
// PageTabs active state is always border-brand text-brand
// Do not override with border-blue-600 or any other color
```

---

## 4. SearchInput

**File:** `frontend/src/components/shared/SearchInput.jsx`

Search input with embedded search icon. Use for all search fields in filter bars.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | required | Controlled value |
| `onChange` | `(value: string) => void` | required | Called with string (not event) |
| `placeholder` | `string` | `'Search...'` | Placeholder text |
| `className` | `string` | `''` | Extra classes on wrapper |

### Usage

```jsx
const [search, setSearch] = useState('');

<SearchInput
  value={search}
  onChange={setSearch}
  placeholder="Search medicines by name, SKU..."
  className="w-64"
/>

// Note: onChange receives the string value directly, not an event
// ✅ onChange={setSearch}
// ❌ onChange={(e) => setSearch(e.target.value)}  ← wrong, SearchInput already unwraps
```

---

## 5. StatusBadge / PaymentStatusBadge / CustomerTypeBadge

**File:** `frontend/src/components/shared/StatusBadge.jsx`

Colored pill badges for status values. All status-to-color mappings live here.

### StatusBadge — General purpose

```jsx
<StatusBadge status="paid" />           // green "Paid"
<StatusBadge status="due" />            // amber "Due"
<StatusBadge status="overdue" />        // red "Overdue"
<StatusBadge status="cancelled" />      // red "Cancelled"
<StatusBadge status="draft" />          // amber "Draft"
<StatusBadge status="pending" />        // amber "Pending"
<StatusBadge status="active" />         // green "Active"
<StatusBadge status="inactive" />       // red "Inactive"

// Custom label
<StatusBadge status="draft" label="Parked" />   // amber "Parked"

// Fallback for null/undefined (never shows "NaN" or blank)
<StatusBadge status={null} fallback="Unknown" />
```

### PaymentStatusBadge — For bill payment status

```jsx
// Shows payment method for paid bills
<PaymentStatusBadge status="paid" paymentMethod="cash" />   // green "Cash"
<PaymentStatusBadge status="paid" paymentMethod="upi" />    // blue "UPI"
<PaymentStatusBadge status="paid" paymentMethod="card" />   // purple "Card"
<PaymentStatusBadge status="paid" paymentMethod="credit" /> // purple "Credit"
<PaymentStatusBadge status="due" />                         // amber "Due"
<PaymentStatusBadge status="partial" />                     // amber "Partial"
```

### CustomerTypeBadge — For customer type

```jsx
<CustomerTypeBadge type="regular" />     // blue "Regular"
<CustomerTypeBadge type="wholesale" />   // purple "Wholesale"
<CustomerTypeBadge type="institution" /> // green "Institution"
<CustomerTypeBadge type={null} />        // blue "Regular" (safe default)
```

### Adding a new status

Add to `STATUS_STYLES` in `StatusBadge.jsx`. Use only semantic color pairs:
```jsx
// In STATUS_STYLES object:
my_new_status: 'bg-green-50 text-green-700',  // success
my_new_status: 'bg-amber-50 text-amber-700',  // warning
my_new_status: 'bg-red-50 text-red-700',      // error
my_new_status: 'bg-blue-50 text-blue-700',    // info
my_new_status: 'bg-gray-100 text-gray-700',   // neutral
```

**Anti-patterns:**
```jsx
// ❌ Hardcoded badge
<span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
  Paid
</span>
// → bg-green-100 is too bright. Use StatusBadge with status="paid"

// ❌ Building a new badge component
// → Always extend StatusBadge.jsx
```

---

## 6. Loading Components

**File:** `frontend/src/components/shared/TableSkeleton.jsx`

### TableSkeleton — While table data is loading

```jsx
<TableSkeleton />                    // 5 rows, 5 columns (default)
<TableSkeleton rows={8} columns={6} /> // custom
```

### PageSkeleton — Full page initial load

```jsx
if (loading && !data) {
  return <PageSkeleton />;
}
```

### InlineLoader — Section or search loading

```jsx
<InlineLoader />                          // "Loading..."
<InlineLoader text="Fetching medicines..." />  // custom text
```

### CardSkeleton — Loading for card grids

```jsx
<CardSkeleton />           // 3 cards (default)
<CardSkeleton count={4} /> // custom count
```

### Rules

```jsx
// ✅ Show skeleton while loading — never empty table
{loading ? (
  <TableSkeleton rows={10} columns={6} />
) : (
  <table>...</table>
)}

// ❌ Empty table while loading
{!loading && <table>...</table>}
// → Shows blank white space during load — use TableSkeleton

// ❌ Manual spinner
<div className="flex justify-center">
  <div className="animate-spin w-6 h-6 border-2 border-brand rounded-full border-t-transparent" />
</div>
// → Use InlineLoader
```

---

## 7. EmptyState Components

**File:** `frontend/src/components/shared/EmptyState.jsx`

### Domain-specific (always prefer these)

```jsx
// Each accepts optional action and filtered props
<BillingEmptyState />
<BillingEmptyState filtered={true} />   // "No bills match your filters"
<BillingEmptyState action={
  <AppButton icon={<Plus className="w-4 h-4" />}>New Bill</AppButton>
} />

<InventoryEmptyState />
<PurchasesEmptyState />
<SalesReturnsEmptyState />
<PurchaseReturnsEmptyState />
<SuppliersEmptyState />
<CustomersEmptyState />
```

### Search empty state

```jsx
<SearchEmptyState query={search} />
// Shows: "No results for 'paracetamol'" with suggestion to clear search
```

### Error empty state — always with retry

```jsx
<ErrorEmptyState onRetry={fetchData} />
// Shows: error icon + message + "Try Again" button
// onRetry is required — never show error state without retry
```

### Generic with custom content

```jsx
import { Package } from 'lucide-react';

<EmptyState
  icon={Package}
  title="No batches found"
  description="Add stock to see batch details here"
  action={
    <AppButton icon={<Plus className="w-4 h-4" />} onClick={openAddStock}>
      Add Stock
    </AppButton>
  }
/>
```

### Anti-patterns

```jsx
// ❌ Plain text empty state
<td colSpan={6} className="text-center py-8 text-gray-500">
  No data found
</td>
// → Use domain-specific EmptyState

// ❌ Error without retry
<ErrorEmptyState />
// → Always pass onRetry
```

---

## 8. ConfirmDialog / DeleteConfirmDialog / DiscardConfirmDialog

**File:** `frontend/src/components/shared/ConfirmDialog.jsx`

### ConfirmDialog — Generic confirmation

```jsx
const [showConfirm, setShowConfirm] = useState(false);

<AppButton onClick={() => setShowConfirm(true)}>Settle Bill</AppButton>

<ConfirmDialog
  open={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleSettle}
  title="Settle Bill?"
  description="This will assign a bill number and deduct stock. Cannot be undone."
  confirmLabel="Settle"
  isLoading={settling}
/>
```

### DeleteConfirmDialog — Pre-configured for deletions

```jsx
<DeleteConfirmDialog
  open={showDelete}
  onClose={() => setShowDelete(false)}
  onConfirm={handleDelete}
  itemName="Batch BN240501"
  isLoading={deleting}
/>
// Shows: "Are you sure you want to delete Batch BN240501? This cannot be undone."
// Red confirm button
```

### DiscardConfirmDialog — Unsaved changes warning

```jsx
// Trigger when user tries to navigate away with unsaved form changes
<DiscardConfirmDialog
  open={showDiscard}
  onClose={() => setShowDiscard(false)}
  onConfirm={() => { reset(); onClose(); }}
  isLoading={false}
/>
```

### Anti-patterns

```jsx
// ❌ window.confirm()
if (window.confirm('Are you sure?')) { handleDelete(); }
// → Never use browser dialogs — use DeleteConfirmDialog

// ❌ Custom confirm UI
<div className="fixed inset-0 bg-black/50 flex items-center justify-center">
  <div className="bg-white p-6 rounded-lg">
    <h3>Are you sure?</h3>
    <button onClick={handleDelete}>Yes</button>
  </div>
</div>
// → Use ConfirmDialog
```

---

## 9. PaginationBar

**File:** `frontend/src/components/shared/PaginationBar.jsx`

Pagination footer for all list pages. Designed to receive `usePagination()` return values directly.

### Usage

```jsx
import { PaginationBar } from '@/components/shared';
import { usePagination } from '@/hooks/usePagination';

// In your component
const pg = usePagination({ pageSize: 20, totalItems: totalCount });

// Pass spread — PaginationBar receives all pagination props
<PaginationBar {...pg} />

// PaginationBar returns null when totalItems is 0
// No need to conditionally render it
```

### Hook reference

`usePagination` is in `frontend/src/hooks/usePagination.js`. It returns:
```js
{
  page, totalPages, totalItems,
  showingText,   // "Showing 1–20 of 98"
  prevPage, nextPage, setPage,
  isFirstPage, isLastPage,
  offset,        // for API calls: skip this many records
  limit,         // for API calls: page size
}
```

---

## 10. DataCard

**File:** `frontend/src/components/shared/DataCard.jsx`

White card wrapper. Use for KPI metrics, stat summaries.

```jsx
<DataCard>
  <p className="text-sm text-gray-500 mb-1">Today's Sales</p>
  <p className="text-2xl font-bold text-gray-900 tabular-nums">₹24,500</p>
  <p className="text-xs text-green-600 mt-1">↑ 12% from yesterday</p>
</DataCard>

// Grid of metrics
<div className="grid grid-cols-4 gap-4 mb-6">
  <DataCard>...</DataCard>
  <DataCard>...</DataCard>
  <DataCard>...</DataCard>
  <DataCard>...</DataCard>
</div>

// With extra padding (default is noPadding=true for tables)
<DataCard noPadding={false} className="p-6">
  <h3 className="text-lg font-semibold">Summary</h3>
  ...
</DataCard>
```

---

## 11. DateRangePicker

**File:** `frontend/src/components/shared/DateRangePicker.jsx`

Date range selector with quick presets: Today, This Month, Last Month, Financial Year.
Defaults to showing current Indian Financial Year (April 1 – March 31).

```jsx
import { DateRangePicker, getFinancialYearRange } from '@/components/shared';

const [dateRange, setDateRange] = useState(() => getFinancialYearRange());

<DateRangePicker
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
/>

// dateRange shape: { start: Date, end: Date }
// Use in API calls:
const params = {
  start_date: dateRange.start.toISOString().split('T')[0],  // "2025-04-01"
  end_date:   dateRange.end.toISOString().split('T')[0],    // "2026-03-31"
};
```

**getFinancialYearRange()** — utility to get current Indian FY dates:
```jsx
import { getFinancialYearRange } from '@/components/shared';

const { start, end } = getFinancialYearRange();
// FY starts April 1. If today is Jan 2026 → start = April 1 2025, end = March 31 2026
// If today is June 2025 → start = April 1 2025, end = March 31 2026
```

---

## 12. TableActions

**File:** `frontend/src/components/shared/TableActions.jsx`

Standard row action buttons (view, edit, delete). Always right-aligned in the last column.

```jsx
// All three
<TableActions
  onView={() => navigate(`/billing/${bill.id}`)}
  onEdit={() => setEditingBill(bill)}
  onDelete={() => setDeleteTarget(bill)}
/>

// View only
<TableActions onView={() => navigate(`/purchases/${p.id}`)} />

// Edit and delete only
<TableActions
  onEdit={() => openEditModal(supplier)}
  onDelete={() => openDeleteConfirm(supplier)}
/>
```

**In table:**
```jsx
<th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
  Actions
</th>

<td className="px-4 py-3">
  <TableActions
    onView={() => navigate(`/billing/${bill.id}`)}
    onEdit={() => setEditing(bill)}
    onDelete={() => setDeleting(bill.id)}
  />
</td>
```

---

## ADDING A NEW SHARED COMPONENT

When a UI pattern appears in 2+ pages, extract it to shared. Steps:

1. Create file in `frontend/src/components/shared/YourComponent.jsx`
2. Export it from `frontend/src/components/shared/index.js`
3. Document it in this file (`docs/06_COMPONENTS.md`) — same PR
4. Add JSDoc comment at top of the component file
5. Include `data-testid` on the root element

```jsx
// Template for new shared component
/**
 * YourComponent — one-line description.
 * Props:
 *   propA  {type}  description
 *   propB  {type}  description
 */
import React from 'react';

export function YourComponent({ propA, propB }) {
  return (
    <div data-testid="your-component">
      {/* implementation */}
    </div>
  );
}
```

---

---

## FilterPills

Toggle group for filter states (All / Cash / Credit / etc.). **The only way to render filter pills — never inline a `.map()` pill pattern.**

```jsx
import { FilterPills } from '@/components/shared';

const FILTERS = [
  { key: 'all',    label: 'All'    },
  { key: 'cash',   label: 'Cash'   },
  { key: 'credit', label: 'Credit' },
];

<FilterPills options={FILTERS} active={activeFilter} onChange={setActiveFilter} />
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `Array<{ key: string, label: string }>` | ✅ | Pill options |
| `active` | `string` | ✅ | Currently active key |
| `onChange` | `(key: string) => void` | ✅ | Called when a pill is clicked |
| `className` | `string` | — | Extra classes on the wrapper (layout only) |

**Visual:** Active = `bg-gray-900 text-white`. Inactive = `bg-gray-100 text-gray-600`.
**Do NOT use AppButton for pills** — pills are toggle controls, not actions.

---

*Every shared component is documented here.*
*If you use a component not in this file, you are using it without a contract.*
*Owner: Developer who creates or modifies a shared component.*
