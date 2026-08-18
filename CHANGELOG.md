# Changelog

Every change to PharmaCare, in order, newest first. This is the product's history —
read it to see how PharmaCare has grown over time.

Format follows [Keep a Changelog](https://keepachangelog.com/). Each entry says
**what** changed and **why**, not just a file list.

---

## [Unreleased]

### Added
- `.githooks/pre-commit` — blocks a commit if staged files break a `CLAUDE.md` rule
  (raw `<button>`, hardcoded hex colors, files over 300 lines, direct Shadcn button
  imports, ESLint errors, backend flake8 issues). Explains the exact rule violated
  on every block. Checks only staged files, so pre-existing tech debt elsewhere never
  blocks an unrelated commit.
- `flake8` added to `backend/requirements.txt` — CI's backend lint step referenced it
  but it was never actually installed, so backend linting was silently broken.

### Fixed
- `scripts/design-guard.sh` only scanned `.js`/`.jsx` files. Nearly all shared
  components and several pages are `.tsx`/`.ts`, so the guard was blind to most of
  the codebase. Now scans all four extensions.
- Inventory page (`/inventory`) had drifted from the rest of the app's design system:
  a hand-rolled search input and filter button instead of the shared `SearchInput`/
  `AppButton`, a local duplicate `StatusBadge` instead of the real shared one, raw
  `<button>` tags in the filter drawer and empty state, and a hand-rolled pagination
  footer instead of the shared `PaginationBar`. All replaced with the shared
  components so Inventory now matches every other list page. `SearchInput` gained an
  `inputRef` prop and `StatusBadge` gained a `dot` prop (both backward-compatible)
  to support this without forking either component.

---

## How to add an entry

Every time we finish a feature or fix, add a dated entry above `[Unreleased]`
(or add to `[Unreleased]` if it hasn't shipped yet), using this shape:

```md
## [YYYY-MM-DD] Short title of what shipped

### Added / Changed / Fixed / Removed
- What changed, and why it mattered — one line each.
```
