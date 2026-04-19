# PharmaCare — Design System
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, developers, designers
# Rule: Every visual decision in PharmaCare is defined here.
#        If it's not in this file, ask before inventing it.
#        When a new pattern is established, add it here in the same PR.

---

## NORTH STAR

Every screen in PharmaCare must feel like it belongs to the same product.
A pharmacist switching from Billing to Settings to Reports should feel zero visual friction.
The standard is Linear, Notion, Stripe — clean, fast, purposeful.

---

## PART 1 — DESIGN TOKENS

Tokens are the foundation. Everything else is built from tokens.
**Never hardcode a value that has a token. Never.**

---

### 1.1 Color Tokens

Defined in `frontend/tailwind.config.js`. Use class names, never hex.

#### Brand Colors

| Token | Tailwind class | Hex | Use |
|-------|---------------|-----|-----|
| Brand primary | `bg-brand` / `text-brand` / `border-brand` | `#4682B4` | Buttons, active tabs, links, focus rings |
| Brand hover | `hover:bg-brand-dark` | `#3a6d96` | All hover states on brand elements |
| Brand tint | `bg-brand-tint` | `#f0f7ff` | Table row hover |
| Brand subtle | `bg-brand-subtle` | `rgba(70,130,180,0.10)` | Active tab count badge bg, selected row bg |

#### Surface Colors

| Token | Tailwind class | Use |
|-------|---------------|-----|
| Page canvas | `bg-[#F8FAFB]` | Every page background wrapper |
| Surface | `bg-white` | Cards, tables, modals, headers |
| Border | `border-gray-200` | All borders everywhere |
| Sidebar | `#1a2332` (inline style) | Layout sidebar only |

#### Text Colors

| Token | Tailwind class | Use |
|-------|---------------|-----|
| Primary text | `text-gray-900` | Main content, headings, table data |
| Secondary text | `text-gray-600` | Supporting copy, subtitles |
| Muted text | `text-gray-500` | Helpers, captions, placeholders |
| Disabled text | `text-gray-400` | Disabled inputs, inactive icons |
| On-brand text | `text-white` | Text ON brand blue backgrounds — always white, never gray |

#### Semantic Colors (muted only — never bright)

| State | Background | Text | Border | Use |
|-------|-----------|------|--------|-----|
| Success | `bg-green-50` | `text-green-700` | `border-green-200` | Paid, active, confirmed |
| Warning | `bg-amber-50` | `text-amber-700` | `border-amber-200` | Due, pending, near expiry |
| Error | `bg-red-50` | `text-red-700` | `border-red-200` | Overdue, expired, cancelled, failed |
| Info | `bg-blue-50` | `text-blue-700` | `border-blue-200` | Informational notes |
| Neutral | `bg-gray-100` | `text-gray-700` | `border-gray-200` | Default/unknown state |

#### Banned Colors — Never use, ever

```
❌ bg-teal-* / text-teal-* / border-teal-*     (any teal)
❌ #13ecda / #00CED1 / #00B5B8                  (bright cyan)
❌ #4682B4 hardcoded in className               (use bg-brand)
❌ #3a6fa0 hardcoded in className               (use hover:bg-brand-dark)
❌ hover:bg-[#anything]                         (always use token)
❌ bg-blue-100 / bg-red-100 / bg-green-100      (bg-X-100 too bright — use bg-X-50)
❌ text-gray-900 on bg-brand background         (use text-white)
```

---

### 1.2 Typography Tokens

