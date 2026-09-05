---
name: pharmacare-testing
description: Governs what and how to test in PharmaCare — P0/P1/P2 priority, pytest for backend, jest for frontend, and live browser verification via the playwright/chrome-devtools MCP tools. Use this whenever finishing a feature or fix, before calling any change "done," or when deciding whether a code path needs a test and at what priority. "It compiles" and "the doc says it works" are not evidence — this skill is about what actually is.
---

# PharmaCare Testing

## Why this exists

"It compiles" and a passing manual click-through have both been called
"done" before and shipped real bugs — a passing automated test is the
only thing this project treats as evidence a feature actually works.

## Before you start

Read `CLAUDE.md`'s Manifesto rule 12 (test what you build) if you
haven't this session. `docs/11_TESTING.md` is the full reference —
this skill is the workflow, that doc is the detail.

## Priority — what needs a test, and how much

- **P0 (blocks shipping):** money math, auth, anything that could lose or
  corrupt data, anything a compliance audit would check. Needs a test,
  no exceptions.
- **P1 (same sprint):** the feature's main happy path and its most likely
  failure mode.
- **P2 (nice to have):** edge cases unlikely to occur in real usage.

See `docs/11_TESTING.md`'s "WHAT TO TEST" section for the full breakdown
with examples per tier.

## Workflow

```
- [ ] Step 1: Decide the priority tier (P0/P1/P2) for the code path touched
- [ ] Step 2: Write the pytest (backend) or jest (frontend) test first if the bug is already known and reproducible
- [ ] Step 3: Run the test locally — it must fail before the fix, pass after
- [ ] Step 4: For UI changes, verify live in a real browser (see below) — a passing unit test doesn't prove the page actually renders correctly
- [ ] Step 5: Push and confirm CI is green (frontend, backend, E2E) — local passing isn't the same as CI passing
```

**Step 4 — live browser verification.** Use the `playwright` and
`chrome-devtools` MCP tools instead of writing a one-off verify script
each time:
- `playwright`'s `browser_navigate`/`browser_snapshot`/`browser_click`/
  `browser_fill_form` drive the real app like a user would
- `chrome-devtools`'s `list_console_messages` and `list_network_requests`
  catch errors a screenshot alone would miss (a silently-failed API call,
  a React warning)
- `chrome-devtools`'s `lighthouse_audit` checks performance/accessibility
  when a change touches a large page or list

**Step 5 — CI.** Per `CLAUDE.md`'s workflow agreement, CI runs
automatically on every push to a feature branch. Never treat local
`eslint`/`tsc`/`pytest` as a substitute — the real CI pipeline (fresh
install, real seeded backend, real browser E2E) has caught different
bugs than local runs before. If a backend test fails on a push that
touched zero backend files, that's the known CI-flakiness pattern
(duplicate-key races on a fresh DB) — confirm by re-running the failed
job once before treating it as a regression.
