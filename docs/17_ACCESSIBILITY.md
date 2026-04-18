# PharmaCare — Accessibility
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: WCAG AA compliance is non-negotiable. Pharmacy staff use this 8+ hours a day.

---

## WHY THIS MATTERS FOR PHARMACARE

Pharmacists and billing staff use this software all day. Poor accessibility means:
- Eye strain from low contrast
- Repetitive strain from mouse-only workflows
- Errors from unclear form labels
- Slower work from missing keyboard shortcuts

This is a B2B productivity tool. WCAG AA is the minimum — not a nice-to-have.

---

## COLOUR CONTRAST (WCAG AA)

Minimum contrast ratios:

| Text type | Minimum ratio | Our tokens |
|-----------|--------------|-----------|
| Normal text (< 18px) | 4.5:1 | `text-gray-900` on `bg-white` ✅ |
| Large text (≥ 18px bold) | 3:1 | Page titles ✅ |
| UI components (buttons, inputs) | 3:1 | `bg-brand` border ✅ |
| Disabled elements | No requirement | `opacity-50` acceptable |

```jsx
// ✅ Passes contrast
<p className="text-gray-900">Invoice total</p>          // 16:1 on white
<p className="text-gray-600">Supporting text</p>         // 7:1 on white
<p className="text-gray-500">Helper text</p>             // 4.6:1 on white ✅ (just passes)

// ❌ Fails contrast
<p className="text-gray-400">Label text</p>              // 3.5:1 — FAIL for normal text
<p className="text-white" style="bg-brand">Button</p>    // verify brand color passes 4.5:1
```

**Banned for body text:** `text-gray-300`, `text-gray-400` — too low contrast on white.

---

## FOCUS MANAGEMENT

Every interactive element must have a visible focus ring. Keyboard users navigate the entire app via Tab.

```jsx
// ✅ Shadcn components include focus rings by default
// AppButton already has focus-visible:ring-2

// ✅ Custom interactive elements must add focus ring explicitly
<div
  role="button"
  tabIndex={0}
  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>

// ❌ Never remove focus ring without replacement
<button className="outline-none">   // keyboard users are now lost
<button className="focus:outline-none">
```

---

## ARIA LABELS

### When to use `aria-label`

```jsx
// ✅ Icon-only buttons MUST have aria-label
<AppButton variant="ghost" iconOnly icon={<Trash2 />} aria-label="Delete invoice" />
<AppButton variant="ghost" iconOnly icon={<Edit />} aria-label="Edit product" />

// ✅ Inputs with no visible label
<input aria-label="Search invoices" placeholder="Search..." />

// ✅ Status that changes dynamically
<div aria-live="polite" aria-atomic="true">
  {isLoading ? 'Loading invoices...' : `${total} invoices found`}
</div>
```

### When NOT to use `aria-label`

```jsx
// ❌ Don't duplicate visible text with aria-label
<button aria-label="Save">Save</button>   // redundant — screen reader reads "Save" twice

// ✅ Just the button text is enough
<AppButton>Save</AppButton>
```

### Form labels

```jsx
// ✅ Every input has an associated label
<div>
  <label htmlFor="customer-name">Customer Name</label>
  <input id="customer-name" type="text" />
</div>

// ✅ Or use aria-labelledby
<label id="gst-label">GST Rate</label>
<select aria-labelledby="gst-label">

// ❌ Placeholder is NOT a label — it disappears when user types
<input placeholder="Customer Name" />   // no label — screen reader gets nothing
```

---

## KEYBOARD NAVIGATION

### Tab order

Elements must be reachable via Tab in logical reading order (left-to-right, top-to-bottom).

```jsx
// ✅ Natural DOM order = natural tab order (preferred)
// Don't use tabIndex > 0 — it breaks natural order

// ✅ tabIndex={0} — adds to tab order at natural position
<div role="button" tabIndex={0}>Custom interactive</div>

// ✅ tabIndex={-1} — focusable programmatically but not in tab order
<div ref={errorRef} tabIndex={-1}>Error message</div>   // focus here on error

// ❌ tabIndex > 0 — breaks tab order
<button tabIndex={3}>Save</button>
```

### Keyboard interactions for custom components

