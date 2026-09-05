# PharmaCare — Security
# Version: 1.2 | Last updated: September 5, 2026
# Type: Reference
# Audience: Claude, all developers
# Rule: Every route is authenticated. Every query is pharmacy-scoped. No exceptions.

---

## CORE SECURITY RULES

1. **Every API route requires a valid JWT.** No public routes except `/api/auth/register`,
   `/api/auth/login`, and `/api/auth/session` (see the tech-debt warning on
   the latter in `docs/10_API.md` — it's a leftover third-party auth path,
   not a designed public route).
2. **Every DB query filters by `pharmacy_id`.** A user from Pharmacy A must never see Pharmacy B's data.
3. **Passwords are bcrypt-hashed.** Never store plain text. Never log passwords.
4. **Tokens expire.** Default: **8 hours** (`ACCESS_TOKEN_EXPIRE_MINUTES=480` in `backend/config.py`). Never issue non-expiring tokens.
5. **Soft deletes only.** `deleted_at` timestamp set (see CLAUDE.md rule #6 and `docs/09_DATABASE.md`) — there is no `is_deleted` column anywhere in this codebase. Hard deletes are forbidden for compliance data.
6. **No secrets in code.** All keys, passwords, and tokens via environment variables. **Currently violated in one place** — see KNOWN GAPS below.

---

## KNOWN GAPS
> Found auditing this doc against the real code (August 2026) — real,
> present-tense gaps, not hypothetical ones. Cross-referenced rather than
> duplicated where another doc already tracks the item; update the status
> here when one is closed.

1. **`SECRET_KEY` has an insecure hardcoded fallback.**
   `backend/config.py`: `SECRET_KEY: str = "change-me-in-production"`. If
   the `SECRET_KEY` env var isn't set, the app starts anyway and silently
   signs every JWT with this literal string — anyone who reads this repo
   can forge a valid token for any user. `docs/13_DEPLOYMENT.md` already
   says production must override it; nothing in code *enforces* that
   (e.g. refusing to start with the default value when `DEBUG=false`).
2. **Backend does not enforce a password minimum.** See PASSWORD RULES
   above — `UserCreate.password` has no length constraint; only the
   frontend Zod schema (6 chars) stops a weak password.
3. **`GET /audit-logs` has no role restriction.** See Audit log above —
   any authenticated user can read it, not just `admin`.
4. **Schedule H1 register views are not audit-logged.** See Schedule H1
   register above.
5. **JWT is stored in `localStorage`** (`frontend/src/lib/axios.js`), not
   an httpOnly cookie, for the normal login flow — readable by any script
   that runs on the page, so an XSS bug anywhere in the frontend is also a
   full account-takeover bug. (The leftover `POST /auth/session` path,
   confusingly, *does* use an httpOnly cookie — see `docs/10_API.md`.)
   Moving the primary flow to httpOnly cookies is a real hardening step,
   not urgent pre-launch, but worth knowing the trade-off exists.
6. **`POST /auth/session` depends on a third-party demo backend** for
   authentication. Full detail in `docs/10_API.md` AUTH section — decide
   whether to remove it or replace it with real SSO before launch.
7. **No rate limiting** on login/register or any other endpoint — tracked
   in `docs/13_DEPLOYMENT.md` pre-launch blockers, not repeated here.
8. **CORS** is already correctly configured (`allow_origins` from
   `ALLOWED_ORIGINS` env var, not `["*"]`) — `docs/13_DEPLOYMENT.md`'s
   blocker list is accurate that this one just needs the env var set per
   environment, nothing left to fix in code.

---

## AUTHENTICATION

### JWT Flow

```
1. POST /api/auth/login { email, password }
2. Backend: verify password with bcrypt, issue JWT
3. Frontend: store token in localStorage
4. All subsequent requests: Authorization: Bearer <token>
5. Token expiry: 401 → axios interceptor clears token, redirects to /login
```

### Token structure

The JWT payload carries **only identity**, nothing else:

```python
# Actual payload — backend/routers/auth.py::login
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "exp": 1713456789          # Unix timestamp
}
```

`pharmacy_id`, `role`, and `role_id` are **not** in the token. They're
resolved fresh from the database on every request (see below) — this is
deliberate, not an oversight: it means a role/permission change or an
account deactivation takes effect on the user's very next request, instead
of waiting for their existing token to expire.

### Backend: getting the current user

```python
# Every protected route receives current_user via dependency injection
from routers.auth_helpers import get_current_user, User

@router.get("/api/bills")
async def get_bills(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),   # ← always include
):
    pharmacy_id = current_user.pharmacy_id
    # ... query filtered by pharmacy_id
```

```python
# routers/auth_helpers.py — the real get_current_user dependency
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),   # set only by POST /auth/session
    db: AsyncSession = Depends(get_db),
) -> User:
    token = session_token
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])   # raises on expiry/tamper
    user_id = payload.get("sub")

    # role, role_id, pharmacy_id come from a fresh DB lookup, not the token
    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.id == uuid.UUID(user_id))
    )
    user_row = result.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=401, detail="User not found")
    if not user_row.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    return User(id=str(user_row.id), email=user_row.email, name=user_row.name,
                role=user_row.role.name, role_id=str(user_row.role_id),
                pharmacy_id=str(user_row.pharmacy_id), is_active=user_row.is_active)
```

`current_user` is a Pydantic `User` model (attribute access —
`current_user.pharmacy_id`, not `current_user["pharmacy_id"]`), not a raw
dict.

### Frontend: attaching the token

The axios instance at `src/lib/axios.js` attaches the token automatically:

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

You never need to manually attach `Authorization` headers in components.

---

## MULTI-TENANCY (pharmacy isolation)

This is the most critical security rule. Every query must be scoped to the current pharmacy.

### Backend — always filter by pharmacy_id

```python
# ✅ Correct — every query includes pharmacy_id
result = await db.execute(
    select(Bill)
    .where(Bill.pharmacy_id == current_user.pharmacy_id)
    .where(Bill.deleted_at.is_(None))
)

# ❌ WRONG — missing pharmacy_id filter
result = await db.execute(
    select(Bill).where(Bill.id == bill_id)
)
# This returns the bill even if it belongs to a different pharmacy
```

### Fetching a single record — always verify ownership

```python
# ✅ Correct — fetch with pharmacy_id AND id
result = await db.execute(
    select(Bill)
    .where(Bill.id == bill_id)
    .where(Bill.pharmacy_id == current_user.pharmacy_id)
)
bill = result.scalar_one_or_none()

if not bill:
    raise HTTPException(404, detail="Bill not found.")

# ❌ WRONG — fetch by ID only, then check after
bill = await db.get(Bill, bill_id)
if bill.pharmacy_id != current_user.pharmacy_id:   # too late — timing issue
    raise HTTPException(403, "Not allowed")
```

### Database schema — pharmacy_id is on every table

Every table has:
```python
pharmacy_id = Column(UUID, ForeignKey("pharmacies.id"), nullable=False, index=True)
```

If you create a new table and forget `pharmacy_id`, data from all pharmacies will be mixed. This is a critical bug.

---

## ROLE-BASED ACCESS CONTROL

### Roles

Not a fixed 3-tier system. `roles.permissions` is a JSONB flat list of
`module:action` strings, set per-pharmacy (custom roles can be created via
`POST /roles`). The 4 seeded on every new pharmacy signup
(`backend/constants.py::DEFAULT_ROLES`):

| Role | Permissions |
|------|-------------|
| `admin` | `["*"]` — wildcard, every permission, `is_super_admin=True`. Always the signup user's role — there is no public role picker (see `docs/10_API.md` `POST /auth/register`). |
| `manager` | Billing, inventory (incl. batches/stock adjust), purchases, purchase returns, sales returns, customers, reports — no settings/team |
| `cashier` | Billing (create/view), inventory (view), sales returns, customers |
| `inventory_staff` | Inventory (full), purchases, purchase returns — no billing |

Full permission catalog: `backend/constants.py::ALL_PERMISSIONS` (also
served at `GET /permissions`). Check both a role's tier AND its granular
permissions where it matters — `admin` is the only role guaranteed to pass
every check; the other three are defaults, not guarantees (a pharmacy can
edit `manager`/`cashier`/`inventory_staff` permissions, or add custom
roles, via `PUT /roles/{role_id}`).

### Enforcing roles in routes

There is no `require_admin` dependency — every route checks inline. This is
the actual pattern used throughout `backend/routers/`:

```python
@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    ...
```

For a granular (non-role-name) permission check, use
`has_permission(current_user, "billing:delete", db)` from
`routers/auth_helpers.py` — it reads the role's JSONB permission list
(`"*"` or the specific `module:action` string) rather than hardcoding a
role name.

### Frontend — hiding UI by role

```jsx
// ✅ Correct — hide UI elements the user cannot use
const { user } = useAuth();

{user.role === 'admin' && (
  <AppButton variant="danger" onClick={handleDelete}>Delete</AppButton>
)}
```

> Hiding UI is not a security measure. The backend must enforce roles. Frontend hiding is UX only.

---

## PASSWORD RULES

```python
# ✅ Hash with bcrypt before storing
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hashed_password = pwd_context.hash(plain_password)

# ✅ Verify during login
is_valid = pwd_context.verify(plain_password, stored_hash)

# ❌ Never store plain text
user.password = plain_password          # forbidden

# ❌ Never log passwords
logger.info(f"Login attempt: {email} / {password}")   # forbidden
```

### Minimum password requirements

- **6 characters minimum** — `frontend/src/lib/schemas/auth.ts` (`loginSchema`/`registerSchema`, Zod).
- **Not validated on the backend.** `UserCreate.password` in
  `backend/routers/auth.py` is a bare `str` with no length constraint —
  the frontend form is the only thing stopping a 1-character password.
  Anyone calling `POST /auth/register` directly (curl, Postman) bypasses
  it entirely. Listed in KNOWN GAPS below — add a `Field(min_length=6, ...)`
  (or stronger) constraint to `UserCreate` to close this.

---

## SENSITIVE DATA RULES

### Never log these

- Passwords (plain or hashed)
- JWT tokens
- Full credit card / payment details
- Patient personal information beyond what's needed
- Database connection strings

### Never commit these to git

- `.env` files
- Any file containing `SECRET_KEY`, `DATABASE_URL`, API keys
- SSL certificates or private keys

`.gitignore` must include:

```
.env
*.pem
*.key
backend/venv/
```

### Never return these in API responses

```python
# ❌ Never return the password hash
return {"id": user.id, "email": user.email, "password": user.password}

# ✅ Exclude sensitive fields
return {"id": user.id, "email": user.email, "role": user.role}
```

---

## INPUT VALIDATION

### Backend — FastAPI Pydantic models

All request bodies are validated via Pydantic schemas. Never skip schema validation.

```python
# ✅ Correct — Pydantic schema validates before handler runs
class CreateBillRequest(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=255)
    items: List[BillItemRequest] = Field(..., min_items=1)
    payment_method: Literal["cash", "upi", "card", "credit", "cheque"]
    status: Literal["draft", "paid", "due"]

@router.post("/api/bills")
async def create_bill(payload: CreateBillRequest, ...):
    ...
```

### Frontend — Zod schemas

All forms use Zod + react-hook-form. Never uncontrolled validation.

```jsx
const schema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'credit', 'cheque']),
});
```

### SQL injection

SQLAlchemy ORM parameterizes all queries automatically. Never use raw string interpolation in queries.

```python
# ✅ Safe — ORM handles parameterization
select(Product).where(Product.name == user_input)

# ❌ Dangerous — raw SQL with string interpolation
await db.execute(f"SELECT * FROM products WHERE name = '{user_input}'")
```

---

## COMPLIANCE-SPECIFIC SECURITY

### Schedule H1 register

The H1 register is a legal document. Extra rules apply:

- Only `admin` and `manager` roles can view it — enforced in
  `GET /compliance/schedule-h1-register` (`backend/routers/reports.py`)
- It is read-only — no update or delete endpoints exist for `schedule_h1_register`
- **Not currently true, and it should be:** viewing the register is **not**
  audit-logged. `get_schedule_h1_register()` has no call into
  `audit_logs`. For a document a drug inspector can request an audit
  trail for, "who looked at this and when" is arguably as important as
  "who dispensed this" — worth fixing before this matters for real
  compliance. Listed in KNOWN GAPS below.

### Audit log

The audit log must be append-only:

- No `UPDATE` on `audit_logs` table
- No `DELETE` on `audit_logs` table — confirmed, no such route exists in `backend/routers/`
- **Not currently role-restricted.** `GET /audit-logs` and
  `GET /audit-logs/entity/{type}/{id}` (`backend/routers/billing.py`)
  require *a* valid login but do not check `current_user.role` — any
  authenticated user in the pharmacy, not just `admin`, can read the full
  audit trail today. Decide if that's intended before assuming "Admin UI"
  is also an enforced backend restriction — right now it's only a
  frontend choice of who gets a link to it.

### Soft delete enforcement

```python
# ✅ Correct — soft delete
entity.deleted_at = func.now()
await db.flush()

# ❌ Forbidden — hard delete
await db.delete(entity)
await db.flush()
```

---

## SECURITY ANTI-PATTERNS

```python
# ❌ Route with no auth dependency
@router.get("/api/bills")
async def get_bills(db: AsyncSession = Depends(get_db)):
    # No current_user — any unauthenticated request gets all data
    ...

# ❌ Query without pharmacy_id filter
result = await db.execute(select(Bill))
# Returns all bills from all pharmacies

# ❌ Trusting client-supplied pharmacy_id
@router.get("/api/bills")
async def get_bills(pharmacy_id: UUID, ...):
    # Client can pass any pharmacy_id and see that pharmacy's data
    # Always use current_user.pharmacy_id, resolved server-side from the JWT

# ❌ Returning password hash in response
return user.__dict__   # includes password_hash

# ❌ Hardcoded secrets
SECRET_KEY = "mysecret123"  # in code — never (see KNOWN GAPS: this codebase
                             # currently ships an insecure *fallback* default,
                             # which is the same mistake one env var away)
```

---

*Security is not optional. These rules exist because real patient data and financial records are at stake.*
