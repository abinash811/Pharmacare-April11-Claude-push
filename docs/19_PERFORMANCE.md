# PharmaCare — Performance
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Pharmacists open this app 50+ times a day. Every second of delay compounds into frustration.

---

## TARGETS

| Metric | Target | Why |
|--------|--------|-----|
| First Contentful Paint (FCP) | < 1.5s | First screen visible fast |
| Largest Contentful Paint (LCP) | < 2.5s | Main content visible |
| Time to Interactive (TTI) | < 3.5s | User can act quickly |
| Cumulative Layout Shift (CLS) | < 0.1 | No jarring reflows |
| API response time (P95) | < 500ms | Data loads feel instant |
| Bundle size (initial JS) | < 250KB gzipped | Fast on clinic wifi |
| Lighthouse score | ≥ 90 | Benchmark target |

---

## FRONTEND PERFORMANCE

### Code splitting — lazy load routes

Never load every page upfront. Split at the route level.

```jsx
// ✅ Correct — lazy load every route
import { lazy, Suspense } from 'react';

const BillingPage = lazy(() => import('@/pages/BillingPage'));
const InventoryPage = lazy(() => import('@/pages/InventoryPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));

// Wrap in Suspense with fallback
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/billing" element={<BillingPage />} />
    <Route path="/inventory" element={<InventoryPage />} />
    <Route path="/reports" element={<ReportsPage />} />
  </Routes>
</Suspense>

// ❌ Eager import of all pages
import BillingPage from '@/pages/BillingPage';
import InventoryPage from '@/pages/InventoryPage';
// All pages bundled into main chunk — slow initial load
```

### Heavy components — lazy load below the fold

```jsx
// ✅ PDF viewer, charts, bulk upload — lazy load
const BillPdfViewer = lazy(() => import('@/components/BillPdfViewer'));
const SalesChart = lazy(() => import('@/components/SalesChart'));

// ✅ Show skeleton while loading
<Suspense fallback={<CardSkeleton />}>
  <SalesChart data={salesData} />
</Suspense>
```

### Images and assets

```jsx
// ✅ Pharmacy logo — specify dimensions to prevent CLS
<img
  src={pharmacy.logo_url}
  alt={pharmacy.name}
  width={120}
  height={40}
  loading="lazy"
/>

// ✅ Use WebP format for logos/images where possible

// ❌ Missing dimensions — causes layout shift
<img src={pharmacy.logo_url} />
```

---

## API PERFORMANCE

### Pagination — always

Never return unbounded lists. All list endpoints must paginate.

```python
# ✅ Always paginate
@router.get("/api/invoices")
async def get_invoices(
    page: int = 1,
    page_size: int = Query(default=20, le=100),
    ...
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Invoice)
        .where(Invoice.pharmacy_id == pharmacy_id)
        .order_by(Invoice.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

# ❌ Never return all records
result = await db.execute(select(Invoice).where(...))
return result.scalars().all()   # could be 10,000 rows
```

### Database query rules

```python
# ✅ Select only needed columns for list views
result = await db.execute(
    select(
        Invoice.id,
        Invoice.bill_number,
        Invoice.customer_name,
        Invoice.grand_total_paise,
        Invoice.status,
        Invoice.created_at,
    )
    .where(Invoice.pharmacy_id == pharmacy_id)
)

# ❌ SELECT * on large tables
result = await db.execute(select(Invoice))  # fetches all columns including large JSON fields

# ✅ Use indexes — every where clause column should be indexed
# pharmacy_id, created_at, status, is_deleted
# See 09_DATABASE.md for index rules

# ✅ Avoid N+1 queries — use joinedload or selectinload
from sqlalchemy.orm import joinedload

result = await db.execute(
    select(Invoice)
    .options(joinedload(Invoice.items))   # load items in same query
    .where(Invoice.id == invoice_id)
)

# ❌ N+1 — 1 query per item
for invoice in invoices:
    items = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))
```

