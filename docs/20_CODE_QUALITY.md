# PharmaCare — Code Quality
# Version: 1.3 | Last updated: September 18, 2026
# Type: Reference
# Audience: Claude, all developers
# Rule: Linting and formatting are not optional. CI blocks merges on violations.

---

## THE ROOT-CAUSE RULE

> Fix the structure, not the symptom. Patching a bug with a checklist creates the next bug.
> Every recurring bug class gets a structural fix that makes it impossible to reintroduce.

### What this means in practice

| Bug class | Patch (wrong) | Structural fix (right) |
|-----------|--------------|----------------------|
| Filter sends `'parked'`, DB stores `'draft'` | Add if/else in backend | Define `BILL_STATUS.DRAFT = 'draft'` in `constants/domainConstants.js`, use it everywhere |
| Frontend calls `/patients` which doesn't exist | Fix the URL | Before writing `api.get(url)`, grep backend routers to confirm the route exists. Document verified routes. |
| Magic number `gst_rate = 5` in 6 files | Find and fix 6 files | Define `DEFAULT_GST_RATE` in `domainConstants.js` |
| Status badge shows wrong color | Add another case | StatusBadge reads from constants — add to constants, badge fixes itself |

---

## DOMAIN CONSTANTS — MANDATORY

**File:** `frontend/src/constants/domainConstants.js`

This file is the **single source of truth** for every status value, enum, and domain string.

### Rules

1. **Never write a status value as a raw string anywhere in the app.** Always import from `domainConstants.js`.
2. **Before any `api.get(url)` call**, grep `backend/routers/` to confirm the route exists. If it doesn't exist, create it — don't call a 404.
3. **If a domain value changes** (e.g., DB column renames `draft` to `parked`) — change `domainConstants.js`. The entire app updates. That is the point.

```js
// ❌ Magic string — wrong
if (bill.status === 'draft') { ... }
params.status = 'parked';

// ✅ Constant — right
import { BILL_STATUS, BILL_STATUS_FILTER_MAP } from '@/constants/domainConstants';
if (bill.status === BILL_STATUS.DRAFT) { ... }
params.status = 'parked'; // backend maps this via BILL_STATUS_FILTER_MAP
```

### What lives in domainConstants.js

- `BILL_STATUS` — all bill status values as stored in DB
- `BILL_STATUS_FILTER_MAP` — maps UI filter keys to DB values (e.g. `parked` → `['draft', 'parked']`)
- `PAYMENT_METHOD` — cash, upi, card, credit, multiple
- `INVOICE_TYPE` — SALE, PURCHASE, SALES_RETURN, PURCHASE_RETURN
- `DRUG_SCHEDULE` — H, H1, X, G
- `SCHEDULE_REQUIRES_DOCTOR` — schedules that require doctor name
- `CUSTOMER_TYPE` — regular, wholesale, institution
- `STOCK_MOVEMENT_TYPE` — sale, purchase, return, expiry, damage, adjustment

---

## ENGINEERING PRINCIPLES

These apply to every line written in PharmaCare.

### SOLID (applied to React + Python)

| Principle | Rule | PharmaCare example |
|-----------|------|--------------------|
| **Single Responsibility** | One component/function does one thing | `BillingPage` orchestrates; `BillsTable` only renders; `useBillForm` only manages form state |
| **Open/Closed** | Extend via props, not by editing shared components | Add `variant="danger"` to AppButton — don't fork it |
| **Liskov Substitution** | Components with same interface are interchangeable | All empty state components accept same props |
| **Interface Segregation** | Don't force components to accept props they don't use | Split large prop interfaces into focused ones |
| **Dependency Inversion** | Depend on abstractions | Components call `api.get(...)` not `fetch(url)` directly |

### DRY — Don't Repeat Yourself

```jsx
// ❌ Same formatting in 3 places
<td>₹{(bill.grand_total_paise / 100).toFixed(2)}</td>
<td>₹{(item.mrp_paise / 100).toFixed(2)}</td>
<p>₹{(total / 100).toFixed(2)}</p>

// ✅ One utility function
import { formatCurrency } from '@/utils/currency';
<td>{formatCurrency(bill.grand_total_paise)}</td>
```

