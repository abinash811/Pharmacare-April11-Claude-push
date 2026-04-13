# PHARMACARE — DECISIONS LOG
# Every important decision, why it was made, when
# Last updated: April 13, 2026

---

## TECHNOLOGY DECISIONS

### PostgreSQL over MongoDB
- **Date:** April 11, 2026
- **Decision:** Migrate from MongoDB to PostgreSQL
- **Why:** Pharmacy is financial data. Relational structure fits perfectly — bills have line items, line items reference batches, batches belong to products, products have suppliers. Complex GST reports are simple SQL but painful in MongoDB. Every serious Indian fintech (Razorpay, Zerodha, Freshworks) uses PostgreSQL.
- **When to revisit:** Never. This is the right call.

### Money stored in paise (integers)
- **Date:** April 11, 2026
- **Decision:** Store all money as INTEGER in paise (₹1 = 100 paise)
- **Why:** Floating point arithmetic gives wrong results. ₹125.50 as float = 125.4999999... GST calculations on wrong values = financial errors = legal risk.
- **Example:** ₹1,234.50 stored as 123450 paise. Always exact.
- **When to revisit:** Never. Industry standard for financial applications.

### TypeScript for frontend
- **Date:** April 11, 2026
- **Decision:** Convert React frontend from JavaScript to TypeScript
- **Why:** Financial product handling real money needs type safety. Catches bugs before they happen. Every international product uses TypeScript.
- **Status:** Planned for Phase 5

### Keep FastAPI (Python backend)
- **Date:** April 11, 2026
- **Decision:** Keep Python FastAPI, don't switch to Node.js
- **Why:** FastAPI is modern, fast, readable. Switching to Node.js would waste months for no real benefit at current scale. FastAPI handles 10,000+ pharmacies easily.
- **When to revisit:** When scaling beyond 100,000 concurrent users

### Feature-based folder structure (frontend)
- **Date:** April 11, 2026
- **Decision:** Organize frontend by features not by file type
- **Why:** International standard. Each feature is self-contained — components, hooks, utils all in one folder. A developer only needs to look in one place to understand a feature.
- **Reference:** Linear, Stripe, Vercel all use this pattern

### No file over 300 lines
- **Date:** April 11, 2026
- **Decision:** Any file exceeding 300 lines must be broken down
- **Why:** Long files indicate mixed responsibilities. Hard to understand, hard to maintain, hard to test. International standard is small, focused files.

### Soft deletes everywhere
- **Date:** April 11, 2026
- **Decision:** Never hard delete pharmacy data. Use deleted_at timestamp.
- **Why:** Pharmacy data is financial/legal data. Deleting a product that was sold breaks audit trails and GST records. Indian law requires records kept for minimum 3-7 years.

### Snapshot product details in bills
- **Date:** April 11, 2026
- **Decision:** Copy product name, batch, price into bill_items at time of sale
- **Why:** If you rename a medicine later, old bills must show the original name. Legally required. Industry standard.

---

## PRODUCT DECISIONS

### Single pharmacy today, chains tomorrow
- **Date:** April 11, 2026
- **Decision:** Every database table has pharmacy_id from day one
- **Why:** Adding multi-pharmacy support later means massive schema changes. Adding pharmacy_id now costs nothing and makes scaling to chains/hospitals trivial.

### Steel Blue (#4682B4) as primary color
- **Date:** April 2026 (pre-existing decision)
- **Decision:** Steel Blue is the ONLY primary color. No teal variants ever.
- **Why:** Standardized across entire app. Teal was the old color from early Emergent Labs work.

### Customers.js as design reference
- **Date:** April 2026 (pre-existing decision)
- **Decision:** Every page must match Customers.js pixel-for-pixel
- **Why:** It's the most complete, most correct page in the app. Gold standard.

### FEFO (First Expiry First Out) for billing
- **Date:** April 2026 (pre-existing decision)
- **Decision:** Always suggest the batch expiring soonest first when billing
- **Why:** Pharmacy standard. Prevents expired medicines sitting in stock while newer stock is sold. Legal and financial best practice.

### Indian Financial Year as default date range
- **Date:** April 2026 (pre-existing decision)
- **Decision:** All date pickers default to April 1 - March 31
- **Why:** Indian businesses report by financial year, not calendar year. Accountants need this by default.

---

## ARCHITECTURE DECISIONS

### Monolithic server.py → Router files
- **Date:** April 11, 2026
- **Decision:** Split 7,670 line server.py into domain router files
- **Why:** Single 7,670 line file is unmaintainable. International standard is small focused files. Makes onboarding new developers fast.
- **Status:** Complete — structure (Phase 2) and all query migrations (Phase 3) done.

### SQLAlchemy 2.0 async
- **Date:** April 11, 2026
- **Decision:** Use SQLAlchemy 2.0 with asyncpg driver
- **Why:** Modern async Python. Matches FastAPI's async nature. Best performance.

### Alembic for migrations
- **Date:** April 11, 2026
- **Decision:** Use Alembic for database schema migrations
- **Why:** Industry standard for SQLAlchemy projects. Version controlled schema changes. Safe to run in production.

### Paise-to-rupees conversion at API boundary only
- **Date:** April 12-13, 2026
- **Decision:** All money stored as integer paise in PostgreSQL. Conversion to float rupees happens only at the API response boundary, never in business logic.
- **Why:** Keeps all internal math exact (integer arithmetic). Frontend receives rupees as floats for display. Prevents rounding errors in GST calculations, totals, and reports.
- **Pattern:** Helper `_p2r(paise)` or `_paise_to_rupees(paise)` used in every router.

### No separate payments/refunds tables for bills
- **Date:** April 12, 2026
- **Decision:** Bill payments tracked directly on the `bills` row (`amount_paid_paise`, `balance_paise`) — no `bill_payments` table.
- **Why:** Pharmacy billing is pay-at-counter. One payment per bill in 99% of cases. A separate payments table adds complexity for no real benefit. Purchases DO have a payments table because supplier invoices have multiple partial payments.

### Background tasks use their own DB session
- **Date:** April 13, 2026
- **Decision:** FastAPI `BackgroundTasks` (like bulk Excel import) create their own `AsyncSessionLocal()` session rather than using the request's `Depends(get_db)` session.
- **Why:** The request session is closed after the response is sent. Background tasks run after response, so they need an independent session with their own commit/rollback.

### Bill items joined from separate table, not embedded
- **Date:** April 12, 2026
- **Decision:** MongoDB's embedded `items[]` array in bills → separate `bill_items` table with `bill_id` FK. Same pattern for purchase_items, sales_return_items, purchase_return_items.
- **Why:** Relational normalization. Enables SQL aggregations (GST reports by item, product sales rankings) without deserializing documents. Standard PostgreSQL pattern.

### Stock movement audit trail with quantity_before/quantity_after
- **Date:** April 12, 2026
- **Decision:** Every `stock_movements` row records `quantity_before` and `quantity_after` for the affected batch.
- **Why:** Creates a complete audit trail. Any stock discrepancy can be traced by reading movements chronologically. Required for pharmacy compliance audits.

### Shared component library
- **Date:** April 2026 (pre-existing)
- **Decision:** All reusable UI in frontend/src/components/shared/
- **Why:** Change once, updates everywhere. Zero duplication. Like Figma components in code.