| Component | Keys required |
|-----------|-------------|
| Button | `Enter`, `Space` to activate |
| Dropdown / Select | `Arrow Up/Down` to navigate, `Enter` to select, `Esc` to close |
| Modal / Sheet | `Esc` to close, focus trapped inside |
| Table rows (clickable) | `Enter` to activate row |
| Tabs | `Arrow Left/Right` to switch tabs |

```jsx
// ✅ Sheet/Modal must trap focus
// Shadcn's <Dialog> and <Sheet> handle focus trap automatically
// Never build a modal without focus trapping

// ✅ Esc closes all overlays
// Shadcn handles this — do not override or block it
```

---

## SEMANTIC HTML

Use the right element for the job. Screen readers use semantics to understand page structure.

```jsx
// ✅ Correct semantic elements
<main>Page content</main>
<nav>Sidebar navigation</nav>
<header>Page header</header>
<table> with <thead>, <tbody>, <th scope="col">

// ✅ Headings in logical order
<h1>PharmaCare</h1>       // one per page (in app shell)
<h2>Billing</h2>          // PageHeader title maps to h2
<h3>Bill Items</h3>       // section within the page

// ❌ Heading levels skipped
<h1>Title</h1>
<h4>Section</h4>   // skipped h2, h3 — screen reader hierarchy broken

// ❌ Div soup for interactive elements
<div onClick={handleClick}>Delete</div>   // not keyboard accessible, no role
// Use AppButton instead
```

---

## LOADING AND ERROR STATES

Assistive technologies must be informed of dynamic changes.

```jsx
// ✅ Loading state — announce to screen readers
<div aria-busy={isLoading} aria-label="Loading invoices">
  {isLoading ? <TableSkeleton /> : <BillsTable />}
</div>

// ✅ Error state — move focus to error message
const errorRef = useRef(null);
useEffect(() => {
  if (error) errorRef.current?.focus();
}, [error]);

<div ref={errorRef} tabIndex={-1} role="alert" className="text-red-600">
  {error}
</div>

// ✅ Live region for status updates (toasts, counts)
<div aria-live="polite">
  {successMessage}
</div>
```

---

## FORMS

```jsx
// ✅ Required fields
<label htmlFor="doctor-name">
  Doctor Name
  <span aria-hidden="true" className="text-red-500 ml-1">*</span>
  <span className="sr-only">(required)</span>
</label>
<input
  id="doctor-name"
  required
  aria-required="true"
  aria-describedby="doctor-name-error"
/>
{error && (
  <p id="doctor-name-error" role="alert" className="text-xs text-red-600 mt-1">
    {error.message}
  </p>
)}
```

---

## TABLES

Billing and inventory are table-heavy. Tables must be accessible.

```jsx
// ✅ Correct table structure
<table>
  <thead>
    <tr>
      <th scope="col">Bill Number</th>
      <th scope="col">Customer</th>
      <th scope="col" className="text-right">Amount</th>
      <th scope="col"><span className="sr-only">Actions</span></th>
    </tr>
  </thead>
  <tbody>
    {bills.map(bill => (
      <tr key={bill.id}>
        <td>{bill.bill_number}</td>
        <td>{bill.customer_name}</td>
        <td className="text-right tabular-nums">{formatCurrency(bill.grand_total_paise)}</td>
        <td>
          <AppButton variant="ghost" iconOnly icon={<Eye />} aria-label={`View bill ${bill.bill_number}`} />
        </td>
      </tr>
    ))}
  </tbody>
</table>

// ❌ Missing th scope — screen readers cannot associate headers with cells
<th>Bill Number</th>   // needs scope="col"

// ❌ Empty th with no sr-only label — screen readers announce empty cell
<th></th>
```

---

## CHECKLIST (before every PR)

- [ ] All icon-only buttons have `aria-label`
- [ ] All form inputs have associated `<label>` with `htmlFor`
- [ ] No `outline-none` without a replacement focus style
- [ ] No `text-gray-300` or `text-gray-400` for body text
- [ ] All table headers have `scope="col"`
- [ ] Dynamic content changes use `aria-live` or `role="alert"`
- [ ] All modals and sheets trap focus (use Shadcn components)
- [ ] Esc closes all overlays — never blocked
- [ ] Loading states use `aria-busy`
