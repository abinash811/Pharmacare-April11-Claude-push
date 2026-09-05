# PharmaCare — API Reference
# Version: 1.2 | Last updated: September 5, 2026
# Type: Reference
# Audience: Claude, all developers
# Base URL: http://localhost:8000/api (dev) | https://api.pharmacare.in/api (prod)
# Auth: Bearer JWT token in Authorization header (handled by axios instance automatically)
# Rule: All new endpoints are documented here in the same PR.

---

## HOW TO CALL THE API (Frontend)

```jsx
import api from '@/lib/axios';

// GET with query params
const { data } = await api.get('/bills', { params: { page: 1, page_size: 20 } });

// POST
const { data } = await api.post('/bills', payload);

// PUT
const { data } = await api.put(`/bills/${id}`, payload);

// DELETE (soft — sets is_deleted=true on backend)
await api.delete(`/products/${id}`);
```

The axios instance automatically:
- Attaches `Authorization: Bearer {token}` from localStorage
- Redirects to `/` on 401
- Normalises error messages — catch with `error.message`

---

## RESPONSE CONVENTIONS

### Success
```json
// Single object
{ "id": "uuid", "bill_number": "INV-000042", ... }

// List with pagination
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 98,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### Error
```json
// FastAPI validation error (422)
{ "detail": [{ "loc": ["body", "field"], "msg": "field required", "type": "value_error" }] }

