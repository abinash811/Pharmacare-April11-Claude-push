# PharmaCare — Testing
# Version: 1.0 | Last updated: April 18, 2026
# Audience: Claude, all developers
# Rule: Every new feature ships with tests. No PR merges without tests for critical paths.

---

## TESTING PHILOSOPHY

Test the behaviour, not the implementation.
A test should break when the product breaks — not when you refactor internals.

**Priority order:**
1. Critical business logic (billing calculations, stock deduction, H1 register)
2. API contract (endpoints return correct shapes and status codes)
3. Auth and access control (users can only see their pharmacy's data)
4. UI component behaviour (user interactions, not visual appearance)

---

## RUNNING TESTS

### Backend (Python/pytest)

```bash
cd backend

# Run all tests
pytest

# Run specific test file
pytest tests/test_bill_sequence.py

# Run with output (see print statements)
pytest -s

# Run with coverage
pytest --cov=. --cov-report=html

# Run only tests matching a name pattern
pytest -k "test_bill"

# Run and stop on first failure
pytest -x
```

**Prerequisites:**
```bash
# Backend must be running
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Set backend URL (or use default http://localhost:8000)
export REACT_APP_BACKEND_URL=http://localhost:8000
```

### Frontend (Jest via craco)

```bash
cd frontend

# Run all tests
npm test

# Run once (no watch mode)
npm test -- --watchAll=false

# Run specific file
npm test -- --testPathPattern=AppButton

# Run with coverage
npm test -- --coverage --watchAll=false
```

---

## BACKEND TEST STRUCTURE

```
backend/tests/
├── test_bill_sequence.py      ← Bill number generation, sequential, concurrent
├── test_dashboard_analytics.py
├── test_excel_bulk_upload.py
├── test_inventory_search.py
├── test_p0_p1_features.py     ← Core P0/P1 feature coverage
├── test_p2_features.py
├── test_product_transactions.py
├── test_purchases_module.py
├── test_save_as_draft.py
├── test_supplier_management.py
└── conftest.py                ← Shared fixtures (auth token, headers)
```

---

## BACKEND TEST PATTERNS

### Standard test file structure

```python
"""
Test module description.
What endpoints/flows are covered.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token once per module — not per test."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "testadmin@pharmacy.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture
def auth_headers(auth_token):
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestBillingFlow:
    """Group related tests in classes."""

    def test_create_draft_bill_no_stock_deducted(self, auth_headers):
        """Draft bill must not deduct stock."""
        # 1. Get initial stock
        # 2. Create draft bill
        # 3. Assert stock unchanged
        pass

    def test_settle_bill_deducts_stock(self, auth_headers):
        """Settling a bill must deduct stock from batch."""
        pass

    def test_h1_drug_requires_doctor(self, auth_headers):
        """Schedule H1 drug without doctor returns 400."""
        response = requests.post(f"{BASE_URL}/api/bills", headers=auth_headers, json={
            "status": "paid",
            "items": [{"product_sku": "H1-DRUG-SKU", "quantity": 1, "unit_price": 50}],
            "doctor_name": "",  # missing
        })
        assert response.status_code == 400
        assert "H1" in response.json()["detail"]

    def test_bill_number_sequential(self, auth_headers):
        """Each settled bill gets the next sequential number."""
        pass

    def test_draft_does_not_consume_sequence(self, auth_headers):
        """Draft bills use DRAFT- prefix, not the real sequence."""
        response = requests.post(f"{BASE_URL}/api/bills", headers=auth_headers, json={
            "status": "draft",
            "items": [...],
        })
        assert response.status_code == 200
        bill_number = response.json()["bill_number"]
        assert bill_number.startswith("DRAFT-")
```

### Assert patterns

```python
# ✅ Assert status code first — gives clearest error message
assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

# ✅ Assert specific fields
data = response.json()
assert data["bill_number"].startswith("INV-")
assert data["status"] == "paid"
assert data["total_amount"] > 0

# ✅ Assert money is reasonable (not testing exact paise — too brittle)
assert 0 < data["total_amount"] < 1000000  # sanity check

# ✅ Assert list responses have pagination
assert "data" in data
assert "pagination" in data
assert isinstance(data["data"], list)

# ❌ Don't assert implementation details
assert data["subtotal_paise"] == 1250   # too brittle — internal
```

---

## WHAT TO TEST (priority)

### P0 — Must have, blocks shipping

| Test | Why |
|------|-----|
| Draft bill → no stock deducted | Core invariant |
| Settled bill → stock deducted | Core invariant |
| Bill number sequential, no gaps | Legal requirement |
| Bill number not reused after cancel | Legal requirement |
| H1 drug without doctor → 400 | Legal requirement |
| Concurrent bills → no duplicate numbers | Data integrity |
| Pharmacy A cannot see Pharmacy B data | Multi-tenancy safety |
| `qty_on_hand` never goes negative | Stock integrity |
| Soft delete — record still queryable | Compliance |

### P1 — Important, ship in same sprint

| Test | Why |
|------|-----|
| Sales return restores stock | Inventory accuracy |
| Purchase confirm creates batches | Inventory accuracy |
| GST calculated correctly per rate | Financial accuracy |
| CGST + SGST = total GST | Financial accuracy |
| Margin calculation correct | Reporting accuracy |
| Auth token required for all routes | Security |
| Expired token → 401 | Security |

### P2 — Nice to have

| Test | Why |
|------|-----|
| Pagination works correctly | UX |
| Search returns relevant results | UX |
| Date range filters work | Reporting |
| PDF download returns PDF | Feature |
| Bulk upload processes correctly | Feature |

---

## CRITICAL TEST: CONCURRENT BILL NUMBERS

This test is mandatory. Race conditions in bill numbering are a legal problem.

```python
def test_concurrent_bills_no_duplicate_numbers(self, auth_headers):
    """10 concurrent bill creations must produce 10 unique sequential numbers."""
    from concurrent.futures import ThreadPoolExecutor
    import time

    def create_bill(_):
        return requests.post(f"{BASE_URL}/api/bills", headers=auth_headers, json={
            "status": "paid",
            "items": [{"product_sku": "TEST-SKU", "quantity": 1, "unit_price": 10}],
            "payment_method": "cash",
        })

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(create_bill, range(10)))

    bill_numbers = [r.json()["bill_number"] for r in results if r.status_code == 200]

    # All 10 must succeed
    assert len(bill_numbers) == 10, f"Only {len(bill_numbers)} bills created"

    # All must be unique
    assert len(set(bill_numbers)) == 10, f"Duplicate bill numbers: {bill_numbers}"
```

---

## CRITICAL TEST: MONEY CALCULATION

```python
def test_gst_calculation_5_percent(self, auth_headers):
    """5% GST on ₹100 = ₹5 GST, ₹105 total."""
    # Create product with 5% GST, MRP ₹100
    # Create bill for 1 unit, no discount
    # Assert:
    #   subtotal = 100.00
    #   gst = 5.00
    #   cgst = 2.50
    #   sgst = 2.50
    #   total = 105.00

def test_discount_applied_before_gst(self, auth_headers):
    """Discount reduces taxable amount before GST is calculated."""
    # MRP ₹100, 10% discount, 5% GST
    # taxable = 90
    # GST = 90 * 0.05 = 4.50
    # total = 94.50 (NOT 99.75)
```

---

## FRONTEND TESTING

Frontend tests use Jest + React Testing Library.

### What to test on frontend

1. **Shared components** — AppButton, PageHeader, PageTabs render correctly
2. **Critical user flows** — form submission, error display, loading states
3. **Business logic in utils** — currency formatting, expiry calculation

### Component test pattern

```jsx
// frontend/src/components/shared/__tests__/AppButton.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AppButton } from '@/components/shared';

describe('AppButton', () => {
  it('renders primary variant with correct classes', () => {
    render(<AppButton>Save</AppButton>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('shows spinner and disables when loading', () => {
    render(<AppButton loading>Save</AppButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<AppButton onClick={onClick}>Save</AppButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = jest.fn();
    render(<AppButton disabled onClick={onClick}>Save</AppButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

### Utility test pattern

```js
// frontend/src/utils/__tests__/dates.test.js
import { isExpired, isExpiringSoon, formatExpiry } from '@/utils/dates';

describe('isExpired', () => {
  it('returns true for past month', () => {
    expect(isExpired('01/24')).toBe(true);  // Jan 2024
  });

  it('returns false for future month', () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(isExpired(`01/${String(nextYear).slice(-2)}`)).toBe(false);
  });

  it('expires at END of printed month, not start', () => {
    // A batch printed as 04/26 is valid through April 30, 2026
    // It should NOT be expired on April 1, 2026
    // It should be expired on May 1, 2026
  });
});

describe('currency utils', () => {
  it('formats paise to rupees correctly', () => {
    expect(formatCurrency(10000)).toBe('₹100.00');
    expect(formatCurrency(1)).toBe('₹0.01');
    expect(formatCurrency(0)).toBe('₹0.00');
  });
});
```

---

## TEST DATA RULES

```python
# ✅ Use clearly fake data — never real patient names
"customer_name": "Test Patient Alpha"
"email": "testadmin@pharmacy.com"
"batch_number": "TEST-BATCH-001"

# ✅ Clean up test data after tests (or use transactions that rollback)
# ✅ Tests should be independent — no test depends on another test's data
# ❌ Never use production data in tests
# ❌ Never hardcode UUIDs from a specific database
```

---

## WRITING A NEW TEST

When you add a feature, add tests in this order:

1. Write the happy path test (everything works)
2. Write the error path test (invalid input, missing fields)
3. Write the edge case test (zero qty, max value, empty list)
4. For billing/stock features: write the concurrency test

```bash
# Run your new test to confirm it passes
pytest tests/test_your_new_feature.py -v

# Run full suite to confirm nothing broke
pytest
```

---

*Owner: Developer who builds the feature writes the tests.*
*Tests live in the same PR as the feature.*
