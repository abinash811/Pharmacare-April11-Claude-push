---
name: pharmacare-ship-checklist
description: The final gate before calling any PharmaCare feature, fix, or enhancement "done" — cross-cutting consumers verified, tests passing, docs/roadmap/changelog updated. Use this whenever about to report a change as complete, before a commit that finishes a feature, or when asked "is this ready" / "is this done." A feature that works but leaves the docs and roadmap stale isn't finished — it just moves the miss to next session, which won't know it happened.
---

# PharmaCare Ship Checklist

## Why this exists

`docs/15_ROADMAP.md` used to hold ~80 lines of status directly in
`CLAUDE.md` — several lines went stale for months because updating them
wasn't a forced last step of shipping, just something to remember
separately. The fix wasn't a better memory, it was making the update
part of "done."

## Before you start

This is the last skill in the build sequence — `pharmacare-design`,
`pharmacare-frontend-build`, `pharmacare-backend-build`,
`pharmacare-database`, and `pharmacare-testing` govern the work itself;
this one governs what happens right before you say it's finished.

## Workflow — copy this checklist into your response

```
- [ ] Step 1: Every code path touched has a passing test (pharmacare-testing skill)
- [ ] Step 2: Cross-cutting consumers checked and verified — docs/08_ARCHITECTURE.md's map first, then an active search beyond it (see below); not just the entry point
- [ ] Step 3: bash scripts/design-guard.sh exits 0 (if frontend touched)
- [ ] Step 4: Pushed, CI confirmed green — not just "should pass"
- [ ] Step 5: docs/15_ROADMAP.md updated if this changes feature status or closes a known issue
- [ ] Step 6: docs/21_FEATURES.md updated if this ships or changes a feature's behavior
- [ ] Step 7: If a written rule should have prevented a bug that shipped anyway, name the rule and log it in docs/15_ROADMAP.md's RULE MISSES LOG
- [ ] Step 8: Consider whether the product-review skill applies before calling a whole section "done" or "solid"
```

**Step 2 — the map is not the whole check.** Added Sep 12, 2026, direct
instruction, after Customers v1 shipped (permission gates, notes,
credit-limit enforcement, real outstanding) and only got asked afterward
"did you check the other sections that depend on this?" The honest
answer was no — `docs/08_ARCHITECTURE.md`'s cross-cutting map doesn't
cover Customers at all (it says so explicitly), so consulting the map
alone gave a false "clear." Checking for real turned up three live gaps
in one pass: `BillingWorkspace`'s patient search showed no credit-limit/
outstanding info at all (a cashier only found out via a rejected bill),
`customers.py` had zero audit-log entries for any create/update/delete
(unlike billing.py/purchases.py), and the Customers Excel export omitted
the two fields the fix had just made real. None of these would have
been caught by only reading the pre-built map. So, every time, in
addition to the map:
1. **Grep broadly for the touched entity/field outside its own module's
   folder** — the frontend as a whole (`grep -rn "<entityName>\."
   frontend/src`, not just `frontend/src/pages/<Module>`), and the
   backend as a whole for the same field/column name. A hit anywhere
   else is a consumer to verify, whether or not it's in the map.
2. **Check the three consumers that are easy to forget because they're
   not "the feature" itself**: does the Audit Log capture this entity's
   mutations (grep the router for `_record_audit`)? Does any export
   (Excel/CSV/PDF) include the field you just added or changed? Does any
   *other* page's UI display or depend on this data (not just the
   module's own page)?
3. **If the module isn't in `docs/08_ARCHITECTURE.md`'s cross-cutting
   map yet, add it** once you've walked it for real — the map's own text
   says "extend this table instead of assuming they're fine." Leaving a
   newly-walked module undocumented just means the next session repeats
   the same incomplete check.

**Step 5/6 are Living Status docs** — re-read them fresh before editing,
don't trust memory of their contents from earlier in the session; they
change as fast as the code does.

**Step 7 — the RULE MISSES LOG.** When a real bug slips past a rule that
was already written down, say which rule, whether it wasn't enforced (a
tooling gap — close it with an automated check first) or wasn't followed
(an execution gap), and log it. The point is Abinash never has to ask
"which rule broke" after the fact.

**Step 8 — don't confuse "screens work" with "done."** A section that
passes design review and a fixture-based test can still be unusable for
the real use case (see `pharmacare-design`'s and this project's own
history — Purchases was called "solid" once from a docs/code audit
alone, and broke on the first real zero-data walkthrough). If this
change completes or substantially changes a whole section, that's what
a the `product-review` skill is for, not this checklist alone.
