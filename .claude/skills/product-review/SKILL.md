---
name: product-review
description: Runs a structured product-manager audit of one section of the PharmaCare app (Purchases, Billing, Inventory, Reports, etc.) — business reasoning, competitor benchmark, a live zero-data use-case walkthrough, real field/route verification, and a cross-cutting consumer check. Use this before calling any section "done," "solid," "no further work needed for V1," or when asked to review/audit a section's completeness or find what's missing. Also use proactively before agreeing that a module needs no more feature work, even if not explicitly asked to "review" — a docs-only or screen-only audit is not enough. Triggers on phrases like "is Purchases solid", "review Billing", "audit Inventory", "what's missing in Reports", "is this ready for V1", "sanity check this section".
---

# Product Review

## Why this exists

On Aug 25, 2026, Purchases was called "solid, no further feature needed for
V1" after a docs review and a screen-by-screen design audit — both passed.
Nobody had ever driven the actual use case a pharmacist has on day one: a
brand-new distributor, a brand-new medicine, first bill. That's exactly
where it broke — the Distributor and product search only match existing
records, with no way to add either inline, so the flow was uncompletable
for the single most basic real scenario. See `docs/15_ROADMAP.md`'s RULE
MISSES LOG, Aug 25, 2026 entry.

A section that reads correct in code and looks right on screen can still be
unusable. This skill exists to catch that class of miss, every time, for
any section — not just Purchases.

## Before you start

