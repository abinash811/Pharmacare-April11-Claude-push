#!/usr/bin/env python3
"""
Full test suite for PharmaCare PostgreSQL backend.
Tests all major API endpoints against a running server.
"""

import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import requests


class PharmacyAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

        # Test data storage
        self.created_product_id = None
        self.created_product_sku = None
        self.created_batch_id = None
        self.created_supplier_id = None
        self.created_customer_id = None
        self.created_doctor_id = None
        self.created_bill_id = None
        self.created_purchase_id = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"  ✅ {name}: PASSED")
        else:
            print(f"  ❌ {name}: FAILED - {details}")
        self.test_results.append({
            "test": name, "success": success, "details": details,
            "response_data": response_data,
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None,
                     expected_status: int = 200) -> tuple:
        url = f"{self.api_url}/{endpoint}"
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        try:
            resp = getattr(requests, method.lower())(url, json=data, headers=headers)
            try:
                resp_data = resp.json()
            except Exception:
                resp_data = {"status_code": resp.status_code, "text": resp.text[:500]}
            return resp.status_code == expected_status, resp_data
        except Exception as e:
            return False, {"error": str(e)}

    # ── Auth ──────────────────────────────────────────────────────────────────

    def test_health(self):
        try:
            r = requests.get(f"{self.base_url}/health")
            ok = r.status_code == 200 and r.json().get("status") == "ok"
            self.log_test("Health Check", ok, "" if ok else f"status={r.status_code}")
            return ok
        except Exception as e:
            self.log_test("Health Check", False, str(e))
            return False

    def test_user_registration(self):
        ts = datetime.now().strftime("%H%M%S%f")[:10]
        data = {
            "name": "Test Admin",
            "email": f"admin_{ts}@pharmacy.com",
            "password": "TestPass123!",
            "role": "admin",
        }
        ok, resp = self.make_request("POST", "auth/register", data, 200)
        if ok and "token" in resp:
            self.token = resp["token"]
            self.user_id = resp["user"]["id"]
            self.log_test("User Registration", True, f"User ID: {self.user_id}")
            return True
        self.log_test("User Registration", False, f"{resp}")
        return False

    def test_user_login(self):
        data = {"email": "admin@pharmacy.com", "password": "admin123"}
        ok, resp = self.make_request("POST", "auth/login", data, 200)
        if ok and "token" in resp:
            self.token = resp["token"]
            self.user_id = resp["user"]["id"]
            self.log_test("User Login", True, f"user={resp['user']['name']}")
            return True
        self.log_test("User Login", False, f"{resp}")
        return False

    def test_auth_me(self):
        ok, resp = self.make_request("GET", "auth/me")
        if ok and "id" in resp:
            self.log_test("Auth Me", True, f"user={resp['name']}")
            return True
        self.log_test("Auth Me", False, f"{resp}")
        return False

    def test_logout(self):
        ok, resp = self.make_request("POST", "auth/logout")
        if ok and "message" in resp:
            self.log_test("User Logout", True)
            return True
        self.log_test("User Logout", False, f"{resp}")
        return False

    # ── Products (was Medicines) ──────────────────────────────────────────────

    def test_create_product(self):
        ts = datetime.now().strftime("%H%M%S%f")[:10]
        self.created_product_sku = f"TST{ts}"
        data = {
            "sku": self.created_product_sku,
            "name": "Test Paracetamol 500mg",
            "brand": "TestPharma",
            "category": "Tablets",
            "gst_percent": 12.0,
            "hsn_code": "30049099",
            "units_per_pack": 10,
            "schedule": "OTC",
            "low_stock_threshold_units": 10,
        }
        ok, resp = self.make_request("POST", "products", data)
        if ok and "id" in resp:
            self.created_product_id = resp["id"]
            self.log_test("Create Product", True, f"ID: {self.created_product_id}")
            return True
        self.log_test("Create Product", False, f"{resp}")
        return False

    def test_get_products(self):
        ok, resp = self.make_request("GET", "products")
        if ok and isinstance(resp, list):
            self.log_test("Get Products", True, f"{len(resp)} products")
            return True
        self.log_test("Get Products", False, f"{resp}")
        return False

    def test_search_products(self):
        ok, resp = self.make_request("GET", "products?search=Test")
        if ok and isinstance(resp, list):
            self.log_test("Search Products", True, f"{len(resp)} results")
            return True
        self.log_test("Search Products", False, f"{resp}")
        return False

    def test_get_product(self):
        if not self.created_product_id:
            self.log_test("Get Product by ID", False, "No product created")
            return False
        ok, resp = self.make_request("GET", f"products/{self.created_product_id}")
        if ok and resp.get("id") == self.created_product_id:
            self.log_test("Get Product by ID", True, f"sku={resp['sku']}")
            return True
        self.log_test("Get Product by ID", False, f"{resp}")
        return False

    # ── Stock Batches ─────────────────────────────────────────────────────────

    def test_create_batch(self):
        if not self.created_product_id or not self.created_product_sku:
            self.log_test("Create Stock Batch", False, "No product created")
            return False
        ts = datetime.now().strftime("%H%M%S")
        data = {
            "product_sku": self.created_product_sku,
            "batch_no": f"BTN{ts}",
            "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "mrp_per_unit": 50.0,
            "cost_price_per_unit": 35.0,
            "qty_on_hand": 100,
        }
        ok, resp = self.make_request("POST", "stock/batches", data)
        if ok and "id" in resp:
            self.created_batch_id = resp["id"]
            self.log_test("Create Stock Batch", True, f"ID: {self.created_batch_id}")
            return True
        self.log_test("Create Stock Batch", False, f"{resp}")
        return False

    def test_get_batches(self):
        ok, resp = self.make_request("GET", "stock/batches")
        if ok and isinstance(resp, list):
            self.log_test("Get Stock Batches", True, f"{len(resp)} batches")
            return True
        self.log_test("Get Stock Batches", False, f"{resp}")
        return False

    # ── Suppliers ─────────────────────────────────────────────────────────────

    def test_create_supplier(self):
        ts = datetime.now().strftime("%H%M%S")
        data = {
            "name": f"Test Supplier {ts}",
            "phone": "9876543210",
            "gstin": "29ABCDE1234F1Z5",
            "address": "Test Address, Test City",
        }
        ok, resp = self.make_request("POST", "suppliers", data)
        if ok and "id" in resp:
            self.created_supplier_id = resp["id"]
            self.log_test("Create Supplier", True, f"ID: {self.created_supplier_id}")
            return True
        self.log_test("Create Supplier", False, f"{resp}")
        return False

    def test_get_suppliers(self):
        ok, resp = self.make_request("GET", "suppliers")
        # Returns paginated {data: [...], pagination: {...}}
        if ok and isinstance(resp, dict) and "data" in resp:
            self.log_test("Get Suppliers", True, f"{len(resp['data'])} suppliers")
            return True
        if ok and isinstance(resp, list):
            self.log_test("Get Suppliers", True, f"{len(resp)} suppliers")
            return True
        self.log_test("Get Suppliers", False, f"{resp}")
        return False

    # ── Customers ─────────────────────────────────────────────────────────────

    def test_create_customer(self):
        ts = datetime.now().strftime("%H%M%S")
        data = {
            "name": f"Test Customer {ts}",
            "phone": "9876543210",
            "address": "Test Customer Address",
        }
        ok, resp = self.make_request("POST", "customers", data)
        if ok and "id" in resp:
            self.created_customer_id = resp["id"]
            self.log_test("Create Customer", True, f"ID: {self.created_customer_id}")
            return True
        self.log_test("Create Customer", False, f"{resp}")
        return False

    def test_get_customers(self):
        ok, resp = self.make_request("GET", "customers")
        if ok and isinstance(resp, list):
            self.log_test("Get Customers", True, f"{len(resp)} customers")
            return True
        self.log_test("Get Customers", False, f"{resp}")
        return False

    # ── Doctors ───────────────────────────────────────────────────────────────

    def test_create_doctor(self):
        ts = datetime.now().strftime("%H%M%S")
        data = {
            "name": f"Dr. Test {ts}",
            "contact": "9876543210",
            "specialization": "General Medicine",
        }
        ok, resp = self.make_request("POST", "doctors", data)
        if ok and "id" in resp:
            self.created_doctor_id = resp["id"]
            self.log_test("Create Doctor", True, f"ID: {self.created_doctor_id}")
            return True
        self.log_test("Create Doctor", False, f"{resp}")
        return False

    def test_get_doctors(self):
        ok, resp = self.make_request("GET", "doctors")
        if ok and isinstance(resp, dict) and "data" in resp:
            self.log_test("Get Doctors", True, f"{len(resp['data'])} doctors")
            return True
        if ok and isinstance(resp, list):
            self.log_test("Get Doctors", True, f"{len(resp)} doctors")
            return True
        self.log_test("Get Doctors", False, f"{resp}")
        return False

    # ── Billing ───────────────────────────────────────────────────────────────

    def test_create_bill(self):
        if not self.created_product_id or not self.created_batch_id:
            self.log_test("Create Bill", False, "No product/batch available for billing")
            return False
        data = {
            "customer_name": "Test Walk-in",
            "doctor_name": "Dr. Test",
            "items": [{
                "product_id": self.created_product_id,
                "batch_id": self.created_batch_id,
                "product_name": "Test Paracetamol 500mg",
                "quantity": 2,
                "unit_price": 50.0,
                "disc_percent": 0,
                "gst_percent": 12.0,
            }],
            "discount": 0,
            "tax_rate": 12.0,
            "payment_method": "cash",
            "status": "paid",
            "invoice_type": "SALE",
        }
        ok, resp = self.make_request("POST", "bills", data)
        if ok and "id" in resp:
            self.created_bill_id = resp["id"]
            self.log_test("Create Bill", True,
                          f"ID: {self.created_bill_id}, Amount: ₹{resp.get('total_amount', 0)}")
            return True
        self.log_test("Create Bill", False, f"{resp}")
        return False

    def test_create_draft_bill(self):
        if not self.created_product_id or not self.created_batch_id:
            self.log_test("Create Draft Bill", False, "No product/batch available")
            return False
        data = {
            "customer_name": "Draft Customer",
            "items": [{
                "product_id": self.created_product_id,
                "batch_id": self.created_batch_id,
                "product_name": "Test Paracetamol 500mg",
                "quantity": 1,
                "unit_price": 50.0,
                "gst_percent": 12.0,
            }],
            "discount": 0,
            "tax_rate": 12.0,
            "status": "draft",
            "invoice_type": "SALE",
        }
        ok, resp = self.make_request("POST", "bills", data)
        if ok and "id" in resp and resp.get("status") == "draft":
            self.log_test("Create Draft Bill", True, f"bill_number={resp.get('bill_number')}")
            return True
        self.log_test("Create Draft Bill", False, f"{resp}")
        return False

    def test_get_bills(self):
        ok, resp = self.make_request("GET", "bills")
        if ok and isinstance(resp, dict) and "data" in resp:
            self.log_test("Get Bills", True, f"{len(resp['data'])} bills")
            return True
        if ok and isinstance(resp, list):
            self.log_test("Get Bills", True, f"{len(resp)} bills")
            return True
        self.log_test("Get Bills", False, f"{resp}")
        return False

    def test_get_bill(self):
        if not self.created_bill_id:
            self.log_test("Get Bill by ID", False, "No bill created")
            return False
        ok, resp = self.make_request("GET", f"bills/{self.created_bill_id}")
        if ok and resp.get("id") == self.created_bill_id:
            self.log_test("Get Bill by ID", True, f"bill_number={resp.get('bill_number')}")
            return True
        self.log_test("Get Bill by ID", False, f"{resp}")
        return False

    # ── Purchases ─────────────────────────────────────────────────────────────

    def test_create_purchase(self):
        if not self.created_supplier_id or not self.created_product_sku:
            self.log_test("Create Purchase", False, "Missing supplier or product")
            return False
        data = {
            "supplier_id": self.created_supplier_id,
            "purchase_date": datetime.now().strftime("%Y-%m-%d"),
            "items": [{
                "product_sku": self.created_product_sku,
                "product_name": "Test Paracetamol 500mg",
                "batch_no": f"PUR{datetime.now().strftime('%H%M%S')}",
                "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                "qty_units": 50,
                "cost_price_per_unit": 35.0,
                "mrp_per_unit": 50.0,
                "gst_percent": 12.0,
            }],
            "status": "draft",
        }
        ok, resp = self.make_request("POST", "purchases", data)
        if ok and "id" in resp:
            self.created_purchase_id = resp["id"]
            self.log_test("Create Purchase", True, f"ID: {self.created_purchase_id}")
            return True
        self.log_test("Create Purchase", False, f"{resp}")
        return False

    def test_get_purchases(self):
        ok, resp = self.make_request("GET", "purchases")
        if ok and isinstance(resp, dict) and "data" in resp:
            self.log_test("Get Purchases", True, f"{len(resp['data'])} purchases")
            return True
        if ok and isinstance(resp, list):
            self.log_test("Get Purchases", True, f"{len(resp)} purchases")
            return True
        self.log_test("Get Purchases", False, f"{resp}")
        return False

    # ── Reports ───────────────────────────────────────────────────────────────

    def test_dashboard_stats(self):
        ok, resp = self.make_request("GET", "reports/dashboard")
        if ok and "today_sales" in resp:
            self.log_test("Dashboard Stats", True, f"today=₹{resp['today_sales']}")
            return True
        self.log_test("Dashboard Stats", False, f"{resp}")
        return False

    def test_sales_report(self):
        ok, resp = self.make_request("GET", "reports/sales")
        if ok and "bills" in resp and "summary" in resp:
            self.log_test("Sales Report", True, f"bills={resp['summary']['total_bills']}")
            return True
        self.log_test("Sales Report", False, f"{resp}")
        return False

    def test_low_stock_report(self):
        ok, resp = self.make_request("GET", "reports/low-stock")
        if ok and "summary" in resp and "data" in resp:
            self.log_test("Low Stock Report", True, f"items={resp['summary']['total_items']}")
            return True
        self.log_test("Low Stock Report", False, f"{resp}")
        return False

    def test_expiry_report(self):
        ok, resp = self.make_request("GET", "reports/expiry")
        if ok and "summary" in resp and "data" in resp:
            self.log_test("Expiry Report", True, f"items={resp['summary']['total_items']}")
            return True
        self.log_test("Expiry Report", False, f"{resp}")
        return False

    def test_analytics_summary(self):
        ok, resp = self.make_request("GET", "analytics/summary")
        if ok and "gross_sales" in resp:
            self.log_test("Analytics Summary", True,
                          f"gross=₹{resp['gross_sales']}, net=₹{resp['net_sales']}")
            return True
        self.log_test("Analytics Summary", False, f"{resp}")
        return False

    def test_analytics_dashboard(self):
        ok, resp = self.make_request("GET", "analytics/dashboard")
        if ok and "metrics" in resp and "quick_stats" in resp:
            self.log_test("Analytics Dashboard", True,
                          f"today=₹{resp['metrics']['today_sales']}")
            return True
        self.log_test("Analytics Dashboard", False, f"{resp}")
        return False

    def test_daily_analytics(self):
        ok, resp = self.make_request("GET", "analytics/daily?days=7")
        if ok and isinstance(resp, list):
            self.log_test("Daily Analytics", True, f"{len(resp)} days")
            return True
        self.log_test("Daily Analytics", False, f"{resp}")
        return False

    def test_export_data(self):
        ok, resp = self.make_request("GET", "backup/export")
        if ok and "export_date" in resp:
            self.log_test("Export Data", True)
            return True
        self.log_test("Export Data", False, f"{resp}")
        return False

    # ── Users ─────────────────────────────────────────────────────────────────

    def test_get_users(self):
        ok, resp = self.make_request("GET", "users")
        if ok and isinstance(resp, list):
            self.log_test("Get Users", True, f"{len(resp)} users")
            return True
        self.log_test("Get Users", False, f"{resp}")
        return False

    # ── Settings ──────────────────────────────────────────────────────────────

    def test_get_settings(self):
        ok, resp = self.make_request("GET", "settings")
        if ok:
            self.log_test("Get Settings", True)
            return True
        self.log_test("Get Settings", False, f"{resp}")
        return False

    def test_get_roles(self):
        ok, resp = self.make_request("GET", "roles")
        if ok and isinstance(resp, list):
            self.log_test("Get Roles", True, f"{len(resp)} roles")
            return True
        self.log_test("Get Roles", False, f"{resp}")
        return False

    # ── Inventory / Search ────────────────────────────────────────────────────

    def test_inventory_with_health(self):
        ok, resp = self.make_request("GET", "inventory")
        if ok and isinstance(resp, (list, dict)):
            count = len(resp) if isinstance(resp, list) else resp.get("total", 0)
            self.log_test("Inventory With Health", True, f"items={count}")
            return True
        self.log_test("Inventory With Health", False, f"{resp}")
        return False

    def test_search_products_with_batches(self):
        ok, resp = self.make_request("GET", "products/search-with-batches?q=Test")
        if ok and isinstance(resp, list):
            self.log_test("Search Products With Batches", True, f"{len(resp)} results")
            return True
        self.log_test("Search Products With Batches", False, f"{resp}")
        return False

    # ── Run all ───────────────────────────────────────────────────────────────

    def run_all_tests(self):
        print("=" * 60)
        print("  PharmaCare PostgreSQL Backend — Full Test Suite")
        print("=" * 60)

        # Health
        print("\n🏥 Health Check")
        if not self.test_health():
            print("  ❌ Server not reachable. Aborting.")
            return False

        # Auth
        print("\n🔐 Authentication")
        if not self.test_user_registration():
            if not self.test_user_login():
                print("  ❌ Cannot authenticate. Aborting.")
                return False
        self.test_auth_me()

        # Products
        print("\n💊 Products")
        self.test_create_product()
        self.test_get_products()
        self.test_search_products()
        self.test_get_product()

        # Stock Batches
        print("\n📦 Stock Batches")
        self.test_create_batch()
        self.test_get_batches()

        # Suppliers
        print("\n🏢 Suppliers")
        self.test_create_supplier()
        self.test_get_suppliers()

        # Customers
        print("\n👥 Customers")
        self.test_create_customer()
        self.test_get_customers()

        # Doctors
        print("\n👨‍⚕️ Doctors")
        self.test_create_doctor()
        self.test_get_doctors()

        # Billing
        print("\n🧾 Billing")
        self.test_create_bill()
        self.test_create_draft_bill()
        self.test_get_bills()
        self.test_get_bill()

        # Purchases
        print("\n📋 Purchases")
        self.test_create_purchase()
        self.test_get_purchases()

        # Reports & Analytics
        print("\n📊 Reports & Analytics")
        self.test_dashboard_stats()
        self.test_sales_report()
        self.test_low_stock_report()
        self.test_expiry_report()
        self.test_analytics_summary()
        self.test_analytics_dashboard()
        self.test_daily_analytics()
        self.test_export_data()

        # Users & Settings
        print("\n👤 Users & Settings")
        self.test_get_users()
        self.test_get_settings()
        self.test_get_roles()

        # Inventory search
        print("\n🔍 Inventory Search")
        self.test_inventory_with_health()
        self.test_search_products_with_batches()

        # Logout
        print("\n🚪 Logout")
        self.test_logout()

        # Summary
        print("\n" + "=" * 60)
        rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"  📊 Results: {self.tests_passed}/{self.tests_run} passed ({rate:.0f}%)")
        if self.tests_passed == self.tests_run:
            print("  🎉 All tests passed!")
        else:
            failed = [t["test"] for t in self.test_results if not t["success"]]
            print(f"  ❌ Failed: {', '.join(failed)}")
        print("=" * 60)
        return self.tests_passed == self.tests_run


def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    tester = PharmacyAPITester(base_url)
    success = tester.run_all_tests()

    results_path = "backend_test_results.json"
    with open(results_path, "w") as f:
        json.dump({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "base_url": base_url,
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed / tester.tests_run * 100)
                           if tester.tests_run > 0 else 0,
            "test_results": tester.test_results,
        }, f, indent=2, default=str)
    print(f"\nResults saved to {results_path}")

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
