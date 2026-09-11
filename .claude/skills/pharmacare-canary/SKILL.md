---
name: pharmacare-canary
description: Post-merge health check — verifies the real app actually boots and its key pages don't throw, regress, or silently fail, using a real browser and a real backend, not just green unit tests. Use this after merging a PR to main, after any dependency/env/CI-workflow change, or when asked "is the app actually healthy" / "did that merge break anything." Scoped to what's real today (local + CI — no live staging/production exists yet, see docs/13_DEPLOYMENT.md) and written to activate against a real hosted URL the moment one exists, without needing to be rewritten.
---

# PharmaCare Canary

## Why this exists

CI (`ci.yml`) passes lint, unit tests, and E2E on a branch before merge —
but nothing re-checks the app *after* code actually lands on `main`. A
merge can introduce a console error, a Lighthouse regression, or a broken
page that no existing test happens to cover, and nobody would notice until
a pharmacist hit it live. `docs/15_ROADMAP.md` KNOWN ISSUES already flags
"No CI/CD pipeline" and "No staging environment" as open gaps — this skill
is the manual stand-in for "watch it after it ships" until real hosting
closes those gaps for good, so the absence of a deploy pipeline doesn't
also mean zero post-merge verification.

## Before you start

Read `docs/13_DEPLOYMENT.md`'s "CI/CD — WHAT ACTUALLY EXISTS" section
fresh — it's a Living Status doc, and whether a real staging/production
URL exists yet changes which mode below applies. Don't assume Mode A from
memory of a past session.

## Mode A — today (no live hosting exists yet)

Run this after merging to `main`, or after any dependency/env/CI-workflow
change:

1. **Start clean.** Pull latest `main`, start backend + frontend exactly
   like a fresh clone would (`docs/13_DEPLOYMENT.md` LOCAL SETUP) — not
   this session's already-running servers, so nothing an existing session
   already patched over hides a real startup problem.
2. **Confirm real startup**, per `CLAUDE.md`'s "Verify after every
   infrastructure change" rule: backend logs `Application startup
   complete`; frontend compiles with no errors.
3. **Drive the real key pages** with the `playwright`/`chrome-devtools`
   MCP tools — Dashboard, Billing, Inventory, Purchases at minimum
   (`docs/01_PRODUCT.md`'s personas confirm Billing as the highest-volume
   page — the Cashier persona handles 80-100 bills/day — so it never gets
   skipped even on a quick pass). For each page:
   - `list_console_messages` — zero new errors
   - `list_network_requests` — zero unexpected failed calls
4. **Run the Lighthouse gate**: `npx lhci autorun` (`frontend/
   lighthouserc.js`, added Sep 8, 2026) and compare against the last
   recorded baseline in `docs/19_PERFORMANCE.md`'s LIGHTHOUSE CI section —
   a real score drop below the recorded number is a regression to report,
   not noise to wave off.
5. **Report pass/fail per page** — name what you actually checked on each
   one, not "looks fine." Matches this project's evidence-over-assertion
   standard (same spirit as `pharmacare-testing`/`product-review`).

## Mode B — once real staging/production hosting exists

Check `docs/13_DEPLOYMENT.md`'s Environments table for a real, live URL
before assuming this mode applies. Once one exists:

- Point steps 3–4 at the real deployed URL instead of `localhost` — the
  checks themselves don't change, only the target.
- Run this **after every deploy**, not just after a manual merge — a
  scheduled Routine (or a CI job in `land-and-deploy`-style automation, if
  that ever gets built) should trigger it rather than relying on someone
  remembering to run it by hand.
- A failure here is worse than a Mode-A failure — it means a real pharmacy
  is looking at the broken page right now. Treat it as the highest-priority
  interrupt, not something to batch with other work.

## Logging

A real regression caught this way is a P0 bug — fix it per
`pharmacare-investigate`'s workflow (don't guess at the fix; trace it).
If a written rule should have caught it before merge (e.g. "CI's E2E job
covers this page but the assertion was too narrow to catch it"), log it in
`docs/15_ROADMAP.md`'s RULE MISSES LOG per the existing 5-step structure.