| Role | Classes | Where used |
|------|---------|-----------|
| Page title | `text-xl font-bold text-gray-900` | `<PageHeader>` title only |
| Section heading | `text-lg font-semibold text-gray-900` | Card/section titles |
| Sub-heading | `text-base font-semibold text-gray-900` | Sub-section titles |
| Table header | `text-xs font-medium text-gray-500 uppercase tracking-wider` | `<th>` cells only |
| Table body primary | `text-sm font-medium text-gray-900` | Primary column (name, ID) |
| Table body secondary | `text-sm text-gray-600` | Supporting columns |
| Button label | `text-sm font-semibold` | Inside `<AppButton>` — handled automatically |
| Badge text | `text-xs font-medium` | `<StatusBadge>` — handled automatically |
| Caption / helper | `text-xs text-gray-500` | Below inputs, footnotes |
| Money / numbers | `text-sm font-semibold tabular-nums` | All currency amounts |
| Mono (batch/codes) | `font-mono` | Batch numbers, bill numbers, prefixes |
| Page subtitle | `text-xs text-gray-500` | `<PageHeader>` subtitle only |

**Rules:**
- `font-medium` on buttons is wrong — always `font-semibold`
- `text-2xl` for page titles is wrong — always `text-xl font-bold`
- Never use `font-bold` for anything other than page titles

---

### 1.3 Spacing Tokens

| Context | Value | Where |
|---------|-------|-------|
| Page wrapper | `px-8 py-6` | Outer div of every page |
| Card padding | `p-6` | Inside cards with content |
| Table cell | `px-4 py-3` | Every `<td>` and `<th>` |
| Table row height | `h-10` | 40px — Zoho-like density |
| Section gap | `gap-6` | Between major sections |
| Button gap | `gap-2` | Between buttons in a group |
| Form field gap | `gap-4` or `gap-6` | Between form fields |
| Filter bar gap | `gap-3` | Between filter elements |
| Modal padding | `p-6` | Inside all modals/sheets |

---

### 1.4 Border & Shadow Tokens

| Token | Classes | Use |
|-------|---------|-----|
| Standard border | `border border-gray-200` | All cards, tables, inputs |
| Card shadow | `shadow-sm` | Cards, modals, headers |
| Focus ring | `focus:ring-2 focus:ring-brand focus:outline-none` | All focusable inputs |
| Border radius card | `rounded-xl` | Page-level cards |
| Border radius button | `rounded-lg` | Buttons (handled by AppButton) |
| Border radius badge | `rounded-full` | Status badges |
| Border radius input | `rounded-lg` | Form inputs |

---

## PART 2 — ATOMS

The smallest building blocks. These are either shared components or exact class patterns.

---

### 2.1 Button (AppButton)

**The only way to render a button. Raw `<button>` tags are forbidden.**
Import: `import { AppButton } from '@/components/shared'`

#### Variants

```jsx
// PRIMARY — default, main CTA, one per page max
<AppButton>Save</AppButton>
<AppButton onClick={handleSave}>Save Bill</AppButton>
<AppButton loading={saving}>Save Bill</AppButton>          // spinner + disabled

// SECONDARY — cancel, back, lesser actions
<AppButton variant="secondary">Cancel</AppButton>
<AppButton variant="secondary" onClick={onBack}>Back</AppButton>

// OUTLINE — secondary CTA, export, print
<AppButton variant="outline" icon={<Printer className="w-4 h-4" />}>Print</AppButton>
<AppButton variant="outline">Export</AppButton>

// DANGER — destructive, irreversible actions
<AppButton variant="danger" loading={deleting}>Delete</AppButton>
<AppButton variant="danger" onClick={handleDelete}>Remove Batch</AppButton>

// GHOST — subtle, icon-only, table row actions
<AppButton variant="ghost" icon={<Settings className="w-4 h-4" />} iconOnly aria-label="Settings" />
<AppButton variant="ghost">View Details</AppButton>

// SIZES
<AppButton size="sm">Small</AppButton>   // px-3 py-1.5 text-xs
<AppButton size="md">Default</AppButton> // px-4 py-2 text-sm
<AppButton size="lg">Large</AppButton>   // px-6 py-2.5 text-sm

// WITH ICON
<AppButton icon={<Plus className="w-4 h-4" />}>Add Medicine</AppButton>
<AppButton icon={<Download className="w-4 h-4" />} variant="outline">Export</AppButton>
```

