# PharmaCare — Architecture
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Every architectural decision is recorded here with its reasoning.
#        Before making a structural change, read this file.
#        When a new decision is made, add an ADR (Architecture Decision Record) here.

---

## SYSTEM OVERVIEW

```
Browser (React)
     │
     │ HTTP/REST (JSON)
     ▼
FastAPI (Python) — port 8000
     │
     │ SQLAlchemy async
     ▼
PostgreSQL — single database
```

PharmaCare is a standard client-server web application.
No message queues, no microservices, no caching layer in Phase 1.
Keep it simple until scale demands complexity.

---

## TECH STACK

### Frontend

| Technology | Version | Why |
|-----------|---------|-----|
| React | 18 | Component model, ecosystem, team familiarity |
| Tailwind CSS | 3 | Utility-first, design tokens via config, no runtime overhead |
| Shadcn/UI | latest | Accessible primitives, unstyled base, owns the code |
| Lucide React | latest | Consistent icon set, tree-shakeable |
| React Router | 6 | Client-side routing, nested routes |
| Axios | latest | HTTP client with interceptors for auth and error handling |
| Sonner | latest | Toast notifications |
| date-fns | latest | Date manipulation (Indian FY, expiry calculations) |

**Not used and never add:**
- ❌ Ant Design, MUI, Chakra — we use Shadcn/UI exclusively
- ❌ Redux, Zustand, Jotai — no global state management needed yet
- ❌ React Query / SWR — custom hooks handle data fetching for now
- ❌ Styled-components, Emotion — we use Tailwind exclusively

### Backend

| Technology | Version | Why |
|-----------|---------|-----|
| Python | 3.11+ | Async support, typing, ecosystem |
| FastAPI | latest | Async-native, auto-docs, Pydantic validation |
| SQLAlchemy | 2.0 async | Type-safe ORM, async sessions, migration support |
| Alembic | latest | DB migrations — version-controlled schema changes |
| Pydantic v2 | latest | Request/response validation, settings management |
| asyncpg | latest | Async PostgreSQL driver |
| python-jose | latest | JWT token generation and validation |
| passlib | latest | Password hashing (bcrypt) |

### Database

| Technology | Why |
|-----------|-----|
| PostgreSQL 14+ | ACID compliance, JSON support, sequences for bill numbers, proven at scale |

**Not SQLite:** No concurrent write safety. Not production-grade.
**Not MongoDB:** Pharmacy data is relational. Joins are essential. ACID is non-negotiable.

---

## FRONTEND ARCHITECTURE

### Directory Structure

```
frontend/src/
├── App.js                    ← Root component, AuthContext, routes
├── components/
│   ├── shared/               ← Shared design system components (AppButton, PageHeader, etc.)
│   │   └── index.js          ← Single export barrel — always import from here
│   ├── Layout.js             ← App shell: sidebar + main content area
│   └── ui/                   ← Shadcn/UI primitives — DO NOT MODIFY
├── pages/                    ← One folder per feature/route
│   ├── BillingOperations.js  ← /billing — orchestrator only
│   ├── Customers/
│   │   ├── index.jsx         ← Orchestrator (state + composition)
│   │   ├── hooks/
│   │   │   └── useCustomers.js
│   │   └── components/
│   │       ├── CustomerList.jsx
│   │       └── CustomerDetail.jsx
│   └── ...
├── constants/
│   ├── api.js / api.ts       ← All API URL builders
│   ├── routes.js             ← Route constants
│   └── pharmacy.js           ← Pharmacy-level constants
├── hooks/
│   ├── useApiCall.js         ← Generic API call wrapper with loading/error state
│   ├── usePagination.js      ← Pagination state and calculations
│   └── useDebounce.js        ← Debounce for search inputs
├── lib/
│   └── axios.js              ← Single configured axios instance
└── utils/
    ├── currency.js           ← formatCurrency(paise) and related
    └── dates.js              ← isExpired(), isExpiringSoon(), formatExpiry()
```

### Page Anatomy Rule

Every page orchestrator follows this exact pattern:

