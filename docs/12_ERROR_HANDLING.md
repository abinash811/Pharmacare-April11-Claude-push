# PharmaCare — Error Handling
# Version: 1.2 | Last updated: August 22, 2026
# Audience: Claude, all developers
# Rule: Every error must be catchable, displayable, and recoverable. No silent failures.

---

## PHILOSOPHY

1. **Never let an error disappear silently.** Every catch block must do something visible.
2. **User-facing messages are human, not technical.** No stack traces, no "500 Internal Server Error" raw text.
3. **Always offer a next action.** "Something went wrong" + Retry button beats "Something went wrong" alone.
4. **Fail loud in dev, fail graceful in prod.** `console.error` in dev is fine. Raw errors in the UI are not.
5. **Every error notification must say why.** A toast that only says "Failed to save" with no cause forces the
   user to guess. Say what's wrong (which field, what value, what's missing) so they can fix it without asking
   anyone. "Failed to save settings" is not acceptable on its own — "Phone must be a valid 10-digit Indian mobile
   number" is. This applies to every `toast.error(...)` call, not just Settings — added after a real bug (Aug 19,
   2026) where a generic fallback hid a real GSTIN/PAN format error from the user for this exact reason.

---

## BACKEND ERROR CONVENTIONS

### HTTP Status Codes

| Code | When to use |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request — client sent wrong data (missing field, invalid value) |
| `401` | Unauthenticated — token missing or expired |
| `403` | Unauthorized — authenticated but not allowed |
| `404` | Resource not found |
| `409` | Conflict — duplicate entry, concurrent write collision |
| `422` | Validation error — FastAPI request body schema mismatch |
| `500` | Internal server error — unexpected exception |

### FastAPI Error Response Shape

All errors return this exact shape:

```json
{
  "detail": "Human-readable message here."
}
```

For field-level validation errors (422), FastAPI's own request-body validation returns:

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

PharmaCare's own routers that validate a raw `dict` body by hand (Settings does this —
see `PharmacyGeneralUpdate` / `DigitalReceiptUpdate` in `backend/routers/settings.py`)
catch Pydantic's `ValidationError` and re-raise as a 422 in this shape instead:

```json
{
  "detail": [
    { "field": "phone", "message": "Phone must be a valid 10-digit Indian mobile number" }
  ]
}
```

Both shapes name the field and the reason — that's the point. The shared axios
interceptor (below) already reads both (`msg` or `message`), so callers never need to
know which one a given endpoint used.

### Raising Errors in Routers

```python
# ✅ Correct — specific message, correct status code
from fastapi import HTTPException

raise HTTPException(status_code=400, detail="Prescription details required for Schedule H1 drug: Alprazolam 0.5mg")
raise HTTPException(status_code=404, detail="Bill not found")
raise HTTPException(status_code=409, detail="A bill with this number already exists.")
raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name} in batch {batch.batch_number}: {old_qty} available, {qty} requested")

# ❌ Never — vague messages
raise HTTPException(status_code=400, detail="Bad request")
raise HTTPException(status_code=500, detail="Error")
raise Exception("something broke")  # unhandled — caught by the global handler
                                      # (see below) as a clean, but generic,
                                      # 500 — still worse than a real
                                      # HTTPException with a real reason
```

### Global Exception Handler

> Corrected August 22, 2026 — this section previously described a handler
> that did not exist. `backend/main.py` had no `@app.exception_handler`
> registered at all; an unguarded exception (a bare `uuid.UUID()` call on
> bad input, for example — a real, still-only-partially-fixed pattern
> across several routers) fell through to Starlette's own default 500
> instead of the clean shape below. Added for real the same day, verified
> live: `GET /purchases/not-a-real-uuid` now returns
> `{"detail": "An unexpected error occurred. Please try again."}` (500)
> instead of an unhandled crash.

`backend/main.py` registers a catch-all:

```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )
```

This does **not** intercept `HTTPException` or FastAPI's own
`RequestValidationError` — those keep their own more-specific handlers and
real status codes (400/404/422/etc). It only catches what nothing else
caught. Never remove this handler. It prevents raw tracebacks from
reaching the client — it just didn't actually exist to do that until now.

---

## FRONTEND ERROR CONVENTIONS

### The axios instance normalises every error — use `error.message`

`frontend/src/lib/axios.js` (and its `.ts` twin) intercepts every response. On success it's a
pass-through; on error it redirects to `/` on 401, and — this is the important part — it
rewrites `error.message` into one human-readable string before re-throwing, so every caller
can do the same thing without re-parsing `error.response.data.detail` itself:

