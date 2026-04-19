# PharmaCare — Code Quality
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Linting and formatting are not optional. CI blocks merges on violations.

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

Create `frontend/.eslintrc.json`:

```json
{
  "extends": [
    "react-app",
    "react-app/jest"
  ],
  "rules": {
    "no-console": ["warn", { "allow": ["error", "warn"] }],
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": ["error", "always"],
    "react/prop-types": "off",
    "react/jsx-no-target-blank": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/label-has-associated-control": "error",
    "jsx-a11y/no-noninteractive-element-interactions": "warn"
  }
}
```

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

Create `backend/.flake8` (Python linting):

```ini
[flake8]
max-line-length = 100
exclude = venv, alembic/versions, __pycache__
ignore = E501, W503
```

---

## GITHUB ACTIONS CI

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  frontend:
    name: Frontend lint + test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --watchAll=false --passWithNoTests

  backend:
    name: Backend lint + test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: flake8 .
      - run: pytest --tb=short -q
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          SECRET_KEY: test-secret-key-for-ci-only
```

Add `lint` script to `frontend/package.json`:

```json
{
  "scripts": {
    "lint": "eslint src --ext .js,.jsx --max-warnings 0",
    "lint:fix": "eslint src --ext .js,.jsx --fix",
    "format": "prettier --write src",
    "format:check": "prettier --check src"
  }
}
```

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
    <div className="px-8 py-6 min-h-screen bg-[#F8FAFB]">
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
