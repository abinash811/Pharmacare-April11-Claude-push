---
name: pharmacare-investigate
description: Enforces root-cause-first debugging before any bug fix — trace the real data path and confirm the defect with evidence before touching code. Use this whenever fixing a reported bug, an unexpected value, a crash, or "X isn't working," before writing a single line of fix code. Also use when a fix attempt fails, to force re-investigation instead of a second guess. This formalizes CLAUDE.md Manifesto rule 14 ("no assumptions, verify every time") as an enforced workflow, not just a written rule to remember.
---

# PharmaCare Investigate

## Why this exists

`docs/15_ROADMAP.md`'s RULE MISSES LOG is full of bugs that weren't typos —
they were confident guesses that turned out wrong, found only because
someone eventually traced the real path instead of trusting how the code
read:

- The Batches tab's Disc.(%) column read `batch.discount_percent` — a
  field that never existed on any batch response, because discount is
  product-level. Looked plausible. Was 0% for every pharmacy using
  discounts, silently, for months.
- Two Edit Product screens called `PUT /products/{sku}` — a route that
  never existed (the real one takes a UUID). Every save 500'd. It read as
  a correct, working API call in both files.
- `useInventorySearch.js`'s cache "bust" set a module variable to `null`
  with a comment saying it forced a refetch. It didn't — nulling a
  variable doesn't make an already-mounted component refetch. Looked
  deliberate, was never true.

None of these were caught by reading the code and judging it plausible.
Each was only found by someone tracing the actual data path and checking
it against real behavior. This skill makes that tracing step mandatory,
not something to remember to do.

## Before you start

Read `CLAUDE.md` Manifesto rule 14 and skim `docs/15_ROADMAP.md`'s RULE
MISSES LOG if you haven't this session — the entries above are excerpts;
the full log has more, and it's worth seeing the pattern before you skip a
step below because "this one's obviously right."

## The Iron Law

**No fix without a confirmed root cause.** A plausible-sounding
explanation is not a confirmed root cause. You need to have actually
*seen* the defect — a log line, a failing test, a real value printed at
runtime, a grep of the real code path — not inferred it from a variable
name, a comment's claim, or "this is probably what's happening."

## Steps, in order

1. **Reproduce it first, live.** Before reading any code, confirm the bug
   is real and pin down its exact conditions — what data, what user
   action, what shows up wrong. If you can't reproduce it, say so. Don't
   fix a bug you haven't actually seen happen.
2. **Trace the real path, not the intended one.** For a wrong value,
   follow it backward: what does the UI render → what field does that
   read → what does the API *actually* return (not what a docstring
   claims) → what does the DB *actually* store. Read the real code at
   each hop. In this codebase, a bug traced this way has repeatedly turned
   out to live one hop further back than where it first looked broken.
3. **State one specific hypothesis** — name the exact file, line, and
   field you believe is wrong — before touching any code.
4. **Verify the hypothesis with real evidence**: a log/print statement, a
   curl against the real running backend, a quick test that fails exactly
   the way you predicted. If the evidence doesn't match, go back to step
   2 — don't patch around a hypothesis you haven't confirmed.
5. **Only then write the fix.** If the fixed logic is read by more than
   one place, check `docs/08_ARCHITECTURE.md`'s cross-cutting consumers
   map (same check `product-review` step 5 uses) before calling it done.
6. **Three failed fix attempts means stop guessing, not try a fourth.**
   If a third attempt doesn't resolve it, the hypothesis from step 3 was
   wrong. Go back to step 2 with what each failed attempt actually showed
   as new evidence — write down, in chat, why each prior attempt didn't
   work, not just silently try something else.

## Scope discipline

Only touch files you've actually traced the bug through in step 2. Don't
"fix while you're in there" on adjacent code you haven't verified is
actually involved — that's a second, unverified change riding on the real
fix, and it's exactly the kind of thing that makes a later regression hard
to attribute.

## Output format

When reporting a fix, state: the **confirmed root cause** (not just the
symptom), the **file/line** where it lived, and the **evidence** that
confirmed it — same "where you confirmed it, don't say 'seems like'"
standard `product-review` already uses.

## Logging

If the investigation shows a written CLAUDE.md/docs rule should have
caught this earlier, log it in `docs/15_ROADMAP.md`'s RULE MISSES LOG
following the existing 5-step structure (name the rule, tooling gap or
execution gap, fix, gate closed, logged). This skill doesn't replace that
habit — it's what "fix the bug" should actually look like before you get
to that log entry.