```jsx
// ✅ Correct — orchestrator imports components, holds state, no JSX logic
export default function BillingPage() {
  const { bills, loading, fetchBills } = useBills();
  const [activeTab, setActiveTab] = useState('bills');

  return (
    <div className="px-8 py-6 min-h-screen bg-[#F8FAFB]">
      <PageHeader title="Billing" actions={...} />
      <PageTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <BillsTable bills={bills} loading={loading} />
    </div>
  );
}

// ❌ Wrong — inline JSX logic in orchestrator
export default function BillingPage() {
  return (
    <div>
      <h1>Billing</h1>
      <table>
        {bills.map(bill => (
          <tr key={bill.id}>
            <td>{bill.bill_number}</td>
            ...200 more lines...
          </tr>
        ))}
      </table>
    </div>
  );
}
```

### File Size Rule

**Max 300 lines per file.** If a file exceeds 300 lines, split it.

```
Page file > 300 lines?
  → Extract sub-components to components/ subfolder

Component > 300 lines?
  → Split by responsibility

Hook > 300 lines?
  → Split into multiple hooks
```

### State Management

No global state manager. State lives at the right level:

| State type | Where it lives | Example |
|-----------|---------------|---------|
| Server data | Page-level hook | `useBills()` in BillingPage |
| UI state | Component | `useState` for modal open/close |
| Form state | Form component | `useState` or react-hook-form |
| Auth state | `AuthContext` in App.js | `const { user } = useContext(AuthContext)` |

### API Calls

All API calls go through the single axios instance:

```jsx
// ✅ Correct
import api from '@/lib/axios';

const { data } = await api.get('/invoices', { params: { page: 1 } });
const { data } = await api.post('/invoices', payload);

// ❌ Wrong — raw axios
import axios from 'axios';
const { data } = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/invoices`);

