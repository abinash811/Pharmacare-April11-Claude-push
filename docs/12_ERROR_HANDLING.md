# PharmaCare — Error Handling
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Every error must be catchable, displayable, and recoverable. No silent failures.

---

## PHILOSOPHY

1. **Never let an error disappear silently.** Every catch block must do something visible.
2. **User-facing messages are human, not technical.** No stack traces, no "500 Internal Server Error" raw text.
3. **Always offer a next action.** "Something went wrong" + Retry button beats "Something went wrong" alone.
4. **Fail loud in dev, fail graceful in prod.** `console.error` in dev is fine. Raw errors in the UI are not.

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

For field-level validation errors (422), FastAPI returns:

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

### Raising Errors in Routers

```python
# ✅ Correct — specific message, correct status code
from fastapi import HTTPException

raise HTTPException(status_code=400, detail="Doctor name is required for Schedule H1 drug: Alprazolam 0.5mg")
raise HTTPException(status_code=404, detail="Invoice not found.")
raise HTTPException(status_code=409, detail="A bill with this number already exists.")
raise HTTPException(status_code=400, detail=f"Insufficient stock in batch {batch.batch_number}. Available: {batch.qty_on_hand}, requested: {quantity}")

# ❌ Never — vague messages
raise HTTPException(status_code=400, detail="Bad request")
raise HTTPException(status_code=500, detail="Error")
raise Exception("something broke")  # unhandled — returns raw 500
```

### Global Exception Handler

`backend/main.py` registers a catch-all:

```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."}
    )
```

Never remove this handler. It prevents raw tracebacks from reaching the client.

---

## FRONTEND ERROR CONVENTIONS

### The axios instance catches 401s globally

`frontend/src/lib/axios.js` intercepts 401 responses and redirects to `/login`.

```js
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

You do NOT need to handle 401 in individual components. The interceptor handles it.

### Reading error messages from API responses

```js
// ✅ Correct — reads FastAPI's detail field
const getErrorMessage = (error) => {
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    // FastAPI validation errors return an array
    if (Array.isArray(detail)) {
      return detail.map(d => d.msg).join(', ');
    }
    return detail;
  }
  if (error.message === 'Network Error') {
    return 'Cannot reach the server. Check your connection.';
  }
  return 'Something went wrong. Please try again.';
};
```

---

## ERROR DISPLAY PATTERNS

### 1. Toast notifications — transient feedback

Use `react-hot-toast` (or Shadcn `<Sonner>` if installed). Toasts are for actions: save, delete, copy.

```jsx
import toast from 'react-hot-toast';

// ✅ Success toast
toast.success('Bill saved successfully.');

// ✅ Error toast — show the API message
try {
  await api.post('/api/bills', payload);
  toast.success('Bill created.');
} catch (error) {
  toast.error(getErrorMessage(error));
}

// ❌ Never toast raw errors
toast.error(error.message);           // "Request failed with status code 400"
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
      const res = await api.get('/api/invoices');
      setBills(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
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
const handleDelete = async (billId) => {
  try {
    await api.delete(`/api/invoices/${billId}`);
    toast.success('Bill deleted.');
    fetchBills(); // refresh
  } catch (err) {
    toast.error(getErrorMessage(err));
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
    await api.post('/api/invoices', payload);
    toast.success('Bill saved.');
  } catch (err) {
    toast.error(getErrorMessage(err));
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

### Insufficient stock

```python
# Backend raises:
raise HTTPException(400, detail=f"Insufficient stock in batch {batch.batch_number}. Available: {batch.qty_on_hand}, requested: {quantity}")
```

```jsx
// Frontend: toast the message — it's already human-readable
toast.error(getErrorMessage(error));
```

### Schedule H1 without doctor

```python
# Backend raises:
raise HTTPException(400, detail=f"Doctor name is required for Schedule H1 drug: {product_name}")
```

```jsx
// Frontend: show inline on the doctor name field AND as a toast
```

### Duplicate bill number (concurrent race — should not happen with DB sequence)

```python
raise HTTPException(409, detail="A bill with this number already exists. Please try again.")
```

### Session expired

Handled by the axios interceptor — automatic redirect to `/login`. No component-level code needed.

### Network offline

```js
// getErrorMessage() returns:
"Cannot reach the server. Check your connection."
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

// ❌ Raw error in UI
<p>{error.message}</p>   // "Request failed with status code 400"

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
