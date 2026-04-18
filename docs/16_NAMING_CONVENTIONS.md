# PharmaCare — Naming Conventions
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Every name in this codebase follows these rules. No exceptions, no shortcuts.

---

## THE CORE RULE

Names must be **descriptive and unambiguous**. A reader should know what something does without opening it.

```
✅ getUserInvoicesByPharmacy
❌ getUIBP
❌ getData
❌ temp
❌ x
```

---

## FRONTEND NAMING

### Files

| Type | Convention | Example |
|------|-----------|---------|
| React component | `PascalCase.jsx` | `BillingPage.jsx`, `AppButton.jsx` |
| Hook | `camelCase.js` | `useBillForm.js`, `useInventorySearch.js` |
| Utility | `kebab-case.js` | `currency-utils.js`, `date-helpers.js` |
| Test file | Same name + `.test.` | `AppButton.test.jsx`, `currency-utils.test.js` |
| Constants file | `kebab-case.js` | `bill-statuses.js`, `payment-methods.js` |
| Style override | `kebab-case.css` | `print-layout.css` |

```
✅ BillingPage.jsx
✅ useBillForm.js
✅ currency-utils.js
❌ billingPage.jsx       (camelCase for component file)
❌ BillForm_hook.js      (underscore, wrong case)
❌ utils.js              (too vague)
```

### React Components

```jsx
// ✅ PascalCase always
export function BillingPage() {}
export function AppButton() {}
export function ScheduleH1RegisterTable() {}

// ❌ camelCase for components
export function billingPage() {}
export function app_button() {}
```

### Variables and Functions

```js
// ✅ camelCase
const invoiceTotal = 1050;
const isLoading = true;
function fetchInvoiceById(invoiceId) {}
function calculateGstAmount(taxablePaise, gstRate) {}

// ❌ snake_case in JS
const invoice_total = 1050;
function fetch_invoice_by_id(invoice_id) {}

// ❌ Abbreviations
const inv = {};
const amt = 0;
function calcGST() {}   // spell it out: calculateGstAmount
```

### Constants

```js
// ✅ UPPER_SNAKE_CASE
const MAX_ITEMS_PER_BILL = 50;
const DEFAULT_GST_RATE = 5;
const BILL_STATUSES = ['draft', 'paid', 'due', 'partial'];

// ❌ camelCase for constants
const maxItemsPerBill = 50;
const defaultGstRate = 5;
```

### Hooks

```js
// ✅ useCamelCase — always starts with "use"
function useBillForm() {}
function useInventorySearch() {}
function usePharmacySettings() {}

// ❌ Missing "use" prefix
function billForm() {}
function getInventorySearch() {}
```

### Event Handlers

```jsx
// ✅ handleNoun or handleNounVerb
const handleSubmit = () => {};
const handleBillDelete = () => {};
const handleSearchChange = (value) => {};

// ❌ vague or wrong prefix
const onClick = () => {};
const doSubmit = () => {};
const submit = () => {};
```

### Boolean Variables

```js
// ✅ is / has / can / should prefix
const isLoading = true;
const hasItems = items.length > 0;
const canSettle = balance > 0;
const shouldShowDoctor = hasH1Drug;

// ❌ no prefix — ambiguous
const loading = true;
const items = true;
```

---

## BACKEND NAMING (Python)

### Files and Modules

```
routers/          billing.py, inventory.py, purchases.py
models/           invoice.py, product.py, stock_batch.py
schemas/          invoice_schema.py, product_schema.py
```

All Python files: `snake_case.py`

### Functions and Variables

```python
# ✅ snake_case everywhere in Python
def get_invoice_by_id(invoice_id: UUID) -> Invoice:
    pass

pharmacy_id = current_user["pharmacy_id"]
total_gst_paise = cgst_paise + sgst_paise

# ❌ camelCase in Python
def getInvoiceById(invoiceId):
    pass
```

### Classes (Models, Schemas)

```python
# ✅ PascalCase
class Invoice(Base):
    pass

class CreateInvoiceRequest(BaseModel):
    pass

class InvoiceResponse(BaseModel):
    pass
```

### Constants

```python
# ✅ UPPER_SNAKE_CASE
MAX_BILL_ITEMS = 100
DEFAULT_SEQUENCE_LENGTH = 6
SCHEDULE_H1 = "H1"
```

### Pydantic Schema Naming Pattern

```python
# Request body coming IN
class CreateInvoiceRequest(BaseModel): pass
class UpdateProductRequest(BaseModel): pass

# Response going OUT
class InvoiceResponse(BaseModel): pass
class ProductListResponse(BaseModel): pass

# ❌ Vague names
class InvoiceData(BaseModel): pass
class InvoiceModel(BaseModel): pass   # "Model" is ambiguous — is it SQLAlchemy or Pydantic?
```

---

## DATABASE NAMING

### Tables

```sql
-- ✅ plural snake_case
invoices
stock_batches
schedule_h1_registers
audit_logs
pharmacy_settings

-- ❌ singular or camelCase
invoice
StockBatch
scheduleH1Register
```

### Columns

```sql
-- ✅ snake_case, descriptive
pharmacy_id
created_at
updated_at
is_deleted
deleted_at
grand_total_paise
qty_on_hand
bill_number

-- ❌ camelCase or abbreviations
pharmacyId
grandTotPaise
qtyOH
```

### Foreign Keys

```sql
-- ✅ referenced_table_singular_id
pharmacy_id    -- references pharmacies.id
product_id     -- references products.id
batch_id       -- references stock_batches.id
created_by     -- references users.id (action-based, acceptable exception)
```

### Indexes

```sql
-- ✅ idx_table_column
idx_invoices_pharmacy_id
idx_stock_batches_product_id
idx_audit_logs_entity_id
```

---

## API ENDPOINT NAMING

```
# ✅ RESTful, kebab-case, plural nouns
GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/{invoice_id}
PUT    /api/invoices/{invoice_id}
DELETE /api/invoices/{invoice_id}

GET    /api/stock-movements
GET    /api/schedule-h1-register
POST   /api/purchases/{purchase_id}/confirm

# ❌ verb in URL
POST   /api/createInvoice
GET    /api/getInvoices
POST   /api/invoices/doSettle
```

---

## NAMING ANTI-PATTERNS (never use these)

```
❌ data, info, stuff, thing, item (too vague — what data?)
❌ temp, tmp, foo, bar, test (throwaway names in production)
❌ d, e, i, j beyond loop counters
❌ Abbreviations: amt, qty_oh, inv, prod, cust, addr
   Exception: well-known acronyms: GST, MRP, PTR, HSN, UUID, PDF
❌ Hungarian notation: strName, intCount, boolIsActive
❌ Negated booleans: isNotDeleted, hasNoItems (use isDeleted, isEmpty)
```

---

## CHECKLIST (before every PR)

- [ ] All component files are `PascalCase.jsx`
- [ ] All hook files start with `use` and are `camelCase.js`
- [ ] All utility files are `kebab-case.js`
- [ ] No abbreviations (except approved acronyms: GST, MRP, PTR, HSN)
- [ ] All booleans have `is/has/can/should` prefix
- [ ] All event handlers have `handle` prefix
- [ ] All Python functions/vars are `snake_case`
- [ ] All DB columns are `snake_case`
- [ ] No vague names: `data`, `info`, `temp`, `item`
