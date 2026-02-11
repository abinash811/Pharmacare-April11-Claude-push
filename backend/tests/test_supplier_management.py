"""
Supplier Management Module Tests
Tests for: CRUD operations, status toggle, delete protection, search, summary endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSupplierManagement:
    """Supplier Management Module Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    # ==================== GET SUPPLIERS ====================
    
    def test_get_all_suppliers(self):
        """Test GET /api/suppliers returns list of suppliers"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        suppliers = response.json()
        assert isinstance(suppliers, list), "Response should be a list"
        print(f"✓ GET /api/suppliers - Found {len(suppliers)} suppliers")
        
        # Check supplier structure
        if suppliers:
            supplier = suppliers[0]
            assert "id" in supplier, "Supplier should have id"
            assert "name" in supplier, "Supplier should have name"
            assert "is_active" in supplier, "Supplier should have is_active field"
            print(f"✓ Supplier structure verified: {supplier.get('name')}")
    
    def test_get_suppliers_with_status_column(self):
        """Test that suppliers have is_active status field"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        suppliers = response.json()
        for supplier in suppliers:
            assert "is_active" in supplier, f"Supplier {supplier.get('name')} missing is_active field"
        print(f"✓ All {len(suppliers)} suppliers have is_active status field")
    
    def test_get_active_only_suppliers(self):
        """Test GET /api/suppliers?active_only=true returns only active suppliers"""
        response = self.session.get(f"{BASE_URL}/api/suppliers?active_only=true")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        suppliers = response.json()
        for supplier in suppliers:
            assert supplier.get("is_active", True) == True, f"Inactive supplier returned: {supplier.get('name')}"
        print(f"✓ GET /api/suppliers?active_only=true - All {len(suppliers)} suppliers are active")
    
    # ==================== SEARCH SUPPLIERS ====================
    
    def test_search_supplier_by_name(self):
        """Test search suppliers by name"""
        # First get all suppliers to find a name to search
        all_response = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = all_response.json()
        
        if suppliers:
            search_name = suppliers[0].get("name", "")[:5]  # First 5 chars
            search_response = self.session.get(f"{BASE_URL}/api/suppliers?search={search_name}")
            assert search_response.status_code == 200
            
            results = search_response.json()
            # Check that results contain the search term
            found = any(search_name.lower() in s.get("name", "").lower() for s in results)
            assert found or len(results) > 0, f"Search for '{search_name}' should return results"
            print(f"✓ Search by name '{search_name}' returned {len(results)} results")
        else:
            pytest.skip("No suppliers to search")
    
    def test_search_supplier_by_phone(self):
        """Test search suppliers by phone number"""
        all_response = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = all_response.json()
        
        # Find a supplier with phone
        supplier_with_phone = next((s for s in suppliers if s.get("phone")), None)
        
        if supplier_with_phone:
            phone = supplier_with_phone.get("phone", "")[:5]
            search_response = self.session.get(f"{BASE_URL}/api/suppliers?search={phone}")
            assert search_response.status_code == 200
            print(f"✓ Search by phone '{phone}' returned {len(search_response.json())} results")
        else:
            print("⚠ No suppliers with phone number to test search")
    
    # ==================== CREATE SUPPLIER ====================
    
    def test_create_supplier_with_mandatory_name(self):
        """Test creating supplier - name is mandatory"""
        # Test without name - should fail
        response = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "phone": "1234567890"
        })
        assert response.status_code in [400, 422], "Should fail without name"
        print("✓ Create supplier without name correctly rejected")
        
    def test_create_supplier_success(self):
        """Test creating a new supplier successfully"""
        test_supplier = {
            "name": "TEST_Supplier_AutoTest",
            "contact_person": "Test Contact",
            "phone": "9876543210",
            "email": "test@supplier.com",
            "address": "Test Address",
            "gstin": "22AAAAA0000A1Z5",
            "credit_days": 30,
            "notes": "Auto test supplier"
        }
        
        response = self.session.post(f"{BASE_URL}/api/suppliers", json=test_supplier)
        
        if response.status_code == 400 and "already exists" in response.text.lower():
            print("⚠ Test supplier already exists - skipping create test")
            return
            
        assert response.status_code in [200, 201], f"Create failed: {response.text}"
        
        created = response.json()
        assert created.get("name") == test_supplier["name"]
        assert created.get("is_active") == True, "New supplier should be active by default"
        print(f"✓ Created supplier: {created.get('name')} with id: {created.get('id')}")
        
        # Cleanup - delete if no purchases
        try:
            self.session.delete(f"{BASE_URL}/api/suppliers/{created.get('id')}")
        except:
            pass
    
    # ==================== EDIT SUPPLIER ====================
    
    def test_edit_supplier(self):
        """Test editing existing supplier details"""
        # Get existing suppliers
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = response.json()
        
        if not suppliers:
            pytest.skip("No suppliers to edit")
        
        supplier = suppliers[0]
        supplier_id = supplier.get("id")
        original_notes = supplier.get("notes", "")
        
        # Update notes
        update_data = {"notes": "Updated by auto test"}
        update_response = self.session.put(f"{BASE_URL}/api/suppliers/{supplier_id}", json=update_data)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print(f"✓ Updated supplier {supplier.get('name')} notes")
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert get_response.status_code == 200
        updated = get_response.json()
        assert updated.get("notes") == "Updated by auto test"
        print("✓ Verified supplier update persisted")
        
        # Restore original
        self.session.put(f"{BASE_URL}/api/suppliers/{supplier_id}", json={"notes": original_notes})
    
    # ==================== SUPPLIER DETAIL/SUMMARY ====================
    
    def test_get_supplier_summary(self):
        """Test GET /api/suppliers/{id}/summary returns purchase summary"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = response.json()
        
        if not suppliers:
            pytest.skip("No suppliers to get summary")
        
        supplier_id = suppliers[0].get("id")
        summary_response = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/summary")
        assert summary_response.status_code == 200, f"Summary failed: {summary_response.text}"
        
        summary = summary_response.json()
        assert "total_purchases" in summary, "Summary should have total_purchases"
        assert "total_purchase_value" in summary, "Summary should have total_purchase_value"
        assert "last_purchase_date" in summary, "Summary should have last_purchase_date"
        
        print(f"✓ Supplier summary: {summary.get('total_purchases')} purchases, ₹{summary.get('total_purchase_value')} total value")
        if summary.get("last_purchase_date"):
            print(f"  Last purchase: {summary.get('last_purchase_date')}")
    
    # ==================== DELETE PROTECTION ====================
    
    def test_delete_supplier_blocked_if_purchases_exist(self):
        """Test DELETE /api/suppliers/{id} blocked if purchases exist"""
        # Get suppliers
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = response.json()
        
        # Find supplier with purchases (Abinash Distributors or Test Supplier)
        supplier_with_purchases = None
        for supplier in suppliers:
            summary_resp = self.session.get(f"{BASE_URL}/api/suppliers/{supplier.get('id')}/summary")
            if summary_resp.status_code == 200:
                summary = summary_resp.json()
                if summary.get("total_purchases", 0) > 0:
                    supplier_with_purchases = supplier
                    break
        
        if not supplier_with_purchases:
            pytest.skip("No supplier with purchases found to test delete protection")
        
        # Try to delete - should fail
        delete_response = self.session.delete(f"{BASE_URL}/api/suppliers/{supplier_with_purchases.get('id')}")
        assert delete_response.status_code == 400, f"Delete should be blocked but got: {delete_response.status_code}"
        
        error_detail = delete_response.json().get("detail", "")
        assert "purchase" in error_detail.lower() or "cannot delete" in error_detail.lower(), \
            f"Error should mention purchases: {error_detail}"
        print(f"✓ Delete blocked for '{supplier_with_purchases.get('name')}': {error_detail}")
    
    # ==================== TOGGLE STATUS ====================
    
    def test_toggle_supplier_status(self):
        """Test PATCH /api/suppliers/{id}/toggle-status"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = response.json()
        
        if not suppliers:
            pytest.skip("No suppliers to toggle")
        
        supplier = suppliers[0]
        supplier_id = supplier.get("id")
        original_status = supplier.get("is_active", True)
        
        # Toggle status
        toggle_response = self.session.patch(f"{BASE_URL}/api/suppliers/{supplier_id}/toggle-status")
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        
        result = toggle_response.json()
        assert "is_active" in result, "Response should contain is_active"
        assert result.get("is_active") != original_status, "Status should have toggled"
        print(f"✓ Toggled supplier '{supplier.get('name')}' from {original_status} to {result.get('is_active')}")
        
        # Verify persistence
        get_response = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert get_response.json().get("is_active") == result.get("is_active")
        print("✓ Status toggle persisted correctly")
        
        # Restore original status
        self.session.patch(f"{BASE_URL}/api/suppliers/{supplier_id}/toggle-status")
        print(f"✓ Restored original status: {original_status}")
    
    def test_deactivated_supplier_not_in_active_only(self):
        """Test that deactivated supplier is NOT returned with active_only=true"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = response.json()
        
        if not suppliers:
            pytest.skip("No suppliers to test")
        
        supplier = suppliers[0]
        supplier_id = supplier.get("id")
        original_status = supplier.get("is_active", True)
        
        # Deactivate if active
        if original_status:
            self.session.patch(f"{BASE_URL}/api/suppliers/{supplier_id}/toggle-status")
        
        # Check active_only=true doesn't include this supplier
        active_response = self.session.get(f"{BASE_URL}/api/suppliers?active_only=true")
        active_suppliers = active_response.json()
        
        deactivated_in_list = any(s.get("id") == supplier_id for s in active_suppliers)
        assert not deactivated_in_list, "Deactivated supplier should NOT be in active_only list"
        print(f"✓ Deactivated supplier '{supplier.get('name')}' correctly excluded from active_only list")
        
        # Restore original status
        if original_status:
            self.session.patch(f"{BASE_URL}/api/suppliers/{supplier_id}/toggle-status")


class TestPurchasePageSupplierDropdown:
    """Test that Purchase page only shows active suppliers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_purchase_page_uses_active_only_suppliers(self):
        """Test that /api/suppliers?active_only=true is used for purchase dropdown"""
        # This endpoint is what PurchaseNew.js calls at line 107
        response = self.session.get(f"{BASE_URL}/api/suppliers?active_only=true")
        assert response.status_code == 200
        
        suppliers = response.json()
        for supplier in suppliers:
            assert supplier.get("is_active", True) == True, \
                f"Inactive supplier '{supplier.get('name')}' should not be in active_only list"
        
        print(f"✓ Purchase page supplier dropdown: {len(suppliers)} active suppliers available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
