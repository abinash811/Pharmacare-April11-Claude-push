---
name: pharmacare-frontend-build
description: Governs how PharmaCare frontend code is wired to the backend — API calls, status values, routes, error handling. Use this whenever writing a frontend filter, API call, status check, form submission, or anything that reads or writes data through the backend. This is the "connected to reality, not assumptions" gate — every filter bug, 404, and silent no-op this project has shipped came from skipping the order this skill enforces. Separate from pharmacare-design (visual/component rules) — this one governs data wiring and correctness.
---

# PharmaCare Frontend Build

## Why this exists

The Purchases list's Cash/Credit/Due filter was a complete no-op for
months: the frontend sent `purchase_on`/`payment_status` query params the
backend never declared, and FastAPI silently drops unrecognized params —
so every click did nothing, with no error. That bug, and every filter
bug and 404 before it, came from writing the frontend before checking
what the backend actually accepts and returns.

## Before you start

Read `CLAUDE.md`'s Manifesto rule 9 (no magic strings, no unverified
routes) and rule 10 (errors must say why) if you haven't this session.

## Mandatory order — do not skip ahead

```
- [ ] Step 1: Read the DB model (backend/models/, or docs/09_DATABASE.md)
- [ ] Step 2: Read the backend router — confirm the route exists, its params, its response shape (docs/10_API.md)
- [ ] Step 3: Check constants/domainConstants.js — add the status value there first if missing
- [ ] Step 4: Write the frontend, connected to what steps 1-3 confirmed
- [ ] Step 5: Every error toast shows error.message, not a hardcoded fallback
```

**Step 1 — DB model.** Know what columns exist and what values are
actually stored before assuming a field name or shape. `docs/09_DATABASE.md`
is the fast reference; `backend/models/` is the source of truth if the
doc is ever stale.

**Step 2 — backend router.** Confirm the exact route path, accepted query
params, and response shape in the actual router file, or `docs/10_API.md`.
A route you haven't confirmed exists is the bug, not a shortcut — FastAPI
silently drops params it doesn't declare, so a wrong param name fails
silently, not loudly.

**Step 3 — `constants/domainConstants.js`.** Every status value
(`'draft'`, `'paid'`, `'parked'`, etc.) must be defined there, not typed
as a raw string inline. If the value you need isn't defined yet, add it
there first, before using it anywhere.

**Step 4 — write the frontend.** Now that you know the real shape, wire
it up. If this touches visual components, loading states, or page
structure, also consult the `pharmacare-design` skill.

**Step 5 — error handling.** Every `toast.error(...)` must surface the
real `error.message` (already normalized by `frontend/src/lib/axios.js`'s
interceptor — see `docs/12_ERROR_HANDLING.md`). A generic
`"Failed to save"` with no reason is a bug: the user can't fix what they
can't see.

## Cross-cutting check

If this change touches billing, stock, GST, or the H1 register, it's
read by more than the screen you're looking at (the GST report,
analytics, and the H1 register all consume billing data independently).
Check `docs/08_ARCHITECTURE.md`'s cross-cutting map and verify every
listed consumer in the same change — not as a follow-up.