- A field-level 422 array (either FastAPI's own `{msg}` shape or PharmaCare's `{field, message}`
  shape) becomes `"field: reason"`, joined with `; ` if there's more than one.
- A plain string `detail` (most `raise HTTPException(...)` calls) passes through as-is.
- No response at all (server down, offline, CORS, timeout) becomes
  `"Could not reach the server. Check your connection and try again."`
- Anything else falls back to `error.message` or `"Something went wrong"`.

```js
// ✅ Correct — the interceptor already did the work
try {
  await api.put(apiUrl.settings(), payload);
  toast.success('Settings saved successfully');
} catch (error) {
  toast.error(error.message);
}
```

**Do not** write a per-file `getErrorMessage` that re-reads `error.response.data.detail` —
that's how a real bug shipped (Aug 19, 2026): a one-off implementation in
`useSettings.js` bypassed the interceptor, read the raw `detail` array directly, and since
`toast.error()` can't render an array of objects it silently fell back to a hardcoded
"Failed to save settings" — hiding an actual GSTIN/PAN validation error from the user. Use
`error.message` everywhere; if you need custom fallback text, do
`toast.error(error.message || 'your fallback')`.

---

## ERROR DISPLAY PATTERNS

### 1. Toast notifications — transient feedback

Use `sonner` — the real, only toast library in this project (verified:
`react-hot-toast` isn't even in `package.json`; every real call site uses
`import { toast } from 'sonner'`, a **named** import, not the default
import this section previously showed). Toasts are for actions: save,
delete, copy.

```jsx
import { toast } from 'sonner';

// ✅ Success toast
toast.success('Bill saved successfully.');

// ✅ Error toast — error.message is already the normalised, human reason
// (from the axios interceptor — see FRONTEND ERROR CONVENTIONS above)
try {
  await api.post('/api/bills', payload);
  toast.success('Bill created.');
} catch (error) {
  toast.error(error.message);
}

// ❌ Never toast a hardcoded generic string, or the raw error object —
// both hide the actual reason and force the user to guess
toast.error('Something went wrong');  // no cause, even though error.message had one
toast.error(JSON.stringify(error));   // JSON blob
```

**Toast rules:**
- Success: 3 seconds auto-dismiss
- Error: 5 seconds auto-dismiss (user needs time to read)
- Never stack more than 3 toasts
- Never toast a 401 — the interceptor already redirects

### 2. Inline form errors — field-level feedback

Show below the field that caused the error. Use red text, not a toast.

```jsx
// ✅ Correct — inline, specific, actionable
<div>
  <label>Doctor Name</label>
  <input
    className={cn("border rounded px-3 py-2", error.doctorName && "border-red-500")}
    {...register('doctorName')}
  />
  {error.doctorName && (
    <p className="text-xs text-red-600 mt-1">{error.doctorName.message}</p>
  )}
</div>

// ❌ Never — toast for field validation errors
toast.error("Doctor name is required");
```

### 3. Page-level error state — full fetch failure

When a page fails to load its data entirely, show an error state with retry:

```jsx
// ✅ Correct pattern
function BillingPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/bills');
      setBills(res.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBills(); }, []);

  if (loading) return <TableSkeleton />;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <p className="text-red-600 text-sm">{error}</p>
      <AppButton variant="outline" onClick={fetchBills}>Retry</AppButton>
    </div>
  );

  return <BillsTable bills={bills} />;
}
```

### 4. Inline action errors — inside a table row or card

When an action on a specific item fails (e.g., delete, status change):

```jsx
// ✅ Correct — toast with context
// Note: there is no DELETE /api/bills/{id} — bills can never be hard- or
// soft-deleted (docs/07_BUSINESS_LOGIC.md's "what cannot be done" table);
// a customer is a real, soft-deletable resource, used here instead.
const handleDeleteCustomer = async (customerId) => {
  try {
    await api.delete(`/api/customers/${customerId}`);
    toast.success('Customer deleted.');
    fetchCustomers(); // refresh
  } catch (err) {
    toast.error(err.message);
  }
};
```

---

## LOADING STATES

Every async operation must have a loading state. No "invisible loading."

```jsx
// ✅ Button loading state — disables button, shows spinner
const [saving, setSaving] = useState(false);

const handleSave = async () => {
  setSaving(true);
  try {
    await api.post('/api/bills', payload);
    toast.success('Bill saved.');
  } catch (err) {
    toast.error(err.message);
  } finally {
    setSaving(false);
  }
};

<AppButton loading={saving} onClick={handleSave}>Save Bill</AppButton>
```