#### Rules

```jsx
// ✅ Correct
<AppButton variant="danger" loading={deleting} onClick={handleDelete}>
  Delete Batch
</AppButton>

// ❌ Wrong — raw button
<button className="bg-red-600 text-white px-4 py-2 rounded">Delete Batch</button>

// ❌ Wrong — hardcoded color on AppButton
<AppButton className="bg-red-600">Delete</AppButton>  // className is for layout only

// ❌ Wrong — font-medium on button text (AppButton handles this automatically)
<AppButton className="font-medium">Save</AppButton>

// ❌ Wrong — dark text on brand bg
<button className="bg-brand text-gray-900">Save</button>  // must be text-white
```

#### className prop rule
`className` on AppButton accepts **layout overrides only** — width, margin, display.
Never use it to override colors, padding, or font weight.
```jsx
<AppButton className="w-full">Full width</AppButton>        // ✅ layout
<AppButton className="mt-4">Spaced</AppButton>              // ✅ layout
<AppButton className="bg-green-600">Wrong</AppButton>       // ❌ color override
```

---

### 2.2 Input

Always use Shadcn `<Input>` for text inputs. Never raw `<input>` unless inside a Shadcn form.

```jsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Standard field
<div>
  <Label htmlFor="name">Patient Name <span className="text-red-500">*</span></Label>
  <Input
    id="name"
    type="text"
    placeholder="Enter name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    data-testid="patient-name-input"
  />
  <p className="text-xs text-gray-500 mt-1">Helper text here</p>
</div>

// Error state
<Input className="border-red-500 focus:ring-red-500" />
<p className="text-xs text-red-600 mt-1">This field is required</p>
```

---

### 2.3 Select

Always use Shadcn `<Select>` or native `<select>` with consistent classes.

```jsx
// Native select (for simple cases)
<select
  value={value}
  onChange={(e) => setValue(e.target.value)}
  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
>
  <option value="">All Categories</option>
  {options.map(o => <option key={o} value={o}>{o}</option>)}
</select>
```

---

### 2.4 StatusBadge

```jsx
import { StatusBadge, PaymentStatusBadge, CustomerTypeBadge } from '@/components/shared';

<StatusBadge status="paid" />                          // → green "Paid"
<StatusBadge status="due" />                           // → amber "Due"
<StatusBadge status="cancelled" />                     // → red "Cancelled"
<StatusBadge status="draft" label="Parked" />          // → amber "Parked"
<PaymentStatusBadge status="paid" paymentMethod="upi" /> // → blue "UPI"
<CustomerTypeBadge type="wholesale" />                 // → purple "Wholesale"
```

**Never build a custom badge with hardcoded colors.** Add new statuses to `StatusBadge.jsx`.

---

### 2.5 Checkbox (custom visual)

```jsx
// Custom styled checkbox matching PharmaCare design
import { Check } from 'lucide-react';

<label className="flex items-center gap-2 cursor-pointer">
  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center
    ${checked ? 'bg-brand border-brand' : 'border-gray-300'}`}>
    {checked && <Check className="w-3.5 h-3.5 text-white" />}
  </div>
  <input type="checkbox" checked={checked} onChange={...} className="sr-only" />
  <span className="text-sm text-gray-700">Label text</span>
</label>
```

---

## PART 3 — MOLECULES

Atoms combined into reusable UI patterns.

---

### 3.1 SearchInput

```jsx
import { SearchInput } from '@/components/shared';

<SearchInput
  value={search}
  onChange={setSearch}
  placeholder="Search medicines..."
  data-testid="inventory-search"
/>
```

---

### 3.2 Form Field (label + input + helper/error)

Standard pattern for every form field:

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1.5">
    Batch Number <span className="text-red-500">*</span>
  </label>
  <Input
    value={form.batchNo}
    onChange={(e) => setForm(p => ({ ...p, batchNo: e.target.value }))}
    placeholder="e.g. BN240501"
    data-testid="batch-no-input"
  />
  {errors.batchNo && (
    <p className="text-xs text-red-600 mt-1">{errors.batchNo}</p>
  )}
  {!errors.batchNo && (
    <p className="text-xs text-gray-500 mt-1">As printed on the box</p>
  )}
</div>
```

