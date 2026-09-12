"""
Regression tests for the Sep 12, 2026 cross-tenant data isolation fix.

Context: nearly every "get/update/delete by id" endpoint in the app looked
up its row with `select(Model).where(Model.id == id)` alone — no
pharmacy_id check. Proved live: a freshly-registered, completely separate
pharmacy could read AND modify another pharmacy's supplier via
GET/PUT /suppliers/{id}, and the same pattern was found across suppliers,
customers, doctors, products, batches, purchases, purchase returns, sales
returns, bills, users, and roles.

This is not a hypothetical/fixture-only test: it registers two genuinely
separate pharmacies via the real /api/auth/register flow (same one a real
signup uses) and asserts that Pharmacy B's session can never read or write
Pharmacy A's data by ID, on any of the endpoints found vulnerable. Every
assertion expects 404 — never 403 — because a row that exists but belongs
to someone else must be indistinguishable from "doesn't exist" (see
routers/auth_helpers.py's get_owned_or_404 docstring): a 403 would still
leak "yes, an object with this ID exists somewhere."

See docs/15_ROADMAP.md's RULE MISSES LOG for the full incident writeup and
scripts/check_tenant_isolation.py for the automated static check that now
blocks this class of bug from being reintroduced silently.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def _register_pharmacy(tag: str) -> tuple[requests.Session, dict]:
    """Registers a brand-new, completely independent pharmacy + admin user
    — the same public signup flow a real pharmacist uses. No shared
    fixtures, no pre-seeded data: two calls to this produce two tenants
    that have never had any legitimate relationship to each other."""
    suffix = uuid.uuid4().hex[:10]
    email = f"tenant_{tag}_{suffix}@pharmacy.com"
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "name": f"Tenant {tag} Admin",
        "password": "TenantTest123",
        "phone": "9800000000",
        "pharmacy_name": f"Isolation Test Pharmacy {tag} {suffix}",
        "address": "1 Test Street",
        "city": "Testville",
        "state": "Karnataka",
        "pincode": "560001",
        "drug_license_number": f"DL-ISO-{suffix}",
    })
    if resp.status_code != 200:
        pytest.skip(f"Could not register a test pharmacy — backend not reachable? {resp.text}")
    token = resp.json()["token"]
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return session, resp.json()["user"]


@pytest.fixture(scope="module")
def tenants():
    """Two real, independent pharmacies: A owns the data under test, B is
    the attacker trying to reach it by ID."""
    a_session, a_user = _register_pharmacy("A")
    b_session, b_user = _register_pharmacy("B")
    return {"a": a_session, "b": b_session, "a_user": a_user, "b_user": b_user}


@pytest.fixture(scope="module")
def owned(tenants):
    """Pharmacy A creates one of every resource type this vulnerability
    class touched. Returns their IDs for pharmacy B's session to attack."""
    a = tenants["a"]
    suffix = uuid.uuid4().hex[:8]

    supplier = a.post(f"{BASE_URL}/api/suppliers", json={
        "name": f"IsoTest Supplier {suffix}", "credit_days": 30,
    })
    assert supplier.status_code == 200, supplier.text
    supplier_id = supplier.json()["id"]

    customer = a.post(f"{BASE_URL}/api/customers", json={"name": f"IsoTest Customer {suffix}"})
    assert customer.status_code == 200, customer.text
    customer_id = customer.json()["id"]

    doctor = a.post(f"{BASE_URL}/api/doctors", json={"name": f"IsoTest Doctor {suffix}"})
    assert doctor.status_code == 200, doctor.text
    doctor_id = doctor.json()["id"]

    sku = f"ISOTEST-{suffix}"
    product = a.post(f"{BASE_URL}/api/products", json={
        "sku": sku, "name": f"IsoTest Product {suffix}", "category": "medicine",
        "gst_percent": 5, "units_per_pack": 1,
    })
    assert product.status_code == 200, product.text
    product_id = product.json()["id"]

    batch_no = f"ISOBATCH-{suffix}"
    batch = a.post(f"{BASE_URL}/api/stock/batches", json={
        "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
        "qty_on_hand": 100, "cost_price_per_unit": 10, "mrp_per_unit": 20,
    })
    assert batch.status_code == 200, batch.text
    batch_id = batch.json()["id"]

    purchase = a.post(f"{BASE_URL}/api/purchases", json={
        "supplier_id": supplier_id, "purchase_date": "2026-09-01",
        "purchase_on": "credit",
        "items": [{
            "product_sku": sku, "product_name": f"IsoTest Product {suffix}",
            "qty_units": 10, "cost_price_per_unit": 10, "mrp_per_unit": 20, "gst_percent": 5,
        }],
    })
    assert purchase.status_code == 200, purchase.text
    purchase_id = purchase.json()["id"]

    purchase_return = a.post(f"{BASE_URL}/api/purchase-returns", json={
        "supplier_id": supplier_id, "purchase_id": purchase_id, "return_date": "2026-09-02",
        "items": [{
            "product_sku": sku, "product_name": f"IsoTest Product {suffix}",
            "batch_no": batch_no, "return_qty_units": 1, "ptr": 10, "gst_percent": 5,
        }],
    })
    assert purchase_return.status_code == 200, purchase_return.text
    purchase_return_id = purchase_return.json()["id"]

    bill = a.post(f"{BASE_URL}/api/bills", json={
        "items": [{
            "product_sku": sku, "batch_no": batch_no,
            "quantity": 1, "unit_price": 20, "gst_percent": 5,
        }],
        "tax_rate": 5, "status": "paid", "payment_method": "cash",
    })
    assert bill.status_code == 200, bill.text
    bill_id = bill.json()["id"]

    sales_return = a.post(f"{BASE_URL}/api/sales-returns", json={
        "original_bill_id": bill_id, "return_date": "2026-09-03",
        "items": [{
            "medicine_name": f"IsoTest Product {suffix}", "batch_no": batch_no,
            "mrp": 20, "qty": 1, "original_qty": 1, "gst_percent": 5,
        }],
    })
    assert sales_return.status_code == 200, sales_return.text
    sales_return_id = sales_return.json()["id"]

    role = a.post(f"{BASE_URL}/api/roles", json={
        "name": f"isotest_role_{suffix}", "display_name": "IsoTest Role", "permissions": ["billing:view"],
    })
    assert role.status_code == 200, role.text
    role_id = role.json()["id"]

    other_user = a.post(f"{BASE_URL}/api/users", json={
        "email": f"isotest_user_{suffix}@pharmacy.com", "name": "IsoTest Staff User",
        "password": "IsoTestUser123", "role": "cashier",
    })
    assert other_user.status_code == 200, other_user.text
    user_id = other_user.json()["id"]

    return {
        "supplier_id": supplier_id, "customer_id": customer_id, "doctor_id": doctor_id,
        "product_id": product_id, "sku": sku, "batch_id": batch_id, "batch_no": batch_no,
        "purchase_id": purchase_id, "purchase_return_id": purchase_return_id,
        "bill_id": bill_id, "sales_return_id": sales_return_id,
        "role_id": role_id, "user_id": user_id,
    }