// Application error (400, 404, etc.)
{ "detail": "Insufficient stock in batch BN240501" }
```

### Money in responses
All money in API responses is in **rupees** (float) for backward compatibility.
All money in the database is in **paise** (integer).
When reading API responses, multiply by 100 to get paise for calculations.

---

## AUTH

### `POST /auth/register`
Create a new user account.

**Request:**
```json
{
  "name": "Rajesh Kumar",
  "email": "rajesh@pharmacy.com",
  "password": "SecurePass@123",
  "role": "cashier"
}
```

**Response:**
```json
{
  "user": { "id": "uuid", "name": "Rajesh Kumar", "email": "...", "role": "cashier" },
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

---

### `POST /auth/login`
Login with email and password.

**Request:**
```json
{ "email": "admin@pharmacy.com", "password": "Admin@123" }
```

**Response:** Same as register.

**Errors:**
- `400` — Invalid credentials

---

### `POST /auth/session`
> ⚠️ **Tech debt, not a designed feature.** This is leftover scaffolding from
> the app-builder template this project started from. On session creation it
> calls out to a **third-party demo backend**
> (`https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`) to
> validate an `X-Session-ID` header, auto-provisions a user from whatever
> that external service returns, and sets a `session_token` cookie — a
> completely separate auth path from `POST /auth/login`'s JWT flow. It is
> still live and still called by `frontend/src/App.js` (the `session_id=`
> URL-hash handler). A production auth flow should not depend on an external
> demo service. Flagged in `docs/13_DEPLOYMENT.md` pre-launch blockers —
> decide whether to remove this path entirely or replace it with a real SSO
> integration before launch.

Creates or logs in a user from an external session lookup (see warning
above). Sets an httpOnly `session_token` cookie.

---

### `GET /auth/me`
Get current authenticated user.

**Response:**
```json
{ "id": "uuid", "name": "Rajesh", "email": "...", "role": "admin", "pharmacy_id": "uuid" }
```

---

### `POST /auth/logout`
Invalidate session (client should also clear localStorage).

---

## BILLING

### `POST /bills`
Create a bill (draft or settled).

**Request:**
```json
{
  "status": "paid",
  "invoice_type": "SALE",
  "customer_name": "Patient Name",
  "customer_mobile": "9876543210",
  "doctor_name": "Dr. Sharma",
  "items": [
    {
      "product_id": "uuid",
      "product_sku": "PARA500",
      "product_name": "Crocin 500mg",
      "batch_id": "uuid",
      "batch_number": "BN240501",
      "quantity": 2,
      "unit_price": 12.50,
      "mrp": 12.50,
      "disc_percent": 0,
      "gst_percent": 5
    }
  ],
  "discount": 0,
  "tax_rate": 5,
  "payment_method": "cash",
  "payments": [{ "amount": 26.25, "payment_method": "cash" }]
}
```

**Key rules:**
- `status: "draft"` → no bill number assigned, stock not deducted
- `status: "paid"` or `"due"` → real bill number assigned, stock deducted
- Schedule H1 items → `doctor_name` required or returns `400`
- `invoice_type: "SALES_RETURN"` → creates return bill with RTN- prefix

**Response:** Full bill object with bill_number, items, totals.

**Errors:**
- `400` — Schedule H1 drug without doctor name
- `400` — Insufficient stock in batch

---

### `GET /bills`
List bills with pagination and filters.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `page_size` | int | 20 | Per page (max 100) |
| `status` | string | — | `paid`, `due`, `draft`, `partial` |
| `invoice_type` | string | `SALE` | `SALE`, `SALES_RETURN` |
| `start_date` | date | — | `YYYY-MM-DD` |
| `end_date` | date | — | `YYYY-MM-DD` |
| `search` | string | — | Bill number or customer name |
| `customer_id` | uuid | — | Filter by customer |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "bill_number": "INV-000042",
      "bill_date": "2026-04-18",
      "customer_name": "Ramesh",
      "total_amount": 262.50,
      "paid_amount": 262.50,
      "due_amount": 0,
      "status": "paid",
      "payment_method": "cash"
    }
  ],
  "pagination": { "page": 1, "total": 340, ... }
}
```

---

### `GET /bills/{bill_id}`
Get full bill with all line items.

---

### `PUT /bills/{bill_id}`
Update a bill. Only works on `draft` status bills.

---

### `GET /bills/{bill_id}/pdf`
Download bill as PDF.
**Response:** `application/pdf` stream.

---

### `POST /payments`
Record payment against a due bill.

**Request:**
```json
{
  "invoice_id": "bill-uuid",
  "amount": 450.00,
  "payment_method": "upi",
  "reference_number": "UPI-TX-123456"
}
```

---

### `GET /payments`
List payments for a bill. **Query params:** `invoice_id` (required — returns
`[]` without it). Payments aren't a separate ledger table; this derives a
single synthetic entry from `bills.amount_paid_paise` / `payment_method`.

---

### `POST /refunds`
Record refund for a sales return bill.

**Request:**
```json
{
  "return_invoice_id": "return-bill-uuid",
  "original_invoice_id": "original-bill-uuid",
  "amount": 125.00,
  "refund_method": "cash",
  "reason": "Expired product"
}
```

---

### `GET /refunds`
List refunds. **Query params:** `return_invoice_id`, `original_invoice_id`.
Like `GET /payments`, this is derived (from bill status + audit logs), not a
dedicated refunds table.

---

## INVENTORY

### `GET /inventory`
List all products with current stock levels.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | — |
| `page_size` | int | — |
| `search` | string | Product name, SKU, generic name |
| `category` | string | Filter by category |
| `drug_schedule` | string | `OTC`, `H`, `H1`, `X` |
| `stock_status` | string | `low_stock`, `out_of_stock`, `near_expiry`, `expired`, `healthy` |
| `location` | string | Storage location filter |

---

### `GET /inventory/filters`
Get available filter options (distinct values for dropdowns).

**Response:**
```json
{
  "categories": ["Antibiotics", "Analgesics", ...],
  "dosage_types": ["Tablet", "Syrup", ...],
  "schedule_types": ["OTC", "H", "H1"],
  "gst_rates": [0, 5, 12, 18],
  "locations": ["Rack A", "Rack B", ...]
}
```

---

### `GET /products/meta`
Dropdown source of truth for the Add Medicine form — categories (with fixed
HSN + description), valid GST slabs, dosage forms. Read this instead of
hardcoding the same lists in frontend constants.

**Response:**
```json
{ "categories": [...], "gst_rates": [0, 5, 12, 18, 28], "dosage_forms": [...] }
```

---

### `POST /products/bulk-update`
Bulk-edit one field across many products by SKU. Admin/manager only.

**Request:**
```json
{ "skus": ["PARA500", "AMOX250"], "field": "category", "value": "Analgesics" }
```

**Allowed `field` values:** `storage_location` (`location` accepted as
alias), `gst_rate` (`gst_percent` accepted as alias), `category`,
`drug_schedule` (`schedule` accepted as alias), `brand`. Any other field
name returns `400`.

---

### `POST /products`
Create a new product in the master.

**Request:**
```json
{
  "name": "Crocin 500mg",
  "generic_name": "Paracetamol",
  "sku": "PARA500",
  "category": "Analgesics",
  "drug_schedule": "OTC",
  "dosage_form": "Tablet",
  "units_per_pack": 10,
  "hsn_code": "3004",
  "gst_rate": 5,
  "reorder_level": 20
}
```

---

### `GET /products`
List products (master, without stock levels).

---

### `GET /products/{product_id}`
Get single product detail.

---

### `PUT /products/{product_id}`
Update product master data.

---

### `DELETE /products/{product_id}`
Soft delete a product (`deleted_at` set, `is_active = false`).

---

### `GET /products/search-with-batches`
Search products and return with available batches. Used by the billing screen.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search term (name, generic, barcode) |
| `pharmacy_id` | uuid | — |

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Crocin 500mg",
    "generic_name": "Paracetamol",
    "gst_rate": 5,
    "batches": [
      {
        "id": "uuid",
        "batch_number": "BN240501",
        "expiry_date": "2026-06-30",
        "qty_on_hand": 50,
        "mrp_per_unit": 12.50,
        "cost_price_per_unit": 9.80
      }
    ]
  }
]
```

