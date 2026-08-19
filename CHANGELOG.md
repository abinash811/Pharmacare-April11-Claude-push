# Changelog

Every change to PharmaCare, in order, newest first. This is the product's history —
read it to see how PharmaCare has grown over time.

Format follows [Keep a Changelog](https://keepachangelog.com/). Each entry says
**what** changed and **why**, not just a file list.

---

## [Unreleased]

### Added
- **Signup now creates a real, separate pharmacy per account (multi-tenancy fix).**
  `POST /auth/register` previously attached every new signup to whichever pharmacy
  was first in the database and let the public form self-select "Admin" as a role —
  a live privilege-escalation hole. Signup is now a 2-step form (Account → Pharmacy)
  that creates a brand-new `Pharmacy` + `PharmacySettings` + all 4 default roles, and
  the signing-up user is always that pharmacy's Admin — no role picker. New shared
  `backend/services/provisioning.py::create_pharmacy_with_defaults()` is the one
  place pharmacy creation happens now, used by both `/auth/register` and the app's
  startup dev-seeder (previously two separate, drifted copies of this logic).
- `USER_ROLE` added to `domainConstants.js` (admin/manager/cashier/inventory_staff).
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
- **Not yet fixed, flagged for follow-up:** `backend/seed_admin.py` creates role
  permissions as a nested dict (`{"billing": {"create": True}}`), but the actual
  runtime permission checks in `routers/sales_returns.py` and `routers/settings.py`
  only understand the flat list format (`["billing:create"]`) and silently treat
  anything else as zero permissions. Any pharmacy seeded via `seed_admin.py` —
  including the one seeded in local dev — currently has non-admin roles
  (manager/cashier/inventory_staff) with effectively no permissions in those two
  files' checks. The new `create_pharmacy_with_defaults()` helper uses the correct
  format; `seed_admin.py` itself still needs the same fix.
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