---

### 3.3 Filter Bar

Row of filters above a table. Consistent pattern:

```jsx
<div className="flex items-center gap-3 mb-4 flex-wrap">
  <SearchInput value={search} onChange={setSearch} placeholder="Search..." />
  <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand">
    <option value="">All Categories</option>
    {categories.map(c => <option key={c} value={c}>{c}</option>)}
  </select>
  <AppButton variant="outline" icon={<Filter className="w-4 h-4" />} onClick={openFilters}>
    Filters
  </AppButton>
  <AppButton variant="ghost" onClick={clearFilters}>Clear</AppButton>
</div>
```

---

### 3.4 Pill Type Selector

Used for switching between filter states or view modes. Not tabs (no underline).

**Always use the shared `<FilterPills>` component. Never inline this pattern.**

```jsx
import { FilterPills } from '@/components/shared';

const FILTERS = [
  { key: 'all',    label: 'All'    },
  { key: 'cash',   label: 'Cash'   },
  { key: 'credit', label: 'Credit' },
];

<FilterPills options={FILTERS} active={activeFilter} onChange={setActiveFilter} />
```

**Rules:**
- Active pill: `bg-gray-900 text-white` — handled automatically by the component
- Inactive pill: `bg-gray-100 text-gray-600` — handled automatically
- Do NOT use `AppButton` for pill selectors — pills are toggle controls, not action buttons
- Do NOT inline the pill `.map()` pattern — it causes visual drift across pages (this already happened)

---

### 3.5 DataCard (KPI / Metric card)

```jsx
import { DataCard } from '@/components/shared';

<DataCard className="p-6">
  <p className="text-sm text-gray-500 mb-1">Today's Sales</p>
  <p className="text-2xl font-bold text-gray-900 tabular-nums">₹24,500</p>
  <p className="text-xs text-green-600 mt-1">↑ 12% from yesterday</p>
</DataCard>
```

---

## PART 4 — ORGANISMS

Complex, reusable UI sections. All are shared components.

---

### 4.1 PageHeader

**Every page must start with PageHeader. No inline `<h1>` or `<h2>` in page roots.**

```jsx
import { PageHeader } from '@/components/shared';
import { Plus, Download } from 'lucide-react';

// Simple
<PageHeader title="Inventory" />

// With subtitle
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

**Technical detail:**
PageHeader uses `-mx-8 -mt-6 mb-6` to bleed edge-to-edge inside `px-8 py-6` page wrapper.
Do not add extra wrapper divs around PageHeader. Place it as the first child of the page wrapper.

---

### 4.2 PageTabs

**Every multi-view page uses PageTabs. No custom tab UI anywhere.**

```jsx
import { PageTabs } from '@/components/shared';

// Route-based (tab click navigates)
const BILLING_TABS = [
  { key: 'bills',   label: 'Bills',         count: totalBills },
  { key: 'returns', label: 'Sales Returns',  count: totalReturns },
];

<PageTabs
  tabs={BILLING_TABS}
  activeTab="bills"
  onChange={(key) => {
    if (key === 'returns') navigate('/billing/returns');
  }}
/>

// State-based (tab click changes local state)
<PageTabs
  tabs={SETTINGS_TABS}
  activeTab={activeTab}
  onChange={setActiveTab}
/>

// noBleed — for sticky/h-full layouts that don't use px-8 py-6 wrapper
<PageTabs tabs={CUSTOMER_TABS} activeTab={section} onChange={setSection} noBleed />