---

### `GET /products/barcode/{barcode}`
Look up product by barcode. Used by barcode scanner.

---

### `GET /products/{sku}/transactions`
Get all purchase and sale transactions for a product.

---

### Bulk upload (Excel) — `frontend/src/components/ExcelBulkUploadWizard`
Defined in `backend/utils/excel.py` (a separate `excel.router`, not
`inventory.router` — same `/api` prefix, so paths still read as
`/inventory/bulk-upload/*`). A 4-step wizard: download template → upload &
auto-detect columns → validate rows → import.

| Endpoint | Notes |
|----------|-------|
| `GET /inventory/bulk-upload/template` | Downloads an `.xlsx` template with the expected columns |
| `POST /inventory/bulk-upload/parse` | Upload a file (`multipart/form-data`); auto-detects column mapping by header keyword matching (see `COLUMN_KEYWORDS` in `excel.py`) |
| `POST /inventory/bulk-upload/validate` | `{ job_id, column_mapping }` — validates every row against required fields (`sku`, `name`, `price`, `quantity`, `expiry_date`, `batch_number`) |
| `POST /inventory/bulk-upload/import` | `{ job_id, import_valid_only }` — runs as a background task |
| `GET /inventory/bulk-upload/progress/{job_id}` | Poll for import progress |
| `GET /inventory/bulk-upload/error-report/{job_id}` | Rows that failed validation/import |

**Note:** job state is an in-memory dict (`bulk_upload_jobs` in `excel.py`) —
lost on backend restart, and won't work correctly behind more than one
backend worker/replica.

---

## STOCK BATCHES

### `POST /stock/batches`
Create a new batch (manual stock entry, not through purchase).

**Request:**
```json
{
  "product_id": "uuid",
  "batch_number": "BN240501",
  "expiry_date": "2026-06-30",
  "quantity": 100,
  "mrp_per_unit": 12.50,
  "cost_price_per_unit": 9.80
}
```

---

### `GET /stock/batches`
List batches, optionally filtered by product.

**Query params:** `product_id`, `include_zero_qty` (boolean)

---

### `GET /stock/batches/{batch_id}`
Get single batch.

---

### `PUT /stock/batches/{batch_id}`
Update batch (MRP, cost price, expiry).

---

### `DELETE /stock/batches/{batch_id}`
Soft delete a batch. Only allowed if `qty_on_hand = 0`.

---

### `POST /batches/{batch_id}/adjust`
Manual stock adjustment.

**Request:**
```json
{
  "adjustment_quantity": -5,
  "reason": "Damaged stock",
  "notes": "Found 5 strips damaged during audit"
}
```

