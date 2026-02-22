"""
Test suite for PharmaCare Billing & Returns Enhancement
Tests:
1. Returns Flow - Select Original Bill items
2. Returns Flow - Quantity Validation
3. Returns Flow - Apply Selected Returns
4. Returns Flow - Return Window Warning
5. Edit Draft Bills
6. Backend PUT /api/bills/{id}
7. Settings - Returns Tab
8. Normal Sale Flow
9. Refund Method Selection
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pharmacy-draft-save.preview.emergentagent.com')

# Module-level variables to share state between tests
test_state = {
    "token": None,
    "test_bill_id": None,
    "draft_bill_id": None,
    "return_bill_id": None
}


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for all tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "testadmin@pharmacy.com",
        "password": "admin123"
    })
    
    if response.status_code == 200:
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        test_state["token"] = token
    
    return session


class TestSettingsReturns:
    """Test Settings - Returns Tab"""
    
    def test_get_settings_returns_section(self, auth_session):
        """Test that settings include returns section"""
        response = auth_session.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        settings = response.json()
        assert "returns" in settings, "Settings should have 'returns' section"
        
        returns_settings = settings["returns"]
        assert "return_window_days" in returns_settings, "Returns settings should have return_window_days"
        assert "require_original_bill" in returns_settings, "Returns settings should have require_original_bill"
        assert "allow_partial_return" in returns_settings, "Returns settings should have allow_partial_return"
        
        print(f"✓ Returns settings found: {returns_settings}")
    
    def test_update_returns_settings(self, auth_session):
        """Test updating returns settings"""
        # Get current settings
        response = auth_session.get(f"{BASE_URL}/api/settings")
        current_settings = response.json()
        
        # Update returns settings
        current_settings["returns"] = {
            "return_window_days": 14,
            "require_original_bill": True,
            "allow_partial_return": True
        }
        
        response = auth_session.put(f"{BASE_URL}/api/settings", json=current_settings)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify update
        response = auth_session.get(f"{BASE_URL}/api/settings")
        updated_settings = response.json()
        assert updated_settings["returns"]["return_window_days"] == 14, "return_window_days should be 14"
        
        # Reset to default
        current_settings["returns"]["return_window_days"] = 7
        auth_session.put(f"{BASE_URL}/api/settings", json=current_settings)
        
        print("✓ Returns settings update works")


class TestNormalSaleFlow:
    """Test Normal Sale Flow"""
    
    def test_search_products_with_batches(self, auth_session):
        """Test product search with batches for billing"""
        response = auth_session.get(f"{BASE_URL}/api/products/search-with-batches?q=para")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        products = response.json()
        assert len(products) > 0, "Should find at least one product"
        
        product = products[0]
        assert "suggested_batch" in product or "batches" in product, "Product should have batch info"
        print(f"✓ Product search with batches works: found {len(products)} products")
    
    def test_create_sale_bill(self, auth_session):
        """Test creating a normal sale bill"""
        # Get product with batches
        response = auth_session.get(f"{BASE_URL}/api/products/search-with-batches?q=para")
        products = response.json()
        
        if not products:
            pytest.skip("No products found")
        
        product = products[0]
        batch = product.get("suggested_batch") or (product.get("batches", [{}])[0] if product.get("batches") else None)
        
        if not batch:
            pytest.skip("No batch available for product")
        
        bill_data = {
            "customer_name": "Test Customer Returns",
            "customer_mobile": "9876543210",
            "doctor_name": "Dr. Test",
            "items": [{
                "product_id": product.get("product_id"),
                "batch_id": batch.get("batch_id"),
                "product_name": product.get("name"),
                "brand": product.get("brand", ""),
                "batch_no": batch.get("batch_no"),
                "expiry_date": batch.get("expiry_date"),
                "quantity": 5,
                "unit_price": batch.get("mrp_per_unit", batch.get("mrp", 50)),
                "mrp": batch.get("mrp_per_unit", batch.get("mrp", 50)),
                "discount": 0,
                "gst_percent": 5,
                "line_total": 5 * batch.get("mrp_per_unit", batch.get("mrp", 50)) * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "paid",
            "invoice_type": "SALE",
            "payments": [{"method": "cash", "amount": 5 * batch.get("mrp_per_unit", batch.get("mrp", 50)) * 1.05}]
        }
        
        response = auth_session.post(f"{BASE_URL}/api/bills", json=bill_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        bill = response.json()
        test_state["test_bill_id"] = bill.get("id")
        assert bill.get("bill_number"), "Bill should have a bill_number"
        assert bill.get("status") == "paid", "Bill status should be paid"
        
        print(f"✓ Sale bill created: {bill.get('bill_number')}")


class TestDraftBills:
    """Test Draft Bill functionality"""
    
    def test_create_draft_bill(self, auth_session):
        """Test creating a draft bill"""
        # Get product with batches
        response = auth_session.get(f"{BASE_URL}/api/products/search-with-batches?q=para")
        products = response.json()
        
        if not products:
            pytest.skip("No products found")
        
        product = products[0]
        batch = product.get("suggested_batch") or (product.get("batches", [{}])[0] if product.get("batches") else None)
        
        if not batch:
            pytest.skip("No batch available for product")
        
        bill_data = {
            "customer_name": "Draft Customer",
            "customer_mobile": "1234567890",
            "items": [{
                "product_id": product.get("product_id"),
                "batch_id": batch.get("batch_id"),
                "product_name": product.get("name"),
                "brand": product.get("brand", ""),
                "batch_no": batch.get("batch_no"),
                "expiry_date": batch.get("expiry_date"),
                "quantity": 3,
                "unit_price": batch.get("mrp_per_unit", batch.get("mrp", 50)),
                "mrp": batch.get("mrp_per_unit", batch.get("mrp", 50)),
                "discount": 0,
                "gst_percent": 5,
                "line_total": 3 * batch.get("mrp_per_unit", batch.get("mrp", 50)) * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "draft",
            "invoice_type": "SALE"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/bills", json=bill_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        bill = response.json()
        test_state["draft_bill_id"] = bill.get("id")
        assert bill.get("status") == "draft", "Bill status should be draft"
        
        print(f"✓ Draft bill created: {bill.get('bill_number')}")
    
    def test_get_draft_bill(self, auth_session):
        """Test getting a draft bill by ID"""
        if not test_state.get("draft_bill_id"):
            pytest.skip("No draft bill created")
        
        response = auth_session.get(f"{BASE_URL}/api/bills/{test_state['draft_bill_id']}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        bill = response.json()
        assert bill.get("status") == "draft", "Bill should be draft"
        assert bill.get("customer_name") == "Draft Customer", "Customer name should match"
        
        print(f"✓ Draft bill retrieved: {bill.get('bill_number')}")
    
    def test_update_draft_bill(self, auth_session):
        """Test updating a draft bill (PUT /api/bills/{id})"""
        if not test_state.get("draft_bill_id"):
            pytest.skip("No draft bill created")
        
        # Get current bill
        response = auth_session.get(f"{BASE_URL}/api/bills/{test_state['draft_bill_id']}")
        current_bill = response.json()
        
        # Update bill data
        update_data = {
            "customer_name": "Updated Draft Customer",
            "customer_mobile": "9999999999",
            "items": current_bill.get("items", []),
            "discount": 10,
            "tax_rate": 5,
            "status": "draft",
            "invoice_type": "SALE"
        }
        
        response = auth_session.put(f"{BASE_URL}/api/bills/{test_state['draft_bill_id']}", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated_bill = response.json()
        assert updated_bill.get("customer_name") == "Updated Draft Customer", "Customer name should be updated"
        
        print(f"✓ Draft bill updated successfully")
    
    def test_cannot_update_paid_bill(self, auth_session):
        """Test that paid bills cannot be updated"""
        if not test_state.get("test_bill_id"):
            pytest.skip("No paid bill created")
        
        update_data = {
            "customer_name": "Should Not Update",
            "items": [],
            "discount": 0,
            "tax_rate": 5,
            "status": "paid",
            "invoice_type": "SALE"
        }
        
        response = auth_session.put(f"{BASE_URL}/api/bills/{test_state['test_bill_id']}", json=update_data)
        assert response.status_code == 400, f"Expected 400 for paid bill update, got {response.status_code}"
        
        print("✓ Paid bills correctly cannot be updated")


class TestReturnsFlow:
    """Test Returns Flow"""
    
    def test_get_paid_bills_for_return(self, auth_session):
        """Test getting paid bills for return selection"""
        response = auth_session.get(f"{BASE_URL}/api/bills?invoice_type=SALE&status=paid")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        bills = response.json()
        assert isinstance(bills, list), "Response should be a list"
        assert len(bills) > 0, "Should have at least one paid bill"
        
        print(f"✓ Paid bills retrieved: {len(bills)} bills")
    
    def test_get_original_bill_for_return(self, auth_session):
        """Test getting original bill details for return"""
        # Get any paid bill
        response = auth_session.get(f"{BASE_URL}/api/bills?invoice_type=SALE&status=paid")
        bills = response.json()
        
        if not bills:
            pytest.skip("No paid bills found")
        
        bill_id = bills[0].get("id")
        
        response = auth_session.get(f"{BASE_URL}/api/bills/{bill_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        bill = response.json()
        assert "items" in bill, "Bill should have items"
        assert len(bill["items"]) > 0, "Bill should have at least one item"
        
        # Verify item structure for return selection
        item = bill["items"][0]
        has_product_info = "product_id" in item or "product_name" in item or "medicine_id" in item or "medicine_name" in item
        assert has_product_info, "Item should have product info"
        assert "quantity" in item, "Item should have quantity"
        
        print(f"✓ Original bill retrieved with {len(bill['items'])} items for return")
    
    def test_create_sales_return(self, auth_session):
        """Test creating a sales return bill"""
        # Get a paid bill with items
        response = auth_session.get(f"{BASE_URL}/api/bills?invoice_type=SALE&status=paid")
        bills = response.json()
        
        if not bills:
            pytest.skip("No paid bills found")
        
        # Find a bill with proper item structure
        original_bill = None
        for bill in bills:
            if bill.get("items") and len(bill["items"]) > 0:
                item = bill["items"][0]
                if item.get("product_id") and item.get("batch_id"):
                    original_bill = bill
                    break
        
        if not original_bill:
            pytest.skip("No suitable bill found for return test")
        
        original_item = original_bill["items"][0]
        return_qty = min(1, original_item.get("quantity", 1))  # Return 1 item
        mrp = original_item.get("unit_price", original_item.get("mrp", 50))
        
        return_bill_data = {
            "customer_name": original_bill.get("customer_name", "Return Customer"),
            "customer_mobile": original_bill.get("customer_mobile", ""),
            "items": [{
                "product_id": original_item.get("product_id"),
                "batch_id": original_item.get("batch_id"),
                "product_name": original_item.get("product_name"),
                "brand": original_item.get("brand", ""),
                "batch_no": original_item.get("batch_no"),
                "expiry_date": original_item.get("expiry_date"),
                "quantity": return_qty,
                "unit_price": mrp,
                "mrp": mrp,
                "discount": 0,
                "gst_percent": original_item.get("gst_percent", 5),
                "line_total": return_qty * mrp * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "paid",
            "invoice_type": "SALES_RETURN",
            "ref_invoice_id": original_bill.get("id"),
            "payments": [{"method": "cash", "amount": return_qty * mrp * 1.05}],
            "refund": {
                "method": "cash",
                "amount": return_qty * mrp * 1.05,
                "reason": "customer_request"
            }
        }
        
        response = auth_session.post(f"{BASE_URL}/api/bills", json=return_bill_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        return_bill = response.json()
        test_state["return_bill_id"] = return_bill.get("id")
        assert return_bill.get("invoice_type") == "SALES_RETURN", "Invoice type should be SALES_RETURN"
        assert return_bill.get("ref_invoice_id") == original_bill.get("id"), "Should reference original bill"
        
        print(f"✓ Sales return created: {return_bill.get('bill_number')}")
    
    def test_get_sales_returns_list(self, auth_session):
        """Test getting list of sales returns"""
        response = auth_session.get(f"{BASE_URL}/api/bills?invoice_type=SALES_RETURN")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        returns = response.json()
        assert isinstance(returns, list), "Response should be a list"
        
        print(f"✓ Sales returns list retrieved: {len(returns)} returns")
    
    def test_refund_methods_available(self, auth_session):
        """Test that refund methods are properly handled"""
        # Get a paid bill
        response = auth_session.get(f"{BASE_URL}/api/bills?invoice_type=SALE&status=paid")
        bills = response.json()
        
        if not bills:
            pytest.skip("No paid bills found")
        
        # Find a bill with proper item structure
        original_bill = None
        for bill in bills:
            if bill.get("items") and len(bill["items"]) > 0:
                item = bill["items"][0]
                if item.get("product_id") and item.get("batch_id"):
                    original_bill = bill
                    break
        
        if not original_bill:
            pytest.skip("No suitable bill found")
        
        original_item = original_bill["items"][0]
        mrp = original_item.get("unit_price", original_item.get("mrp", 50))
        
        # Test with credit_note refund method
        return_bill_data = {
            "customer_name": original_bill.get("customer_name", "Return Customer"),
            "items": [{
                "product_id": original_item.get("product_id"),
                "batch_id": original_item.get("batch_id"),
                "product_name": original_item.get("product_name"),
                "brand": original_item.get("brand", ""),
                "batch_no": original_item.get("batch_no"),
                "expiry_date": original_item.get("expiry_date"),
                "quantity": 1,
                "unit_price": mrp,
                "mrp": mrp,
                "discount": 0,
                "gst_percent": 5,
                "line_total": mrp * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "paid",
            "invoice_type": "SALES_RETURN",
            "ref_invoice_id": original_bill.get("id"),
            "payments": [{"method": "cash", "amount": mrp * 1.05}],
            "refund": {
                "method": "credit_note",  # Test credit_note method
                "amount": mrp * 1.05,
                "reason": "damaged"
            }
        }
        
        response = auth_session.post(f"{BASE_URL}/api/bills", json=return_bill_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        print("✓ Refund with credit_note method works")


class TestPayments:
    """Test Payments functionality"""
    
    def test_get_payments_for_bill(self, auth_session):
        """Test getting payments for a bill"""
        # Get any paid bill
        response = auth_session.get(f"{BASE_URL}/api/bills?invoice_type=SALE&status=paid")
        bills = response.json()
        
        if not bills:
            pytest.skip("No paid bills found")
        
        bill_id = bills[0].get("id")
        
        response = auth_session.get(f"{BASE_URL}/api/payments?invoice_id={bill_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        payments = response.json()
        assert isinstance(payments, list), "Response should be a list"
        
        print(f"✓ Payments retrieved: {len(payments)} payments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