### KISS — Keep It Simple

```jsx
// ❌ Over-engineered
const getBillStatusConfig = (status) => {
  const configs = { paid: { color: 'green', icon: CheckCircle, label: 'Paid' }, ... };
  return configs[status] ?? configs['draft'];
};

// ✅ Simple — StatusBadge already handles this
<StatusBadge status={bill.status} />
```

### YAGNI — You Aren't Gonna Need It

```jsx
// ❌ Building for Phase 2 now
const BillingPage = ({ storeId, chainId, multiCurrency }) => {
  // Phase 1 is single-store — storeId, chainId don't exist yet
};

// ✅ Build for what exists today
const BillingPage = () => { ... };
```

### Boy Scout Rule

Leave every file cleaner than you found it. If you touch a file and see a lint warning, a vague variable name, or a missing aria-label — fix it in the same PR.

---

## ESLINT CONFIG

> **Corrected Sep 18, 2026** — this section previously showed a legacy
> `.eslintrc.json` sample (`extends: react-app`) that no file in the repo
> ever matched. Found while checking whether our real tooling matches
> what's documented here. The real, current config is the source of
> truth — don't copy a snapshot into this doc, it will drift again the
> next time a rule changes.

**Real file:** `frontend/eslint.config.js` — ESLint v9 flat config, not
`.eslintrc.json`. TypeScript-aware (`@typescript-eslint/parser` handles
`.js`/`.jsx`/`.ts`/`.tsx` in one pass), includes `react`, `react-hooks`,
and `jsx-a11y` plugins. `react-hooks/exhaustive-deps` and two newer
React-Compiler-era rules (`react-hooks/set-state-in-effect` and its
sibling) are deliberately downgraded to `warn` — real, unaudited
pre-existing findings, not something CI should block on until they're
worked through (see `docs/11_TESTING.md`). Run `npm run lint` to see the
current rule set in effect; read the file directly for exact rules.

---

## PRETTIER CONFIG

Create `frontend/.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always"
}
```