---

### `POST /batches/{batch_id}/writeoff-expiry`
Write off an expired batch.

**Request:**
```json
{ "quantity": 20, "reason": "Expired" }
```

---

### `POST /stock-movements`
Record a manual movement directly against a batch (used by adjust/writeoff
flows internally, and available standalone).

**Request:**
```json
{ "batch_id": "uuid", "movement_type": "adjustment", "qty_delta_units": -5, "ref_type": "manual", "reason": "Damaged stock" }
```

---

### `GET /stock-movements`
List stock movements (the ledger).

**Query params:** `product_id`, `batch_id`, `movement_type`, `start_date`, `end_date`, `page`, `page_size`

---

## SALES RETURNS

### `POST /sales-returns`
Create a sales return.

**Request:**
```json
{
  "original_bill_id": "bill-uuid",
  "return_reason": "Wrong medicine dispensed",
  "items": [
    {
      "bill_item_id": "item-uuid",
      "product_id": "product-uuid",
      "batch_id": "batch-uuid",
      "quantity": 2,
      "return_to_stock": true
    }
  ],
  "refund_method": "cash"
}
```

---

### `GET /sales-returns`
List sales returns with pagination.

**Query params:** `page`, `page_size`, `start_date`, `end_date`, `search`

---

### `GET /sales-returns/{return_id}`
Get single sales return with items.

---

### `PUT /sales-returns/{return_id}`
Edit a sales return. Two edit modes:
- **Non-financial** (note, billed-by) — any user.
- **Financial** (items, amounts) — reverses the old stock movements, deletes
  the old return items, and rebuilds them from the request. Requires the
  `allow_financial_edit_return` permission (admins always have it — see
  `PUT /roles/{role_id}/permissions/returns` under USERS & ROLES).

---

## PURCHASES

### `POST /purchases`
Create a purchase (draft or confirmed).

**Request:**
```json
{
  "supplier_id": "uuid",
  "supplier_invoice_number": "INV-2026-1234",
  "supplier_invoice_date": "2026-04-15",
  "status": "confirmed",
  "items": [
    {
      "product_sku": "PARA500",
      "batch_no": "BN240501",
      "expiry_date": "2026-06-30",
      "quantity_received": 100,
      "mrp_per_unit": 12.50,
      "ptr_per_unit": 10.00,
      "trade_discount": 5,
      "gst_rate": 5
    }
  ]
}
```

**Key rule:** `status: "confirmed"` creates stock batches immediately.

---

### `GET /purchases`
List purchases.

**Query params:** `page`, `page_size`, `status`, `payment_status`, `supplier_id`, `start_date`, `end_date`

---

### `GET /purchases/{purchase_id}`
Get single purchase with items.

---

### `PUT /purchases/{purchase_id}`
Update purchase (only `draft` status).

---

### `POST /purchases/{purchase_id}/pay`
Record payment to supplier.

**Request:**
```json
{
  "amount": 5000.00,
  "payment_method": "bank_transfer",
  "reference_number": "NEFT-123456",
  "payment_date": "2026-04-18"
}
```

---

## PURCHASE RETURNS

### `GET /purchases/{purchase_id}/items-for-return`
Get purchase items eligible for return.

---

### `POST /purchase-returns`
Create a purchase return (debit note).

---

### `GET /purchase-returns`
List purchase returns.

---

### `GET /purchase-returns/{return_id}`
Get single purchase return with items.

---

### `PUT /purchase-returns/{return_id}`
Edit a purchase return — `{ edit_type: "financial" | "non_financial", note, billed_by }`.

---

### `POST /purchase-returns/{return_id}/confirm`
Confirm a purchase return (deducts stock).

---

## CUSTOMERS

### `POST /customers`
Create a customer.

**Request:**
```json
{
  "name": "Ramesh Kumar",
  "phone": "9876543210",
  "customer_type": "retail",
  "credit_limit": 5000
}
```

---

### `GET /customers`
List customers with search and pagination.

**Query params:** `search`, `customer_type`, `page`, `page_size`

---