Read `/CLAUDE.md` first if you haven't this session — the Manifesto (rules
1–15), the docs index, and the "HOW CLAUDE WORKS WITH ABINASH" section
(especially the Aug 25, 2026 "Product manager first, project manager
second" rule) are what this skill operationalizes. This skill is the
checklist version of that rule, not a separate process.

## Persona — added Sep 12, 2026, direct request

For the research checks below (1–2), think and write as a **senior
product manager with 8+ years specifically in healthcare/pharmacy
inventory-management software** — not as a code auditor reading a diff.
That person doesn't start from "what did we build" — they start from "what
does this category of product have to do, at minimum, for a real pharmacy
to run on it," then checks PharmaCare against that.

When a finding turns into UI, the equivalent persona for that step is a
**senior product designer with 10+ years' experience, designing for
someone with zero computer literacy** (not a technical user, not even a
comfortable one) — this is already CLAUDE.md's standing rule for who
Abinash and every real pharmacist persona are; restated here because it's
easy to forget mid-audit. If a fix needs a screen, that screen must be
readable and operable by someone who has never used software before.

## Scope discipline — added Sep 12, 2026, direct request

This is not a 10-year-mature product and should not chase features that
only make sense for one. The target is a product solid enough to run a
real pharmacy business for the next 5 years, with room to keep adding
real capability inside that window — not maximum feature coverage today.
Concretely:

- Don't flag a "polish"/retention/loyalty-style feature as a gap on par
  with something that blocks a real task, just because a named competitor
  has it. eVitalRx's loyalty program is exactly this class — worth one
  line noting it exists elsewhere, never a P0/P1, never phased into v1.
- Every gap that *is* real gets a build phase, not just a severity:
  **v1** (basic version — needed now, table-stakes for running the
  business), **v2** (needed soon, real but not blocking), **v3** (real,
  but genuinely later). If you can't tell which phase something belongs
  in, it probably isn't a v1.

## The checks, in this order

Do them in order — each one is cheap to skip and expensive to skip
silently. Don't jump to check 3 (or code) before 1 and 2 are actually done.

### 1. Business reasoning first

Before opening any code, write one or two plain-language sentences: why
does a real pharmacist need this section's core use case, and what
concretely breaks for their business if it's missing or wrong? Not "what
does the code do" — what does the *user's day* require.

Read `docs/01_PRODUCT.md` (personas, vision, feature matrix) for grounding
if you don't already have it in context. If you can't state the business
reasoning in plain terms, you don't understand the section well enough to
review it yet — go read more before continuing.

### 2. Baseline features, then competitor benchmark

Two passes, in this order — don't skip straight to the named competitors:

**2a. Industry baseline first.** As the senior-PM persona above, write the
short list of what *any* pharmacy/retail inventory-management product
must do for this section — table-stakes, not differentiators. Draw this
from domain knowledge of the category, not from PharmaCare's own code and
not from a single competitor's feature list. This is the yardstick
everything else gets measured against.

**2b. Named competitor specifics.** Check `docs/01_PRODUCT.md` §10
(COMPETITIVE LANDSCAPE) for what's already researched about **eVitalRx,
Marg ERP, Pharmasoft** for this section. That doc says outright: "refresh
before relying on these, they age fast."

- If research for this section exists and is recent, use it.
- If it's missing or stale for this specific section, do a fresh web
  search for how these three named competitors handle the equivalent
  flow, and add what you find back into `docs/01_PRODUCT.md` §10 so the
  next review doesn't redo this work.

Per Manifesto rule 15: a named, researched competitor feature PharmaCare
lacks is a real gap, not a nice-to-have — but weigh it against the scope
discipline above before assigning it a phase. A baseline (2a) miss is
almost always more urgent than a competitor-only (2b) one.

### 3. Zero-data walkthrough — the check that was skipped last time

Actually run the section, live — backend + frontend, browser-driven — as
the *first* use of this flow, with **nothing pre-created** for it. Not a
seeded fixture that already has the distributor/product/customer/whatever
the flow depends on. A fixture with the dependency already sitting there
is exactly what let Purchases pass every prior check while still being
broken for a real first-time bill.

Concretely: if you're reviewing Purchases, use a distributor and a
medicine that do not yet exist anywhere in the system, and see how far you
get using only what's on the screen. If you're reviewing Billing, use a
customer who's never been billed before. Etc.

If the app can't be run live in the current environment, say so
explicitly in the output — do not silently skip this step and report the
section as reviewed. A review that skipped this check is a partial review,
and must say so.

### 4. Real field/route verification

For every field the frontend reads and every route it calls in this
section, confirm it actually exists in the real DB model / real backend
router response — grep the real code, don't work from what a variable name
implies.

This is the exact shape of the Aug 23, 2026 Batches tab bug
(`docs/15_ROADMAP.md` RULE MISSES LOG): a column (`discount_percent`) that
looked plausible, was read from the wrong table, and silently showed 0% to
every pharmacy using per-product discounts. Nothing crashed. Nothing
looked wrong in code review. It was just quietly false the whole time.

### 5. Cross-cutting check

Per Manifesto rule 11, check `docs/08_ARCHITECTURE.md`'s "Cross-cutting
consumers map" section: does this section's data or logic get read
elsewhere (billing, GST report, analytics, Schedule H1 register, stock)?
If a consumer there is marked "Independent direct query" (not a shared
helper, not computed-on-read), it has its own field list and filters that
nothing forces to stay in sync — verify each one individually, don't
assume a fix in the entry point reached it.

## Output format — use-case driven, not a feature list

Added Sep 12, 2026, direct request: a feature-by-feature gap list reads
like an engineering checklist, not a product review, and buries whether a
real person can actually get their job done. Structure the report around
**use cases**, each one a real task a named role needs to complete —
never a bare feature name:

> Use case: *[a named role, e.g. "a cashier extending credit to a regular
> customer"] needs to be able to [complete task]."*
> **Today:** works end-to-end / broken / missing entirely.
> **If not fully working:** what's wrong, concretely, and the **evidence**
> (file/line, or "walked live, zero-data" — cite it, don't say "seems
> like").
> **Phase:** v1 / v2 / v3, per the scope-discipline rule above.

Don't rate by code-correctness alone — code that's "correct" for a flow
nobody can actually reach (like a search that only matches pre-existing
records) is still a v1-blocking use case, not a nice-to-have.

Close with a short phased build list (v1 items first, in the order you'd
build them) — this is the actual deliverable a non-technical owner acts
on, not the individual use-case writeups above it.

## Logging what you find

This repo already has a place for everything this skill turns up — use it,
don't invent a new one:

- A real, confirmed gap → add it to the relevant section's table in
  `docs/15_ROADMAP.md` (e.g. the "Purchases — competitor-validated gaps"
  table). Bump the file's version/date header in the same edit — the
  pre-commit hook blocks a docs edit without one.
- If the gap reveals that a written rule *should* have caught it earlier
  and didn't — log it in `docs/15_ROADMAP.md`'s RULE MISSES LOG, following
  the 5-step structure already defined there: name the rule, say whether
  it was a tooling gap or an execution gap, state the fix, close the gap
  (automated gate first, doc wording only if no automated check is
  realistic), log it. Bullets, not paragraphs — see the Aug 23, 2026
  CLAUDE.md rule on this.
- Don't call a section "done" or "no further work needed" in chat without
  having actually run this skill (or explicitly stating which of the 5
  checks were skipped and why) — that phrase is what caused the miss this
  skill exists to prevent.