class TestSupplierIsolation:
    def test_b_cannot_read_a_supplier(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/suppliers/{owned['supplier_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_supplier(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/suppliers/{owned['supplier_id']}", json={"notes": "pwned"})
        assert resp.status_code == 404, resp.text

    def test_b_cannot_read_a_supplier_summary(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/suppliers/{owned['supplier_id']}/summary")
        assert resp.status_code == 404, resp.text


class TestCustomerIsolation:
    def test_b_cannot_read_a_customer(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/customers/{owned['customer_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_customer(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/customers/{owned['customer_id']}", json={"notes": "pwned"})
        assert resp.status_code == 404, resp.text

    def test_b_cannot_read_a_customer_stats(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/customers/{owned['customer_id']}/stats")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_delete_a_customer(self, tenants, owned):
        resp = tenants["b"].delete(f"{BASE_URL}/api/customers/{owned['customer_id']}")
        assert resp.status_code == 404, resp.text


class TestDoctorIsolation:
    def test_b_cannot_edit_a_doctor(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/doctors/{owned['doctor_id']}", json={"name": "pwned"})
        assert resp.status_code == 404, resp.text

    def test_b_cannot_delete_a_doctor(self, tenants, owned):
        resp = tenants["b"].delete(f"{BASE_URL}/api/doctors/{owned['doctor_id']}")
        assert resp.status_code == 404, resp.text


class TestProductIsolation:
    def test_b_cannot_read_a_product(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/products/{owned['product_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_product(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/products/{owned['product_id']}", json={"name": "pwned"})
        assert resp.status_code == 404, resp.text

    def test_b_cannot_delete_a_product(self, tenants, owned):
        resp = tenants["b"].delete(f"{BASE_URL}/api/products/{owned['product_id']}")
        assert resp.status_code == 404, resp.text


class TestBatchIsolation:
    def test_b_cannot_read_a_batch(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/stock/batches/{owned['batch_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_batch(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/stock/batches/{owned['batch_id']}", json={"notes": "pwned"})
        assert resp.status_code == 404, resp.text

    def test_b_cannot_adjust_a_batch(self, tenants, owned):
        """The live-proven exploit's write variant: B must not be able to
        drain or inflate A's real stock quantity via another pharmacy's
        batch id."""
        resp = tenants["b"].post(f"{BASE_URL}/api/batches/{owned['batch_id']}/adjust", json={
            "batch_id": owned["batch_id"], "adjustment_type": "decrease",
            "qty_units": 100, "reason": "attack",
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_writeoff_a_batch(self, tenants, owned):
        resp = tenants["b"].post(
            f"{BASE_URL}/api/batches/{owned['batch_id']}/writeoff-expiry", json={"reason": "attack"})
        assert resp.status_code == 404, resp.text

    def test_b_cannot_delete_a_batch(self, tenants, owned):
        resp = tenants["b"].delete(f"{BASE_URL}/api/stock/batches/{owned['batch_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_use_a_batch_id_on_own_bill(self, tenants, owned):
        """The billing._resolve_batch class of bug: B references A's real
        batch_id directly inside a bill body it creates for itself. An
        item whose batch/product can't be resolved is silently dropped
        rather than rejected outright — that's pre-existing, unrelated
        behavior — but it must never resolve to A's batch: the created
        bill must end up with zero items, not one billed against A's
        stock."""
        resp = tenants["b"].post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "batch_id": owned["batch_id"], "quantity": 1, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "payment_method": "cash",
        })
        if resp.status_code == 200:
            assert resp.json()["items"] == [], (
                f"B's bill resolved an item against A's batch_id — cross-tenant stock leak: {resp.text}")
        else:
            assert resp.status_code in (400, 404), resp.text


class TestPurchaseIsolation:
    def test_b_cannot_read_a_purchase(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/purchases/{owned['purchase_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_purchase(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/purchases/{owned['purchase_id']}", json={
            "supplier_id": owned["supplier_id"], "purchase_date": "2026-09-01",
            "purchase_on": "credit", "items": [],
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_pay_a_purchase(self, tenants, owned):
        resp = tenants["b"].post(f"{BASE_URL}/api/purchases/{owned['purchase_id']}/pay", json={
            "amount": 1, "payment_method": "cash",
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_delete_a_purchase(self, tenants, owned):
        resp = tenants["b"].delete(f"{BASE_URL}/api/purchases/{owned['purchase_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_use_a_supplier_id_on_own_purchase(self, tenants, owned):
        """A caller-supplied supplier_id from another tenant must not be
        accepted when creating a purchase."""
        resp = tenants["b"].post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": owned["supplier_id"], "purchase_date": "2026-09-01",
            "purchase_on": "credit",
            "items": [{
                "product_sku": "DOES-NOT-MATTER", "product_name": "x",
                "qty_units": 1, "cost_price_per_unit": 1, "mrp_per_unit": 1, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 404, resp.text


class TestPurchaseReturnIsolation:
    def test_b_cannot_read_a_purchase_return(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/purchase-returns/{owned['purchase_return_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_purchase_return(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/purchase-returns/{owned['purchase_return_id']}", json={
            "note": "pwned", "edit_type": "non_financial",
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_read_a_purchase_items_for_return(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/purchases/{owned['purchase_id']}/items-for-return")
        assert resp.status_code == 404, resp.text


class TestSalesReturnIsolation:
    def test_b_cannot_read_a_sales_return(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/sales-returns/{owned['sales_return_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_sales_return(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/sales-returns/{owned['sales_return_id']}", json={
            "note": "pwned",
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_use_a_bill_id_for_own_sales_return(self, tenants, owned):
        """A must not be able to have their sale reversed by B referencing
        A's bill_id from B's own sales-return request."""
        resp = tenants["b"].post(f"{BASE_URL}/api/sales-returns", json={
            "original_bill_id": owned["bill_id"], "return_date": "2026-09-03",
            "items": [{
                "medicine_name": "x", "batch_no": owned["batch_no"],
                "mrp": 20, "qty": 1, "original_qty": 1, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 404, resp.text


class TestBillIsolation:
    def test_b_cannot_read_a_bill(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/bills/{owned['bill_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_bill(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/bills/{owned['bill_id']}", json={
            "items": [], "tax_rate": 5, "status": "draft",
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_download_a_bill_pdf(self, tenants, owned):
        """The exact endpoint that had this fix applied once before
        (Sep 2026) without being generalized — the original found-and-fixed
        leak this whole regression suite exists to make permanent."""
        resp = tenants["b"].get(f"{BASE_URL}/api/bills/{owned['bill_id']}/pdf")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_pay_a_bill(self, tenants, owned):
        resp = tenants["b"].post(f"{BASE_URL}/api/payments", json={
            "invoice_id": owned["bill_id"], "amount": 1, "payment_method": "cash",
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_use_a_customer_id_on_own_bill(self, tenants, owned):
        resp = tenants["b"].post(f"{BASE_URL}/api/bills", json={
            "customer_id": owned["customer_id"],
            "items": [], "tax_rate": 5, "status": "draft",
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_use_a_doctor_id_on_own_bill(self, tenants, owned):
        resp = tenants["b"].post(f"{BASE_URL}/api/bills", json={
            "doctor_id": owned["doctor_id"],
            "items": [], "tax_rate": 5, "status": "draft",
        })
        assert resp.status_code == 404, resp.text


class TestUserIsolation:
    def test_b_cannot_read_a_user(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/users/{owned['user_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_user(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/users/{owned['user_id']}", json={"name": "pwned"})
        assert resp.status_code == 404, resp.text

    def test_b_cannot_deactivate_a_user(self, tenants, owned):
        resp = tenants["b"].delete(f"{BASE_URL}/api/users/{owned['user_id']}")
        assert resp.status_code == 404, resp.text


class TestRoleIsolation:
    def test_b_cannot_read_a_role(self, tenants, owned):
        resp = tenants["b"].get(f"{BASE_URL}/api/roles/{owned['role_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_role(self, tenants, owned):
        resp = tenants["b"].put(f"{BASE_URL}/api/roles/{owned['role_id']}", json={
            "permissions": ["*"],
        })
        assert resp.status_code == 404, resp.text

    def test_b_cannot_delete_a_role(self, tenants, owned):
        resp = tenants["b"].delete(f"{BASE_URL}/api/roles/{owned['role_id']}")
        assert resp.status_code == 404, resp.text

    def test_b_cannot_edit_a_role_via_return_permissions_endpoint(self, tenants, owned):
        resp = tenants["b"].put(
            f"{BASE_URL}/api/roles/{owned['role_id']}/permissions/returns",
            params={"allow_manual_returns": True})
        assert resp.status_code == 404, resp.text


class TestPositiveControl:
    """If A can't even read its own data back, every 404 above is
    meaningless (the endpoints could simply be broken for everyone). This
    proves the fixture data is real and A's own session still works."""

    def test_a_can_read_its_own_supplier(self, tenants, owned):
        resp = tenants["a"].get(f"{BASE_URL}/api/suppliers/{owned['supplier_id']}")
        assert resp.status_code == 200, resp.text

    def test_a_can_read_its_own_bill(self, tenants, owned):
        resp = tenants["a"].get(f"{BASE_URL}/api/bills/{owned['bill_id']}")
        assert resp.status_code == 200, resp.text

    def test_a_can_read_its_own_purchase_return(self, tenants, owned):
        resp = tenants["a"].get(f"{BASE_URL}/api/purchase-returns/{owned['purchase_return_id']}")
        assert resp.status_code == 200, resp.text

    def test_a_can_read_its_own_role(self, tenants, owned):
        resp = tenants["a"].get(f"{BASE_URL}/api/roles/{owned['role_id']}")
        assert resp.status_code == 200, resp.text