### `GET /customers/search`
Lightweight typeahead — `?q=` matches name or phone, returns up to 100,
no pagination. Used by `PatientCombobox` on the billing screen. Different
from `GET /customers?search=`, which is the paginated list-page search.

---

### `GET /customers/{customer_id}`
Get customer detail.

---

### `GET /customers/{customer_id}/stats`
Get customer purchase history stats.

**Response:**
```json
{
  "total_bills": 42,
  "total_spent": 18500.00,
  "outstanding": 0,
  "last_purchase_date": "2026-04-10"
}
```

---

### `PUT /customers/{customer_id}`
Update customer.

---

### `DELETE /customers/{customer_id}`
Soft delete customer.

---

## DOCTORS

### `POST /doctors`
Create a doctor record.

### `GET /doctors`
List doctors (search by name).

### `PUT /doctors/{doctor_id}`
Update doctor.

### `DELETE /doctors/{doctor_id}`
Soft delete.

---

## SUPPLIERS

### `GET /suppliers`
List all suppliers.

### `POST /suppliers`
Create supplier.

### `GET /suppliers/{supplier_id}`
Get supplier detail.

### `GET /suppliers/{supplier_id}/summary`
Get supplier purchase history and outstanding.

### `PUT /suppliers/{supplier_id}`
Update supplier.

### `DELETE /suppliers/{supplier_id}`
Soft delete.

### `PATCH /suppliers/{supplier_id}/toggle-status`
Activate or deactivate supplier.

---

## REPORTS

### `GET /reports/dashboard`
KPIs for the dashboard.

**Response:**
```json
{
  "today_sales": 24500.00,
  "today_bills": 42,
  "low_stock_count": 8,
  "near_expiry_count": 15,
  "outstanding_receivable": 12000.00,
  "monthly_sales": 485000.00
}
```

---

### `GET /reports/sales-summary`
Sales summary by date range.

**Query params:** `start_date`, `end_date`

---

### `GET /reports/sales`
Detailed sales report.

**Query params:** `start_date`, `end_date`, `page`, `page_size`

---

### `GET /reports/gst`
GST report for GSTR-1 filing.

**Query params:** `start_date`, `end_date`

**Response:**
```json
{
  "summary": {
    "total_taxable": 450000.00,
    "total_cgst": 11250.00,
    "total_sgst": 11250.00,
    "total_gst": 22500.00,
    "grand_total": 472500.00
  },
  "hsn_wise": [
    {
      "hsn_code": "3004",
      "description": "Medicaments",
      "taxable_amount": 380000.00,
      "gst_rate": 5,
      "cgst": 9500.00,
      "sgst": 9500.00
    }
  ]
}
```

---

### `GET /reports/low-stock`
Products below reorder level.

### `GET /reports/expiry`
Batches expiring within threshold days.

---

## ANALYTICS
Dashboard-facing aggregates — distinct from `/reports/*` above (which are
export/compliance-oriented). All money fields are rupees (float), computed
from `_paise` columns server-side.

### `GET /analytics/summary`
Gross sales, returns, net sales, pending (due) amount, today's sales, draft
count — the tiles at the top of the Dashboard.

### `GET /analytics/daily`
Per-day sales/returns/net for the last N days. **Query params:** `days` (default `7`).

### `GET /analytics/dashboard`
Wider dashboard payload — week/month/yesterday/last-week/last-month/30-day
comparisons.

### `GET /analytics/purchases`
Purchase totals + purchase-return totals for a date range. **Query params:**
`from_date`, `to_date`.

> ⚠️ **This route is defined twice** — in `backend/routers/reports.py:523`
> and again in `backend/routers/sales_returns.py:659`. FastAPI matches the
> first registration, and `main.py` includes `reports.router` (line 43)
> before `sales_returns.router` (line 47), so the `reports.py` version
> always wins — the copy in `sales_returns.py` is dead code, unreachable.
> Not fixed as part of this doc pass (code change, not a doc one); worth a
> follow-up to delete the dead copy from `sales_returns.py` so a future
> edit to "the" `/analytics/purchases` doesn't silently target the wrong
> file.

---