**Python linting (flake8):** no `backend/.flake8` file exists — the real
enforced limit is `max-line-length=120` (not 100), passed as a CLI flag
directly in `.github/workflows/ci.yml` and `scripts/flake8_changed_lines.py`
(also the pre-commit hook's source). `E501` (line too long) is exactly
what this checks — it is never ignored, unlike an earlier version of this
doc claimed.

---

## GITHUB ACTIONS CI

> **Corrected Sep 18, 2026** — the sample previously here (2 jobs,
> `branches: [main]` only) hadn't matched the real pipeline for months.
> `.github/workflows/ci.yml` is the source of truth; this is a summary,
> not a copy, so it can't drift the same way again.

**Triggers:** push to `main`, `claude/**`, or `fix/**` (every feature-branch
commit gets real CI signal, not just a PR); `pull_request` into `main`;
manual `workflow_dispatch`.

**5 jobs:**
- **Frontend — lint + test**: `npm run lint -- --max-warnings 175` (a real,
  shrinking backlog number — see `docs/11_TESTING.md` — not an aspirational
  0; any error-severity finding still fails regardless), then `npm test`.
- **Backend — lint + test**: real Postgres service container, real Alembic
  migrations, `flake8 . --max-line-length=120`, then `pytest` against a
  live-started backend (every backend test is an HTTP integration test).
- **E2E — Playwright**: full real stack (Postgres + backend + built
  frontend + headless Chromium) — the class of check that caught bugs a
  passing unit test alone missed (see the job's own comment in the file).
- **Lighthouse**: audits a real production build of `/login` for
  performance/a11y/best-practices/SEO.
- **Definition of Done** (PR-time only): fails a PR that changes
  `backend/routers|models|utils` or `frontend/src/pages|components|hooks`
  with no matching test file change, unless the PR body states
  `Test-exempt: <reason>` — the automated gate behind Manifesto rule 12.

---

## CODE REVIEW AUDIT RUBRIC

Score any PR 0–10 across these dimensions. Target score: 8+.

| Dimension | 0 | 5 | 10 |
|-----------|---|---|----|
| **Naming** | Abbreviations, vague names | Mostly clear, some abbrevs | Fully descriptive, no abbrevs |
| **Component size** | Files > 300 lines | 200–300 lines | < 200 lines, well-split |
| **Design system** | Raw buttons, hex colors | Mostly tokens, some violations | 100% tokens, all AppButton |
| **Error handling** | Silent catches | Toasts only | Toast + retry + loading states |
| **Accessibility** | Missing labels, no focus ring | Partial — some labels | All ARIA, focus rings, semantics |
| **Business logic** | Float money, hard deletes | Some paise, soft deletes | All paise, all soft deletes |
| **Tests** | No tests | Happy path only | Happy + error + edge cases |
| **Performance** | Eager loads, SELECT * | Lazy routes, basic pagination | Lazy + paginated + no N+1 |
| **Security** | Missing pharmacy_id filter | Most routes scoped | All routes scoped + role-checked |
| **Principles** | Duplicated logic, god files | Some DRY, mostly focused | DRY, SRP, YAGNI throughout |

**PR merge gate:** Score must be ≥ 7 in every dimension. No merging with a 0 in Security or Business Logic.

---

## FILE SIZE ENFORCEMENT

```
Max 300 lines per file. This is a hard limit.

When a file approaches 250 lines:
1. Identify sections that can become their own component or hook
2. Extract to components/ or hooks/ subfolder
3. The parent becomes an orchestrator — only imports and composes
```

```jsx
// ✅ Orchestrator pattern — BillingPage is under 100 lines
export default function BillingPage() {
  const { bills, loading, error, fetchBills } = useBillsList();
  const { activeTab, handleTabChange } = useBillingTabs();

  return (
    <div className="px-8 py-6 min-h-screen bg-page">
      <PageHeader title="Billing" actions={<BillingActions />} />
      <PageTabs tabs={BILLING_TABS} activeTab={activeTab} onChange={handleTabChange} />
      <BillsTable bills={bills} loading={loading} error={error} onRetry={fetchBills} />
    </div>
  );
}
```

---

## JSDOC ON EXPORTED UTILITIES

Public utility functions must have JSDoc. Components don't need it — props and names are enough.

```js
/**
 * Converts paise (integer) to formatted rupee string.
 * @param {number} paise - Amount in paise (e.g., 10050)
 * @returns {string} Formatted string (e.g., "₹100.50")
 */
export function formatCurrency(paise) {
  return `₹${(paise / 100).toFixed(2)}`;
}

/**
 * Checks if a batch expiry date has passed.
 * Expiry is at END of the printed month, not start.
 * @param {string} expiryDate - Format: "MM/YY" (e.g., "04/26")
 * @returns {boolean}
 */
export function isExpired(expiryDate) {
  const [month, year] = expiryDate.split('/');
  const expiry = new Date(2000 + parseInt(year), parseInt(month), 1);
  return expiry <= new Date();
}
```

---

## CHECKLIST (before every PR)

**Domain constants (mandatory — these prevent entire bug classes):**
- [ ] Zero raw status strings (`'draft'`, `'paid'`, `'parked'`, etc.) in any new code — all from `domainConstants.js`
- [ ] Every `api.get(url)` call targets a route confirmed to exist in `backend/routers/` — grep to verify

**Code quality:**
- [ ] ESLint passes with zero errors (`npm run lint`)
- [ ] Prettier formatting applied (`npm run format`)
- [ ] No file over 300 lines
- [ ] No `console.log` left in code (only `console.error`/`console.warn` are allowed)
- [ ] No commented-out code blocks committed
- [ ] All exported utility functions have JSDoc
- [ ] No `TODO` comments without a linked issue
- [ ] Boy Scout Rule applied — fixed at least one pre-existing issue in touched files
- [ ] PR audit score ≥ 7 across all dimensions

---

## Zod Schema Rules

- All schemas live in `frontend/src/lib/schemas/`
- Every form field that touches the API must have a Zod schema
- Export types with `z.infer<typeof schema>` — no separate TypeScript interfaces for form shapes
- Import: `import { customerSchema, type CustomerFormValues } from '@/lib/schemas'`
- Wire with react-hook-form: `const form = useForm<T>({ resolver: zodResolver(schema) })`
- Rule: No new form without a schema. No `useState` for individual form fields.
