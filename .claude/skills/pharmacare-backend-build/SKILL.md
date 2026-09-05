---
name: pharmacare-backend-build
description: Governs PharmaCare backend business logic — money math, billing/stock/GST rules, cross-cutting consumers, router conventions. Use this whenever writing or editing a FastAPI router, a service function, anything touching bills/purchases/stock/GST/H1 register, or any money calculation. Money bugs and cross-cutting misses are the two most expensive mistake classes in this codebase — this skill exists to catch both before the code ships, not after.
---

# PharmaCare Backend Build

## Why this exists

An MRP/stock/H1 check added to billing's create path didn't reach its
own update/finalize path, and the GST report didn't reach sales/purchase
returns — both discovered separately, after shipping, because the
change was verified against the entry point someone happened to be
looking at, not the whole surface area a core domain touches.

## Before you start

Read `CLAUDE.md`'s Manifesto rule 5 (money is integer paise, always),
rule 6 (soft deletes only), and rule 11 (cross-cutting changes ship as
one change) if you haven't this session.

## Non-negotiables

1. **Money is integer paise, always.** ₹1 = 100 paise. Never a float for
   a currency calculation — floats introduce rounding errors that are
   invisible until a customer's total is off by a rupee. Display-layer
   formatting converts paise → ₹ for the user; storage and math never do.
2. **Soft deletes only.** Pharmacy data is compliance data. Set
   `deleted_at`, never `DELETE FROM`. No exceptions, no "just this test
   record."
3. **No magic strings.** Every status value comes from the backend's own
   enum/constant, not a bare string typed inline — see
   `docs/16_NAMING_CONVENTIONS.md`.

## Workflow — copy this checklist into your response

```
- [ ] Step 1: Read docs/09_DATABASE.md for the real schema (or backend/models/)
- [ ] Step 2: Read docs/07_BUSINESS_LOGIC.md for the exact formula/flow this touches
- [ ] Step 3: Read docs/08_ARCHITECTURE.md's cross-cutting consumers map — does this domain have other consumers?
- [ ] Step 4: Write the router/service, following existing patterns in backend/routers/
- [ ] Step 5: If Step 3 found consumers, verify/update each one in this same change
- [ ] Step 6: Write the pytest that proves it (see pharmacare-testing skill)
```

**Step 3 is the one most often skipped.** `docs/08_ARCHITECTURE.md`'s
"Cross-cutting consumers map" (search that heading) lists, per core
domain (billing, stock, GST, H1 register), every other part of the app
that reads it. If you're touching one of these domains and skip this
step, you are shipping the entry point, not the feature — the same
mistake that caused the Aug 22, 2026 MRP/stock/H1 miss this skill is
named after.

**Query/index concerns:** if this change adds a new query pattern or a
table is getting large, use the `postgres` MCP tools
(`analyze_query_indexes`, `explain_query`) against the local dev database
to check before assuming an index isn't needed — see the
`pharmacare-database` skill for the full workflow.