### `GET /backup/export`
Admin-only. Dumps every row (this pharmacy only) from `products`, `bills`,
`purchases`, `customers`, `doctors`, `suppliers` as JSON. Manual substitute
for the "No automated backups" gap tracked in `docs/13_DEPLOYMENT.md`
pre-launch blockers — not a scheduled/automated backup itself.

---

## COMPLIANCE

### `GET /compliance/schedule-h1-register`
Schedule H1 register for drug inspector compliance.

**Query params:** `start_date`, `end_date`, `page`, `page_size`

**Response:**
```json
{
  "data": [
    {
      "supply_date": "2026-04-18",
      "patient_name": "Mohan Lal",
      "prescriber_name": "Dr. Sharma",
      "product_name": "Augmentin 625mg",
      "batch_number": "BN240601",
      "quantity": 6,
      "bill_number": "INV-000042"
    }
  ]
}
```

---

## SETTINGS

### `GET /settings`
Get pharmacy settings.

### `PUT /settings`
Update pharmacy settings.

### `GET /settings/bill-sequence`
Get current bill sequence configuration.

**Response:**
```json
{
  "prefix": "INV",
  "current_sequence": 42,
  "next_number": 43,
  "sequence_length": 6,
  "preview": "INV-000043"
}
```

### `PUT /settings/bill-sequence`
Update bill sequence settings.

**Request:**
```json
{
  "prefix": "INV",
  "starting_number": 100,
  "sequence_length": 6
}
```

### `GET /settings/bill-sequence/all`
List all sequence types (INV, RTN, etc.)

---

## USERS & ROLES

### `GET /users`
List all users in the pharmacy.

### `POST /users`
Create a new user.

### `GET /users/{user_id}`
Get single user detail. Admin only.

### `PUT /users/{user_id}`
Update user (name, role, active status).

### `DELETE /users/{user_id}`
Deactivate user (soft delete).

### `PUT /users/me/change-password`
Change own password.

**Request:**
```json
{ "current_password": "old", "new_password": "new" }
```

### `GET /permissions`
List every permission flag the system knows about (`ALL_PERMISSIONS`).
Admin only — feeds the role-editor's permission checkboxes.

### `GET /roles`
List all roles with permissions.

### `POST /roles`
Create custom role.

### `GET /roles/{role_id}`
Get single role.

### `PUT /roles/{role_id}`
Update role permissions. System roles (`is_system_role=true`) reject edits with `400`.

### `DELETE /roles/{role_id}`
Delete a custom role. Admin only.

### `GET /roles/{role_name}/permissions/returns`
### `PUT /roles/{role_id}/permissions/returns`
Get/set the two Sales-Return-specific permission flags
(`allow_manual_returns`, `allow_financial_edit_return`) for a role — admin
only for the write. **Note:** defined in `backend/routers/sales_returns.py`,
not `settings.py`, alongside the rest of the role endpoints above — look
there first if these seem to be missing.

---

## AUDIT LOGS

### `GET /audit-logs`
List audit log entries.

**Query params:** `entity_type`, `entity_id`, `action`, `page`, `page_size`

### `GET /audit-logs/entity/{entity_type}/{entity_id}`
Get full audit trail for a specific entity.

---

## ERROR CODES

| HTTP Status | Meaning | Common causes |
|-------------|---------|---------------|
| `400` | Bad Request | Validation failure, insufficient stock, H1 without doctor |
| `401` | Unauthorized | Missing or expired JWT token |
| `403` | Forbidden | User role doesn't have permission |
| `404` | Not Found | Resource doesn't exist or was soft-deleted |
| `409` | Conflict | Duplicate bill number, duplicate SKU |
| `422` | Unprocessable Entity | Pydantic validation error (wrong field types) |
| `500` | Server Error | Unexpected backend error — check logs |

---

## HEALTH CHECK

```bash
# Verify backend is running
curl http://localhost:8000/docs       # FastAPI auto-docs
curl http://localhost:8000/openapi.json  # OpenAPI spec
```

---

*When a new endpoint is added, document it here in the same PR.*
*Owner: The developer adding the endpoint.*
