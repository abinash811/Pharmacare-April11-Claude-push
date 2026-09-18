---
paths:
  - "frontend/src/**/*.{jsx,tsx,js,ts}"
  - "PharmaCare Design System/**/*"
---

# Design System — Visual Authority

Moved out of `CLAUDE.md` Sep 18, 2026 to keep that file under Anthropic's
documented 200-line target — this only loads when you're actually touching
frontend UI code, instead of every session regardless of task.

**Location:** `PharmaCare Design System/` folder in the project root.

> Before building any new page, component, or UI pattern — **check this folder first.**
> The HTML previews are the ground truth for visual output. Code must match them.

| File | What it governs |
|------|----------------|
| `colors_and_type.css`                   | All brand color + typography + spacing + motion tokens — single file, not split into `tokens/colors.css`/`tokens/typography.css` (those don't exist; this table listed them for a while, a live example of the doc-drift problem) |
| `preview/design-auth.html`              | Auth page — split layout, both breakpoints |
| `preview/design-billing-shortcuts.html` | Billing header — shortcut badges, legend popover |
| `preview/design-dashboard-zero.html`    | Dashboard — zero state for new pharmacies |
| `preview/motion.html`                   | Duration/easing scale — same tokens as `colors_and_type.css`, rendered as chips |
| ...35 more `preview/*.html` files        | One per pattern (buttons, modals, forms, tables, empty states, dark mode, etc.) — this table is a sample, not the full index; browse the folder |

**Rule:** If a design preview exists for what you're building, match it exactly. If none exists, follow CLAUDE.md patterns and create a preview after shipping.

> ⛔ HARD STOP: Before writing ANY component, page, or UI pattern — open this folder and check. No exceptions. No skipping. Code first = rework guaranteed.