```jsx
// ✅ Page load skeleton — never show a blank page
if (loading) return <TableSkeleton rows={8} />;
```

```jsx
// ✅ Partial skeleton — loading indicator inside a section
if (fetchingBatches) return <InlineLoader />;
```

---

## SPECIFIC ERROR SCENARIOS

> The three below are illustrative, not a promise the exact wording stays
> frozen forever — `routers/billing.py` is the source of truth if these
> drift again. Corrected August 22, 2026 to match what's actually raised
> today (was previously a different, made-up wording for both).

### Insufficient stock

```python
# Backend raises (routers/billing.py::_deduct_stock_and_record — added
# Aug 22, 2026; previously this check didn't exist at all and a sale could
# silently oversell a batch, see docs/07_BUSINESS_LOGIC.md):
raise HTTPException(
    status_code=400,
    detail=(f"Insufficient stock for {product.name} in batch {batch.batch_number}: "
            f"{old_qty} available, {pack_change} requested"))
```

```jsx
// Frontend: toast the message — it's already human-readable
toast.error(error.message);
```

### Selling above MRP

```python
# Backend raises (routers/billing.py::create_bill / update_bill — added
# Aug 22, 2026; previously not enforced server-side at all):
raise HTTPException(
    status_code=400,
    detail=(f"Selling price ₹{mrp_paise / 100:.2f} for {product.name} exceeds "
            f"MRP ₹{batch.mrp_paise / 100:.2f} for batch {batch.batch_number}"))
```

```jsx
// Frontend: toast the message
toast.error(error.message);
```

### Schedule H1 without doctor

```python
# Backend raises (routers/billing.py — the real wording is "Prescription
# details required", not "Doctor name is required"):
raise HTTPException(
    status_code=400,
    detail=f"Prescription details required for Schedule H1 drug: {product.name}")
```

```jsx
// Frontend: show inline on the doctor name field AND as a toast
```

### Duplicate bill number (concurrent race — should not happen with DB sequence)

```python
raise HTTPException(409, detail="A bill with this number already exists. Please try again.")
```

### Session expired

Handled by the axios interceptor — automatic redirect to `/` (the login page) on a 401. No
component-level code needed.

### Network offline

```js
// error.message (from the axios interceptor) is:
"Could not reach the server. Check your connection and try again."
```

Display as a toast. The retry button on the page-level error state handles reconnect.

### Form validation (client-side Zod)

```jsx
// react-hook-form + zod — errors auto-populate per field
const schema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  items: z.array(z.object({...})).min(1, 'Add at least one item'),
});

// Show inline below each field (see pattern #2 above)
// Never toast client-side validation errors
```

> **Component:** `import { ErrorState } from '@/components/shared'` — always use this, never inline the error UI.

---

## EMPTY STATES vs ERROR STATES

These are different. Do not mix them.

| Situation | Component | Example |
|-----------|-----------|---------|
| API returned 0 results | `<EmptyState>` or named variant | No bills found for this date range |
| API call failed | Inline error + Retry | Could not load bills. Retry |
| First time use | Named empty state with CTA | `<BillingEmptyState />` with "Create First Bill" |

```jsx
// ✅ Correct distinction
if (loading) return <TableSkeleton />;
if (error) return <ErrorState message={error} onRetry={fetchBills} />;
if (bills.length === 0) return <BillingEmptyState />;
return <BillsTable bills={bills} />;
```

---

## BACKEND LOGGING

```python
import logging
logger = logging.getLogger(__name__)

# ✅ Log at the right level
logger.info(f"Bill {bill_number} created for pharmacy {pharmacy_id}")
logger.warning(f"Stock low for batch {batch_id}: {qty_on_hand} remaining")
logger.error(f"Bill creation failed: {str(e)}", exc_info=True)

# ❌ Never log sensitive data
logger.info(f"User {email} logged in with password {password}")  # never
logger.debug(f"JWT token: {token}")                               # never
```

---

## ANTI-PATTERNS

```jsx
// ❌ Silent catch
try {
  await api.post('/api/bills', payload);
} catch (e) {
  // nothing here — user sees nothing, state is broken
}

// ❌ Raw error in UI — only safe if it went through the shared `api` client's
// interceptor first; a native fetch() or a raw axios instance still gives you
// "Request failed with status code 400" instead of a real reason
<p>{error.message}</p>

// ❌ Alert() for errors
alert("Something went wrong");

// ❌ console.log only
catch (e) { console.log(e); }

// ❌ Never clearing error state before retry
// User clicks retry, old error message stays while loading
// Fix: setError(null) before the fetch call
```

---

*Every catch block must display something. Every error must offer a next step.*
