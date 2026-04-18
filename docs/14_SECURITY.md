# PharmaCare — Security
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Every route is authenticated. Every query is pharmacy-scoped. No exceptions.

---

## CORE SECURITY RULES

1. **Every API route requires a valid JWT.** No public routes except `/api/auth/login` and `/api/auth/register`.
2. **Every DB query filters by `pharmacy_id`.** A user from Pharmacy A must never see Pharmacy B's data.
3. **Passwords are bcrypt-hashed.** Never store plain text. Never log passwords.
4. **Tokens expire.** Default: 24 hours. Never issue non-expiring tokens.
5. **Soft deletes only.** `is_deleted = True`. Hard deletes are forbidden for compliance data.
6. **No secrets in code.** All keys, passwords, and tokens via environment variables.

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

```python
# Payload
{
  "sub": "user-uuid",
  "pharmacy_id": "pharmacy-uuid",
  "role": "admin",           # admin | pharmacist | staff
  "exp": 1713456789          # Unix timestamp
}
```

### Backend: getting the current user

```python
# Every protected route receives current_user via dependency injection
from backend.auth import get_current_user

@router.get("/api/invoices")
async def get_invoices(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),   # ← always include
):
    pharmacy_id = current_user["pharmacy_id"]
    # ... query filtered by pharmacy_id
```

```python
# auth.py — get_current_user dependency
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(401, detail="Invalid token.")
        return payload
    except JWTError:
        raise HTTPException(401, detail="Token expired or invalid.")
```

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
    select(Invoice)
    .where(Invoice.pharmacy_id == current_user["pharmacy_id"])
    .where(Invoice.is_deleted == False)
)

# ❌ WRONG — missing pharmacy_id filter
result = await db.execute(
    select(Invoice).where(Invoice.id == invoice_id)
)
# This returns the invoice even if it belongs to a different pharmacy
```

### Fetching a single record — always verify ownership

```python
# ✅ Correct — fetch with pharmacy_id AND id
invoice = await db.execute(
    select(Invoice)
    .where(Invoice.id == invoice_id)
    .where(Invoice.pharmacy_id == current_user["pharmacy_id"])
)
invoice = invoice.scalar_one_or_none()

if not invoice:
    raise HTTPException(404, detail="Invoice not found.")

# ❌ WRONG — fetch by ID only, then check after
invoice = await db.get(Invoice, invoice_id)
if invoice.pharmacy_id != current_user["pharmacy_id"]:   # too late — timing issue
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

| Role | Permissions |
|------|-------------|
| `admin` | Full access — settings, team, all data |
| `pharmacist` | Billing, inventory, purchases, reports |
| `staff` | Billing only — read-only for everything else |

### Enforcing roles in routes

```python
# Dependency for admin-only routes
def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, detail="Admin access required.")
    return current_user

# Usage
@router.delete("/api/products/{product_id}")
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),   # ← admin only
):
    ...
```

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

- 8 characters minimum
- Enforced via Zod on frontend, validated on backend

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
class CreateInvoiceRequest(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=255)
    items: List[InvoiceItemRequest] = Field(..., min_items=1)
    payment_method: Literal["cash", "upi", "card", "credit", "cheque"]
    status: Literal["draft", "paid", "due"]

@router.post("/api/invoices")
async def create_invoice(payload: CreateInvoiceRequest, ...):
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

- Only `admin` and `pharmacist` roles can view it
- It is read-only — no update or delete endpoints
- Every view of the register is audit-logged

### Audit log

The audit log must be append-only:

- No `UPDATE` on `audit_logs` table
- No `DELETE` on `audit_logs` table
- Admin UI shows logs read-only

### Soft delete enforcement

```python
# ✅ Correct — soft delete
entity.is_deleted = True
entity.deleted_at = datetime.utcnow()
await db.commit()

# ❌ Forbidden — hard delete
await db.delete(entity)
await db.commit()
```

---

## SECURITY ANTI-PATTERNS

```python
# ❌ Route with no auth dependency
@router.get("/api/invoices")
async def get_invoices(db: AsyncSession = Depends(get_db)):
    # No current_user — any unauthenticated request gets all data
    ...

# ❌ Query without pharmacy_id filter
result = await db.execute(select(Invoice))
# Returns all invoices from all pharmacies

# ❌ Trusting client-supplied pharmacy_id
@router.get("/api/invoices")
async def get_invoices(pharmacy_id: UUID, ...):
    # Client can pass any pharmacy_id and see that pharmacy's data
    # Always use current_user["pharmacy_id"] from the JWT

# ❌ Returning password hash in response
return user.__dict__   # includes hashed_password

# ❌ Hardcoded secrets
SECRET_KEY = "mysecret123"  # in code — never
```

---

*Security is not optional. These rules exist because real patient data and financial records are at stake.*