### Search performance

```python
# ✅ Use database-side search — never Python-side filter
result = await db.execute(
    select(Product)
    .where(Product.pharmacy_id == pharmacy_id)
    .where(
        or_(
            Product.name.ilike(f"%{search}%"),
            Product.sku.ilike(f"%{search}%"),
        )
    )
    .limit(20)
)

# ❌ Fetch all then filter in Python
all_products = await get_all_products()
filtered = [p for p in all_products if search in p.name]  # scans everything
```

---

## FRONTEND DATA FETCHING

### Debounce search inputs

```jsx
// ✅ Debounce — don't hit API on every keystroke
import { useMemo } from 'react';
import { debounce } from 'lodash-es';

const debouncedSearch = useMemo(
  () => debounce((value) => fetchProducts(value), 300),
  []
);

<SearchInput onChange={debouncedSearch} />

// ❌ API call on every character
<SearchInput onChange={(value) => fetchProducts(value)} />
```

### Avoid unnecessary re-renders

```jsx
// ✅ Memoize expensive computations
const totalGst = useMemo(
  () => items.reduce((sum, item) => sum + item.gst_paise, 0),
  [items]
);

// ✅ Memoize stable callbacks passed to children
const handleDelete = useCallback((id) => {
  deleteInvoice(id);
}, []);

// ❌ Inline functions in JSX create new reference on every render
<BillsTable onDelete={(id) => deleteInvoice(id)} />
// Use useCallback instead
```

### List rendering

```jsx
// ✅ Always provide stable keys
{bills.map(bill => (
  <BillRow key={bill.id} bill={bill} />   // UUID — stable
))}

// ❌ Index as key — breaks reconciliation when list changes
{bills.map((bill, index) => (
  <BillRow key={index} bill={bill} />
))}
```

---

## BUNDLE SIZE RULES

### Import only what you use

```jsx
// ✅ Named imports — tree-shakeable
import { format, parseISO } from 'date-fns';
import { debounce } from 'lodash-es';

// ❌ Default import of entire library
import _ from 'lodash';           // entire lodash in bundle
import moment from 'moment';      // 329KB — banned. Use date-fns.
```

### Banned heavy libraries

| Library | Reason | Alternative |
|---------|--------|------------|
| `moment` | 329KB, unmaintained | `date-fns` |
| `lodash` (default import) | Entire bundle | `lodash-es` named imports |
| `@mui/material` | Conflicts with Shadcn | Shadcn/UI only |
| `axios` (direct in components) | Bypasses interceptor | `src/lib/axios.js` instance only |

---

## BACKEND PERFORMANCE

### Async everywhere

```python
# ✅ All DB operations must be async
async def get_invoices(db: AsyncSession):
    result = await db.execute(select(Invoice))

# ❌ Blocking sync calls in async context
import time
time.sleep(1)   # blocks the event loop — freezes all requests
```

### Connection pooling

SQLAlchemy async engine is configured with a connection pool. Do not create new engines per request.

```python
# ✅ Single engine at app startup (in database.py)
engine = create_async_engine(DATABASE_URL, pool_size=10, max_overflow=20)

# ❌ Creating engine per request
@router.get("/api/invoices")
async def get_invoices():
    engine = create_async_engine(DATABASE_URL)  # new connection every request
```

---

## CHECKLIST (before every PR)

- [ ] All routes are lazy-loaded with `React.lazy()`
- [ ] All list endpoints paginate (max 100 per page)
- [ ] No `SELECT *` on large tables
- [ ] Search inputs are debounced (300ms)
- [ ] No N+1 queries — use `joinedload` or `selectinload`
- [ ] `moment` not imported anywhere — use `date-fns`
- [ ] `lodash` only as named imports from `lodash-es`
- [ ] List renders use stable UUID keys, not array index
- [ ] Heavy components (charts, PDF viewer) are lazy-loaded