// With icon
const TABS = [
  { key: 'members', label: 'Members', icon: Users, count: 5 },
  { key: 'roles',   label: 'Roles',   icon: Shield },
];
```

**Tab visual rules:**
- Active: `border-brand text-brand` (blue underline + blue text)
- Inactive: `text-gray-500` with `hover:text-gray-800`
- Count badge active: `bg-brand-subtle text-brand`
- Count badge inactive: `bg-gray-100 text-gray-500`

---

### 4.3 Data Table

Standard table pattern. Every table follows this structure:

```jsx
<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
  {/* Optional filter bar */}
  <div className="px-6 py-4 border-b border-gray-100">
    {/* filters here */}
  </div>

  {/* Table */}
  <div className="overflow-x-auto">
    <table className="w-full" data-testid="bills-table">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Bill No.
          </th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Amount
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-12 text-center">
              <BillingEmptyState />
            </td>
          </tr>
        ) : (
          items.map(item => (
            <tr key={item.id} className="hover:bg-brand-tint">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {item.bill_number}
              </td>
              <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right text-gray-900">
                ₹{(item.total_amount / 100).toFixed(2)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>

  {/* Optional footer with pagination */}
  <div className="px-6 py-4 border-t border-gray-100">
    <PaginationBar ... />
  </div>
</div>
```

**Table rules:**
- Header bg: `bg-gray-50`
- Row divider: `divide-y divide-gray-100`
- Row hover: `hover:bg-brand-tint`
- Money columns: right-aligned, `font-semibold tabular-nums`
- Primary column: `font-medium text-gray-900`
- Empty state: always an EmptyState component, never just text

---

### 4.4 EmptyState

```jsx
import {
  EmptyState,
  BillingEmptyState,
  InventoryEmptyState,
  PurchasesEmptyState,
  SalesReturnsEmptyState,
  PurchaseReturnsEmptyState,
  SuppliersEmptyState,
  CustomersEmptyState,
  SearchEmptyState,
  ErrorEmptyState
} from '@/components/shared';

// Domain-specific (preferred)
<BillingEmptyState />
<InventoryEmptyState />

// Search returned nothing
<SearchEmptyState query={search} />

// API/network error
<ErrorEmptyState onRetry={fetchData} />

// Generic with custom message
<EmptyState
  title="No batches found"
  description="Add stock to see batches here"
  action={<AppButton icon={<Plus />}>Add Stock</AppButton>}
/>
```

**Rules:**
- Every table's empty state uses a component — never just "No data found" text
- `ErrorEmptyState` must always include a retry action (`onRetry` prop)
- Never show an empty white box with no content

---

## PART 5 — LAYOUTS

---

### 5.1 Standard Page Layout

Every page follows this exact structure. No deviations.

```jsx
export default function BillingPage() {
  return (
    <div className="px-8 py-6 min-h-screen bg-[#F8FAFB]">

      {/* 1. Header — always first */}
      <PageHeader
        title="Billing"
        subtitle="Manage bills and sales returns"
        actions={<AppButton icon={<Plus />}>New Bill</AppButton>}
      />

      {/* 2. Tabs — if page has multiple views */}
      <PageTabs tabs={BILLING_TABS} activeTab="bills" onChange={handleTabChange} />

      {/* 3. Content — white card(s) */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* table, form, etc. */}
      </div>

    </div>
  );
}
```

**Rules:**
- Page wrapper: always `px-8 py-6 min-h-screen bg-[#F8FAFB]`
- Never add extra padding inside page wrapper — PageHeader and PageTabs handle their own spacing
- Content card: `bg-white rounded-xl border border-gray-200`
- Multiple cards: `space-y-6` between them

---

### 5.2 Sticky Sidebar Layout (Customers page pattern)

For pages that need a fixed left panel + scrollable right content:

```jsx
<div className="flex h-full">
  {/* Left panel — fixed */}
  <div className="w-80 border-r border-gray-200 flex flex-col h-full bg-white">
    <PageTabs tabs={TABS} activeTab={section} onChange={setSection} noBleed />
    {/* list content */}
  </div>

  {/* Right panel — scrollable */}
  <div className="flex-1 overflow-y-auto p-6">
    {/* detail content */}
  </div>
</div>
```

---

### 5.3 Modal Layout (Shadcn Dialog)

For confirmations, small forms. Max width 480px.

```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Confirm Delete</DialogTitle>
    </DialogHeader>
    <div className="py-4">
      {/* content */}
    </div>
    <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
      <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
      <AppButton variant="danger" loading={loading} onClick={handleConfirm}>Delete</AppButton>
    </div>
  </DialogContent>
</Dialog>
```

---

### 5.4 Sheet Layout (right-side drawer — IN PROGRESS)

For data-entry forms (new bill, add medicine, new purchase).
Uses Shadcn `<Sheet>` with `side="right"`, 480px wide.

```jsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

<Sheet open={open} onOpenChange={onClose}>
  <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
    <SheetHeader>
      <SheetTitle>New Bill</SheetTitle>
    </SheetHeader>
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {/* form fields */}
      </div>
      <div className="border-t border-gray-100 pt-4 flex items-center gap-2">
        <AppButton className="flex-1" loading={saving}>Save Bill</AppButton>
        <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
      </div>
    </div>
  </SheetContent>
</Sheet>
```

**Rule:** All new data-entry forms must use Sheet, not centered Dialog.
Centered dialogs are only for confirmations and alerts.

---

## PART 6 — STATES

Every interactive section must handle all four states. No exceptions.

---

### 6.1 Loading State

```jsx
import { TableSkeleton, InlineLoader, PageSkeleton, CardSkeleton } from '@/components/shared';

// Full page loading
if (loading && !data) return <PageSkeleton />;

// Table loading
<TableSkeleton rows={8} columns={6} />

// Inline loader (inside a section)
<InlineLoader text="Loading medicines..." />

// Card skeleton (KPI cards loading)
<CardSkeleton />
```

**Rules:**
- Never show an empty table while loading — show TableSkeleton
- Never use a spinner icon manually — use InlineLoader
- Page-level loading: PageSkeleton
- Do not block the entire page if only one section is loading

---

### 6.2 Empty State

```jsx
// No data yet (first time)
<BillingEmptyState />   // shows icon + "No bills yet" + CTA

// Search returned nothing
<SearchEmptyState query={search} />   // shows "No results for 'xyz'"

// Filtered to zero
<EmptyState
  title="No results"
  description="Try clearing your filters"
  action={<AppButton variant="ghost" onClick={clearFilters}>Clear Filters</AppButton>}
/>
```

---

### 6.3 Error State

```jsx
import { ErrorEmptyState } from '@/components/shared';

// Network error — always show retry
<ErrorEmptyState onRetry={fetchData} />

// Inline field error
<p className="text-xs text-red-600 mt-1">This field is required</p>

// Toast error (API failure)
import { toast } from 'sonner';
toast.error('Failed to save. Please try again.');
```

**Rules:**
- Never silent failures — always show a toast or inline error
- Network errors always include a retry button
- Form validation errors show inline below the field, not in a toast

---

### 6.4 Success State

```jsx
// Toast for save/update/delete actions
toast.success('Bill saved successfully');
toast.success('Stock updated');

// Inline confirmation (rare — for important actions)
<div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
  <CheckCircle className="w-4 h-4" />
  <span className="text-sm">Sequence saved</span>
</div>
```

---

## PART 7 — FEEDBACK COMPONENTS

---

### 7.1 Toast Notifications

```jsx
import { toast } from 'sonner';

toast.success('Bill INV-000042 created');
toast.error('Failed to connect. Check your network.');
toast.warning('Stock below reorder level for 3 items');
toast.info('GST report is being generated...');
```

**Rules:**
- Success toast: always mention what was done (`'Bill saved'` not just `'Saved'`)
- Error toast: always say what failed + what to do (`'Failed to save. Try again.'`)
- Never show toast for non-user-initiated events
- Max one toast visible at a time for the same action

---

### 7.2 Confirm Dialog

```jsx
import { ConfirmDialog, DeleteConfirmDialog, DiscardConfirmDialog } from '@/components/shared';

// Generic confirm
<ConfirmDialog
  open={showConfirm}
  title="Settle Bill?"
  description="This will finalise the bill and assign a bill number. This cannot be undone."
  confirmLabel="Settle"
  onConfirm={handleSettle}
  onCancel={() => setShowConfirm(false)}
/>

// Delete confirm (red CTA)
<DeleteConfirmDialog
  open={showDelete}
  itemName="Batch BN240501"
  onConfirm={handleDelete}
  onCancel={() => setShowDelete(false)}
/>

// Discard unsaved changes
<DiscardConfirmDialog
  open={showDiscard}
  onConfirm={() => { navigate(-1); }}
  onCancel={() => setShowDiscard(false)}
/>
```

---

## PART 8 — SIDEBAR

Defined in `frontend/src/components/Layout.js`. Do not rebuild this — modify it.

| Property | Value |
|----------|-------|
| Width | `200px` fixed |
| Background | `#1a2332` (dark navy) |
| Inactive item | `text-gray-300` |
| Active item | `bg-blue-600/20 text-white` |
| Hover | `bg-white/5 hover:text-white` |
| Icon size | `w-4 h-4` |
| Item height | `h-9` |
| Font | `text-[13px] font-medium` |

### Nav Groups (exact order — do not change without product approval)

```
DAILY OPS     → Dashboard, Billing, Inventory, Purchases
RELATIONSHIPS → Customers, Suppliers
REPORTS       → Reports
COMPLIANCE    → Sch H1 Register, Audit Log
ADMIN         → Settings, Team
```

**GST Report and Stock Log are NOT in the sidebar.**
They are accessed via tabs inside Reports and Inventory respectively.

---

## PART 9 — ICONS

Use **Lucide React** exclusively. No other icon library.

```jsx
import { Plus, Trash2, Edit2, Search, Filter, Download, Printer, X, Check } from 'lucide-react';

// Standard sizes
<Plus className="w-4 h-4" />      // inside buttons (16px)
<Search className="w-5 h-5" />    // standalone icons (20px)
<AlertCircle className="w-6 h-6" /> // empty states, alerts (24px)
```

**Rules:**
- Icons in buttons: always `w-4 h-4`
- Icons in empty states: always `w-12 h-12 text-gray-300`
- Icons in alerts/info boxes: always `w-5 h-5` with matching semantic color
- Never use emoji as icons

---

*This document is the law for all visual decisions.*
*When a new pattern is approved and built, it is added here in the same PR.*
*Owner: The developer who establishes the pattern documents it here.*

---

## §8 — Animation & Motion Tokens

**Rule:** Never use arbitrary `duration-[Xms]`. Always use a token.

| Token | Value | Use case |
|-------|-------|----------|
| `duration-fast`   | 100ms | Hover states, button press feedback |
| `duration-base`   | 150ms | Default — color/opacity transitions |
| `duration-slow`   | 250ms | Modal open, dropdown appear |
| `duration-slower` | 350ms | Sheet/drawer slide-in, page transitions |

**Easing:**
- Entrances: `ease-out-smooth` (`cubic-bezier(0.16, 1, 0.3, 1)`)
- Exits/dismissals: `ease-in-smooth` (`cubic-bezier(0.4, 0, 1, 1)`)
- Simple color/opacity: `ease-out` (Tailwind default — acceptable)

**Examples:**
```jsx
// Button hover
className="transition-colors duration-fast"

// Modal backdrop
className="transition-opacity duration-slow"

// Sheet drawer
className="transition-transform duration-slower ease-out-smooth"
```

**Anti-patterns:**
```jsx
// ❌ Arbitrary duration
className="duration-[200ms]"

// ❌ No easing on Sheet — looks mechanical
className="transition-transform duration-slower"  // missing ease-out-smooth
```
