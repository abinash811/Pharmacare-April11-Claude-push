---
name: pharmacare-design
description: Enforces PharmaCare's existing, mandated design system and component library before any UI code is written. Use this whenever building or editing a React page or component, adding a button, modal, table, form, dropdown, loading state, or error state, touching Tailwind classes, or making anything visual — even a "small" tweak. This is a compliance skill, not a creative one — PharmaCare already has a strict design system that must be matched exactly, not reinvented. Always consult this before writing JSX or className changes in frontend/src/pages or frontend/src/components.
---

# PharmaCare Design Compliance

## Why this exists

`MoreMenu`-shaped dropdowns were independently hand-rolled on 3 separate
pages before anyone noticed — one shipped without a working close-on-
outside-click. Dashboard hand-rolled its own loading pulse instead of
reusing the skeleton system that already existed. Both drifted for
months because checking the existing system wasn't a forced step before
writing code. `scripts/design-guard.sh` now catches these patterns after
the fact — this skill's job is to catch them *before*, so the commit
never needs the gate at all.

## Before you start

Read `CLAUDE.md`'s Manifesto (rules 1–4, 16) and Component audit
checklist if you haven't this session — this skill operationalizes
those rules, it doesn't replace them.

## The non-negotiables

These are settled decisions, not style preferences — treat them like a
database migration, not a suggestion:

1. **Check `PharmaCare Design System/` first.** The HTML previews in that
   folder are the ground truth for visual output. If a preview exists for
   what you're building, match it exactly. If none exists, follow the
   rules below and create a preview after shipping.
2. **One component, one way.** `AppButton` (never a raw `<button>`),
   `PageHeader`, `PageTabs`, `MoreMenu`. No hand-rolled equivalent, ever,
   even a "just this once" one.
3. **Tokens, not hex.** `bg-brand`, `text-brand`, `border-brand`,
   `hover:bg-brand-dark`. Never a literal hex value, never `bg-[#...]`.
4. **Every loading state is a skeleton.** `TableSkeleton` / `PageSkeleton`
   / `CardSkeleton` / `InlineLoader` from `@/components/shared`, or the
   raw `Skeleton` primitive (`@/components/ui/skeleton`) composed for a
   one-off shape. Never a spinner, never `return null` while data loads.
5. **Standard page shape.** `px-8 py-6 min-h-screen bg-page` + `PageHeader`
   + `PageTabs` (see `CLAUDE.md`'s Quick-Reference Rules for the exact
   JSX). `flex flex-col h-full` is reserved for workspace pages
   (`BillingWorkspace`, `PurchaseNew`) — nowhere else.
6. **300 lines per file, hard limit.** Split into components before you
   hit it, not after.
7. **Errors say why.** Every `toast.error(...)` shows the real
   `error.message` — never a hardcoded generic fallback alone.

## Workflow — copy this checklist into your response

```
- [ ] Step 1: Checked `PharmaCare Design System/` for a matching preview
- [ ] Step 2: Checked docs/06_COMPONENTS.md for this component's props/usage
- [ ] Step 3: Checked docs/17_ACCESSIBILITY.md for this pattern's a11y requirements
- [ ] Step 4: If large list/table — checked docs/19_PERFORMANCE.md + applied relevant picks below
- [ ] Step 5: Wrote the code
- [ ] Step 6: Ran `bash scripts/design-guard.sh` — must exit 0
```

**Step 1 — Design System folder.** Browse `PharmaCare Design System/preview/*.html`
before inventing a new pattern. Matching an existing preview beats a
"better" idea nobody agreed to.

**Step 2 — `docs/06_COMPONENTS.md`.** This is the full component reference
(props, usage, anti-patterns) — read the specific component's section,
don't guess its API from memory.

**Step 3 — `docs/17_ACCESSIBILITY.md`.** WCAG AA, ARIA, focus, contrast,
keyboard nav — read the section for the pattern you're building (modal,
form, table, etc.).

**Step 4 — `docs/19_PERFORMANCE.md`, plus 4 vetted patterns.** For any
large list or table, also apply whichever of these already-vetted
patterns fit (picked deliberately for this project, low-risk, Baseline
widely-available CSS/HTML — not experimental):
- Form fields: defer validation styling to `:user-invalid`/`:user-valid`
  (don't flag errors while the user is still typing)
- Pair that with `aria-invalid` kept in sync via a blur/input listener,
  so screen readers announce errors at the same moment sighted users see them
- Large tables/lists below the fold: `content-visibility: auto` +
  `contain-intrinsic-size` (pure CSS, no JS/React change needed)
- Sign-in/sign-up forms: correct `autocomplete="email"` /
  `autocomplete="new-password"` etc. attributes

**Step 5 — write the code.**

**Step 6 — verify.** `bash scripts/design-guard.sh` must exit 0 before
you call the work done. It automatically catches raw buttons, hardcoded
hex, hand-rolled skeletons, and hand-rolled More-menu dropdowns — but it
can't catch a missing skeleton or a copy-pasted-but-wrong component prop,
which is exactly what Steps 1–3 are for.
