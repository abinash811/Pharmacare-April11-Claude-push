# PharmaCare — Git Workflow
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Every code change follows this workflow. No exceptions.

---

## CORE PRINCIPLE

One branch: `main`. One source of truth: GitHub.
No long-lived feature branches. No experimental branches left open.
Ship small, ship often, keep main always deployable.

---

## BRANCH STRATEGY

### For Claude (AI sessions)
Work directly on `main` for all changes.
Claude does not create feature branches — changes are small, focused, and committed immediately.

### For Human Developers (future team)
Short-lived feature branches only. Max 1–2 days before merging.

```
main                    ← always deployable, always up to date
└── feature/billing-sheet       ← max 1-2 days
└── fix/login-crash             ← fix branches, merge same day
└── docs/update-glossary        ← doc-only changes
```

**Never:**
- Long-lived branches (>2 days)
- Branches named `test`, `temp`, `wip`, `abinash-changes`
- Multiple open branches at the same time per developer

---

## BRANCH NAMING

```
feature/short-description       ← new feature
fix/what-is-broken              ← bug fix
docs/what-is-updated            ← documentation only
refactor/what-is-changing       ← code restructure, no behaviour change
chore/what-is-done              ← dependency update, config change
```

**Examples:**
```
feature/command-palette
feature/zod-billing-form
fix/auth-axios-crash
fix/expiry-date-calculation
docs/update-glossary-hsn
refactor/settings-page-split
chore/update-react-18
```

**Rules:**
- All lowercase
- Hyphens only (no underscores, no spaces)
- Short but descriptive (3–5 words max)
- Describes what, not who (`feature/billing-sheet` not `abinash-billing`)

---

## COMMIT MESSAGE FORMAT

PharmaCare uses **Conventional Commits**. Every commit message follows this format:

```
type(scope): short description

Optional longer explanation if needed.
Why this change was made, not what changed (code shows what).
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructure — no behaviour change |
| `docs` | Documentation only |
| `chore` | Dependency update, config, tooling |
| `test` | Adding or updating tests |
| `style` | Formatting only — no logic change |

### Scopes (use these — don't invent new ones)

| Scope | Covers |
|-------|--------|
| `billing` | Billing, sales returns |
| `inventory` | Inventory, stock movements, medicine detail |
| `purchases` | Purchases, purchase returns |
| `customers` | Customers, doctors |
| `suppliers` | Suppliers, payments |
| `reports` | Reports, GST report |
| `settings` | Settings page |
| `team` | Team management |
| `auth` | Login, registration, JWT |
| `layout` | Sidebar, navigation, Layout.js |
| `shared` | Shared components (AppButton, PageHeader, PageTabs, etc.) |
| `backend` | Backend changes not tied to one feature |
| `db` | Database schema, migrations |
| `docs` | Documentation files |
| `config` | ESLint, Tailwind, package.json |

### Real Examples

```bash
feat(billing): add right-side sheet for new bill creation
fix(auth): replace undefined axios with api instance in login handler
refactor(shared): extract PageTabs component from Customers page
docs(glossary): add HSN code and GSTR-1 definitions
chore(config): add ESLint rule to ban raw button tags
fix(inventory): correct expiry check — batch expires end of month not start
feat(settings): add bill sequence configuration tab
refactor(purchases): split PurchaseNew into 6 sub-components under 300 lines
```

### Rules
- Present tense: "add" not "added", "fix" not "fixed"
- Lowercase after colon
- No period at end
- Under 72 characters for the first line
- If you need more than one line, the second line explains WHY not WHAT

---

## DAILY WORKFLOW

### Starting work (Claude or developer)

```bash
# Always start from latest main
git checkout main
git pull origin main
```

### Making changes

```bash
# Check what changed
git status
git diff

# Stage specific files (never git add -A blindly)
git add frontend/src/pages/BillingOperations.js
git add frontend/src/components/shared/PageTabs.jsx

# Commit
git commit -m "feat(billing): add PageTabs to billing and sales returns pages"
```

### Pushing

```bash
git push origin main
```

---

## WHAT TO COMMIT TOGETHER (and what not to)

### Good — one logical change per commit
```
feat(billing): add sheet for new bill creation
  - BillingSheet.jsx (new component)
  - BillingOperations.js (wire up sheet)
  - hooks/useBillingSheet.js (new hook)
```

### Bad — unrelated changes in one commit
```
# Wrong — three unrelated things
feat: add billing sheet, fix login bug, update glossary
```

### Rule: If the commit message needs "and", split it into two commits.

---

## PULL REQUESTS (for human developers)

Claude does not open PRs — commits directly to main.
Human developers open a PR for every branch.

### PR title format
Same as commit format: `feat(billing): add right-side sheet for new bill creation`

### PR description template
```markdown
## What
Short description of what changed.

## Why
Why this change was needed. Link to issue if applicable.

## Test
- [ ] Tested on Chrome
- [ ] Mobile layout checked
- [ ] No console errors
- [ ] Component audit checklist passed (see CLAUDE.md)

## Screenshots
(attach before/after if UI changed)
```

### PR rules
- Max 400 lines changed per PR (smaller = faster review)
- No PR without passing component audit checklist
- No PR that breaks the running app
- At least one approval before merge (when team > 1)

---

## WHAT NEVER GOES IN GIT

These are in `.gitignore` — never force-add them:

```
.env
.env.local
.env.production
*.pyc
__pycache__/
venv/
node_modules/
.DS_Store
```

**If you accidentally commit a secret:**
1. Immediately rotate the secret (new JWT key, new password)
2. Use `git filter-branch` or BFG Repo Cleaner to remove from history
3. Force push (only acceptable case for force push)
4. Notify the team

---

## TAGS AND RELEASES

When a significant milestone ships:

```bash
git tag -a v1.0.0 -m "Phase 1 complete — single pharmacy full feature set"
git push origin v1.0.0
```

### Version format: `MAJOR.MINOR.PATCH`
- `MAJOR` — breaking change or major milestone (Phase 1 → Phase 2)
- `MINOR` — new feature shipped
- `PATCH` — bug fix

---

## EMERGENCY HOTFIX PROCESS

Production is broken. Here's the exact process:

```bash
# 1. Pull latest main
git checkout main && git pull origin main

# 2. Fix the bug directly on main (it's an emergency)
# Make the minimal change needed

# 3. Commit with fix: prefix and clear description
git commit -m "fix(auth): resolve login crash on missing axios import"

# 4. Push immediately
git push origin main

# 5. Document what happened in docs/15_ROADMAP.md under known issues
```

---

## COMPONENT AUDIT CHECKLIST (run before every commit)

Copy this checklist. Every box must be checked before `git commit`.

```
- [ ] Zero raw <button> tags — only <AppButton>
- [ ] Zero hardcoded hex colors — only design tokens
- [ ] Zero hover:bg-[#...] patterns
- [ ] Zero text-gray-900 on bg-brand backgrounds
- [ ] Zero font-medium on button labels (must be font-semibold)
- [ ] Every page uses <PageHeader> — no inline <h1>/<h2>
- [ ] Every multi-view page uses <PageTabs>
- [ ] No file over 300 lines
- [ ] No money stored as float — integer paise only
- [ ] No hard deletes — soft delete only
```

---

*Owner: Updated when branching strategy or commit conventions change.*
*Claude reads this before making any commit to ensure messages follow the format.*
