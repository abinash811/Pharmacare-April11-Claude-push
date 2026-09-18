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

**Touching auth, passwords, sessions, sensitive data, or anything that
parses external input (file upload, webhook, third-party callback)?**
Read `docs/14_SECURITY.md` first — added Sep 18, 2026, this doc had no
skill pointing to it at all before, unlike every other domain doc, and
it holds real, current findings (e.g. `SECRET_KEY`'s insecure fallback,
no backend password minimum) worth knowing before writing adjacent code.

`docs/20_CODE_QUALITY.md` (also unreferenced by any skill until Sep 18,
2026) formally defines the root-cause-fix rule and SOLID/DRY principles
this skill's own non-negotiables apply — worth a read if a fix feels
like a patch rather than closing the actual gap.

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
4. **Every mutating endpoint (POST/PUT/PATCH/DELETE) is permission-checked
   and audit-logged, on top of being tenant-scoped.** Added Sep 16, 2026 —
   these three (plus paise typing) are the "standing endpoint invariants,"
   `docs/08_ARCHITECTURE.md`'s cross-cutting map for endpoint shape rather
   than domain data. All four now have an automated gate
   (`design-guard.sh` Rules 13/15-17) that blocks the commit if missed —
   but the gate only proves *something* is there, not that it's the
   *right* something (the correct permission action, the right
   `entity_type`). Get it right the first time: call the module's
   `_require_<module>_permission(current_user, "<action>", db)` and
   `_record_audit(...)` yourself, matching the pattern already used by
   sibling endpoints in the same router — don't rely on the gate to catch
   a wrong-but-present call.

## Workflow — copy this checklist into your response

```
- [ ] Step 1: Read docs/09_DATABASE.md for the real schema (or backend/models/)
- [ ] Step 2: Read docs/07_BUSINESS_LOGIC.md for the exact formula/flow this touches
- [ ] Step 3: Read docs/08_ARCHITECTURE.md's cross-cutting consumers map — does this domain have other consumers?
- [ ] Step 4: Write the router/service, following existing patterns in backend/routers/
- [ ] Step 5: If Step 3 found consumers, verify/update each one in this same change
- [ ] Step 6: New/edited endpoint is tenant-scoped, permission-checked, and audit-logged
      (docs/08_ARCHITECTURE.md's "Standing endpoint invariants" table) — or has a reviewed
      # tenant-safe: / # permission-exempt: / # audit-exempt: comment if deliberately not
- [ ] Step 7: New endpoint, or changed request/response/behavior on an existing one, is
      documented in docs/10_API.md in this same change — that doc's own rule, and nothing
      currently gates it (added Sep 18, 2026 after PUT /bills's same-day-edit behavior
      shipped without it, caught only by a docs review, not by any check)
- [ ] Step 8: Write the pytest that proves it (see pharmacare-testing skill)
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