// ❌ Wrong — manual Authorization header
const { data } = await axios.get('/api/invoices', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});
// → The axios instance interceptor handles this automatically
```

### Auth Flow

```
1. User submits login form
2. POST /api/auth/login → receives { user, token }
3. token stored in localStorage
4. AuthContext.login(user, token) updates app state
5. axios interceptor reads token from localStorage on every request
6. On 401 response → interceptor clears localStorage, redirects to /
```

---

## BACKEND ARCHITECTURE

### Directory Structure

```
backend/
├── main.py              ← FastAPI app, middleware, router registration, startup seeder
├── config.py            ← Settings from .env via pydantic-settings
├── database.py          ← Async engine, session factory, Base class
├── deps.py              ← Re-exports get_db for router imports
├── constants.py         ← DEFAULT_ROLES and app-level constants
├── models/              ← SQLAlchemy ORM models (one file per domain)
│   ├── billing.py       ← Bill, BillItem, ScheduleH1Register, SalesReturn
│   ├── products.py      ← Product, StockBatch, StockMovement
│   ├── purchases.py     ← Purchase, PurchaseItem
│   ├── customers.py     ← Customer, Doctor
│   ├── suppliers.py     ← Supplier
│   ├── pharmacy.py      ← Pharmacy, PharmacySettings
│   └── users.py         ← User, Role, AuditLog
├── routers/             ← FastAPI route handlers (one file per domain)
│   ├── auth.py          ← /auth/login, /auth/register, /auth/me
│   ├── auth_helpers.py  ← JWT decode, get_current_user dependency
│   ├── billing.py       ← /invoices, /payments, /refunds, /audit-logs
│   ├── inventory.py     ← /products, /stock-movements
│   ├── batches.py       ← /batches
│   ├── purchases.py     ← /purchases
│   ├── purchase_returns.py
│   ├── sales_returns.py
│   ├── customers.py     ← /customers, /doctors
│   ├── suppliers.py     ← /suppliers
│   ├── reports.py       ← /reports/*, /gst-report
│   ├── settings.py      ← /settings/*, /bill-sequences
│   └── users.py         ← /users, /roles
├── migrations/          ← Alembic migration files
│   └── versions/        ← One file per migration
├── seed_admin.py        ← Creates default admin user
└── server.py            ← LEGACY MongoDB backup. NEVER RUN. NEVER DELETE.
```

### Request Lifecycle

```
Request arrives
     │
     ▼
CORS middleware (allows frontend origin)
     │
     ▼
Router matches path
     │
     ▼
Depends(get_current_user) → validates JWT → injects user object
Depends(get_db) → creates async DB session
     │
     ▼
Route handler executes
     │
     ├── On success → await db.commit() (auto in get_db context)
     ├── On exception → await db.rollback() (auto in get_db context)
     │
     ▼
Response returned
```

### Database Session Pattern

```python
# get_db in database.py handles commit/rollback automatically
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()    # auto-commit on success
        except Exception:
            await session.rollback()  # auto-rollback on error
            raise
        finally:
            await session.close()

# In routers — just use db, never call commit() manually
@router.post("/invoices")
async def create_bill(data: BillCreate, db: AsyncSession = Depends(get_db)):
    bill = BillORM(...)
    db.add(bill)
    await db.flush()   # get bill.id without committing
    # commit happens automatically when route returns
```

### Auth Pattern

```python
# Every protected route uses Depends(get_current_user)
@router.get("/invoices")
async def get_bills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    # All queries filter by pharmacy_id — multi-tenancy safety
    result = await db.execute(
        select(BillORM).where(BillORM.pharmacy_id == pharmacy_id)
    )
```

**Every query must filter by `pharmacy_id`.** This ensures one pharmacy never sees another's data.

### Error Handling Pattern

```python
# Raise HTTPException for client errors (4xx)
if not product:
    raise HTTPException(status_code=404, detail="Product not found")

if batch.qty_on_hand < quantity:
    raise HTTPException(status_code=400, detail=f"Insufficient stock in batch {batch.batch_number}")

# Let exceptions propagate for server errors (5xx) — FastAPI handles them
```

---

## DATABASE ARCHITECTURE

### Connection

```python
# asyncpg driver (async-native, fastest PostgreSQL driver for Python)
DATABASE_URL = "postgresql+asyncpg://user:pass@localhost:5432/pharmacare"

# Connection pool
pool_size    = 10   # persistent connections
max_overflow = 20   # burst connections
pool_pre_ping = True  # verify connection before use
```

### Multi-tenancy

Every table that holds pharmacy data has a `pharmacy_id` column.
Every query filters by `pharmacy_id`. This is the foundation for future multi-store.

```python
# Every data table
class Bill(Base):
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pharmacies.id"), nullable=False)
    # ...

# Every query
select(Bill).where(Bill.pharmacy_id == pharmacy_id)
```

### Soft Deletes

```python
# All deletable models have
is_deleted: Mapped[bool] = mapped_column(default=False)
deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

# Soft delete
record.is_deleted = True
record.deleted_at = datetime.now(timezone.utc)

# All queries exclude deleted records
select(Product).where(Product.pharmacy_id == pid, Product.is_deleted == False)
```

### Bill Number Sequences

```python
# PharmacySettings stores the sequence state
class PharmacySettings(Base):
    bill_prefix:          str = "INV"
    bill_number_length:   int = 6
    bill_sequence_number: int = 1   # increments on each settled bill

# Increment is part of the same transaction as bill creation
# If bill creation fails → sequence is NOT incremented (rollback)
# Note: current implementation uses DB row lock via SQLAlchemy flush
# Future: migrate to PostgreSQL SEQUENCE for true atomic guarantee
```

### Migrations

All schema changes must go through Alembic. Never ALTER TABLE manually.

```bash
# Create new migration
cd backend
alembic revision --autogenerate -m "add reorder_level to products"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

---

## KEY ARCHITECTURAL DECISIONS (ADRs)

### ADR-001: PostgreSQL over MongoDB
**Date:** April 2026
**Decision:** Migrated from MongoDB to PostgreSQL.
**Reason:** Pharmacy data is inherently relational (products→batches→bill_items→bills). ACID compliance is non-negotiable for financial data. GST calculations and reports require joins. MongoDB aggregation pipelines were complex and error-prone.

### ADR-002: Integer paise for all money
**Date:** April 2026
**Decision:** All monetary values stored and calculated as integer paise (₹1 = 100).
**Reason:** Floating-point arithmetic causes rounding errors in financial calculations. `0.1 + 0.2 = 0.30000000000000004` in both Python and JavaScript. Paise eliminates this entirely.

### ADR-003: Soft deletes only
**Date:** April 2026
**Decision:** No hard deletes anywhere in the system.
**Reason:** Pharmacy data is legal and compliance data. A cancelled bill must exist for audit. A deleted batch must exist for drug recall tracking. The Drug Inspector can ask to see records from 2 years ago.

### ADR-004: Snapshot billing
**Date:** April 2026
**Decision:** Bill items store a copy of product name, MRP, and GST rate at time of sale.
**Reason:** If a product's MRP changes after a bill is created, historical bills must remain accurate. A pharmacist cannot have old bills change retroactively — this would invalidate their GST filings.

### ADR-005: Single axios instance
**Date:** April 2026
**Decision:** All frontend API calls go through `src/lib/axios.js`.
**Reason:** Centralised auth header injection, consistent error handling, easy to change baseURL for different environments. Prevents `axios is not defined` bugs from scattered imports.

### ADR-006: Route-based tabs (not state-based for paired pages)
**Date:** April 2026
**Decision:** Each paired page (billing/returns, purchases/returns, etc.) has its own route. Both render the shared tab bar with the correct active tab.
**Reason:** Deep-linking works. Browser back button works. Each page is independently loadable. Simpler than merging two large components.

### ADR-007: Shadcn/UI exclusively
**Date:** April 2026
**Decision:** Only Shadcn/UI components used. No Ant Design, MUI, Chakra.
**Reason:** Shadcn gives us accessible primitives we own and can modify. No version lock-in. No conflicting CSS. Tailwind integration is seamless.

### ADR-008: No global state manager
**Date:** April 2026
**Decision:** No Redux, Zustand, or similar. State lives in components and hooks.
**Reason:** At current scale, prop drilling + context is sufficient. Adding a state manager adds complexity without solving a real problem we have today. Revisit at Phase 2 (multi-store).

---

## SECURITY RULES

### Authentication
- JWT tokens expire after 8 hours (`ACCESS_TOKEN_EXPIRE_MINUTES = 480`)
- Tokens stored in `localStorage` (acceptable for this use case — pharmacy is a trusted device)
- On 401 → token cleared, user redirected to login
- Passwords hashed with bcrypt via passlib

### Multi-tenancy Safety
- **Every backend query must include `pharmacy_id` filter**
- Never query without `pharmacy_id` on any pharmacy-specific table
- `get_current_user` injects `pharmacy_id` — use it, never trust client-sent `pharmacy_id`

### What Never Goes in Code
```
❌ SECRET_KEY hardcoded
❌ DATABASE_URL hardcoded
❌ Any password or token in source code
✅ All secrets in .env file (never committed)
```

### CORS
```python
# Development: allow all origins (*)
# Production: set CORS_ORIGINS env var to exact frontend domain
CORS_ORIGINS = "https://app.pharmacare.in"
```

---

## PERFORMANCE RULES

### Frontend
- Search inputs are debounced (300ms) — never fire API on every keystroke
- Tables paginate — never load all records at once
- Default page size: 20 records
- Images: none in Phase 1 (medicine names only, no photos)

### Backend
- All queries use `pharmacy_id` index (automatically indexed via FK)
- Reports with date ranges: always add date index to queries
- No N+1 queries — use `joinedload` or explicit joins for related data
- Connection pool: 10 persistent + 20 overflow

### Database
- Every FK column is indexed automatically by PostgreSQL
- `bill_number` has UNIQUE constraint per pharmacy — prevents duplicates at DB level
- `batch_number + product_id` should be unique per pharmacy (future constraint)

---

## WHAT IS `server.py`

`backend/server.py` is the **original MongoDB backend**. It was the first version of PharmaCare before the PostgreSQL migration.

**Rules:**
- ✅ Keep it forever — it is a rollback reference
- ❌ Never run it on port 8000 — that is the active backend
- ❌ Never modify it
- ❌ Never import from it
- ✅ If needed for rollback: `uvicorn server:app --host 0.0.0.0 --port 8001 --reload`

---

*When a new architectural decision is made, add an ADR here.*
*Owner: The developer making the decision documents the reasoning.*
