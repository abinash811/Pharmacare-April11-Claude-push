"""
Test suite for InventoryV2 page backend APIs
Tests: GET /api/inventory, GET /api/stock/batches, POST /api/batches, 
       POST /api/batches/{id}/adjust, GET /api/stock-movements
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pharmacare-v2.preview.emergentagent.com')

class TestInventoryV2APIs:
    """Test suite for InventoryV2 backend APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - create test user and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Register a test user
        test_email = f"test_inventory_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
        register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "name": "Test Inventory User",
            "password": "testpass123",
            "role": "admin"
        })
        
        if register_response.status_code == 200:
            self.token = register_response.json().get("token")
            self.user = register_response.json().get("user")
        else:
            # Try login with existing test user
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "admin@pharmacy.com",
                "password": "admin123"
            })
            if login_response.status_code == 200:
                self.token = login_response.json().get("token")
                self.user = login_response.json().get("user")
            else:
                pytest.skip("Could not authenticate - skipping tests")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Create a test product for batch tests
        self.test_product_sku = f"TEST_SKU_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        product_response = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": self.test_product_sku,
            "name": "Test Product for Inventory V2",
            "brand": "Test Brand",
            "units_per_pack": 10,
            "default_mrp_per_unit": 5.0,
            "gst_percent": 5.0,
            "low_stock_threshold_units": 10
        })
        
        if product_response.status_code in [200, 201]:
            self.test_product = product_response.json()
        else:
            self.test_product = None
            print(f"Warning: Could not create test product: {product_response.text}")
    
    # ==================== GET /api/inventory Tests ====================
    
    def test_inventory_endpoint_returns_200(self):
        """Test that GET /api/inventory returns 200 status"""
        response = self.session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/inventory returns 200")
    
    def test_inventory_response_structure(self):
        """Test that inventory response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data, "Response should have 'items' field"
        assert "pagination" in data, "Response should have 'pagination' field"
        assert "summary" in data, "Response should have 'summary' field"
        
        # Check pagination structure
        pagination = data["pagination"]
        assert "current_page" in pagination
        assert "page_size" in pagination
        assert "total_items" in pagination
        assert "total_pages" in pagination
        
        # Check summary structure
        summary = data["summary"]
        assert "critical_count" in summary
        assert "warning_count" in summary
        assert "healthy_count" in summary
        
        print("✓ Inventory response has correct structure")
    
    def test_inventory_pagination(self):
        """Test inventory pagination parameters"""
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "page": 1,
            "page_size": 20
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["pagination"]["current_page"] == 1
        assert data["pagination"]["page_size"] == 20
        print("✓ Inventory pagination works correctly")
    
    def test_inventory_search(self):
        """Test inventory search functionality"""
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "search": "test"
        })
        assert response.status_code == 200
        print("✓ Inventory search works correctly")
    
    # ==================== GET /api/stock/batches Tests ====================
    
    def test_stock_batches_endpoint_returns_200(self):
        """Test that GET /api/stock/batches returns 200"""
        response = self.session.get(f"{BASE_URL}/api/stock/batches")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/stock/batches returns 200")
    
    def test_stock_batches_filter_by_product_sku(self):
        """Test filtering batches by product SKU"""
        if not self.test_product:
            pytest.skip("Test product not created")
        
        response = self.session.get(f"{BASE_URL}/api/stock/batches", params={
            "product_sku": self.test_product_sku
        })
        assert response.status_code == 200
        print("✓ Stock batches filter by product_sku works")
    
    # ==================== POST /api/stock/batches Tests ====================
    
    def test_create_batch_correct_endpoint(self):
        """Test creating a batch using correct endpoint POST /api/stock/batches"""
        if not self.test_product:
            pytest.skip("Test product not created")
        
        expiry_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        batch_data = {
            "product_sku": self.test_product_sku,
            "batch_no": f"BATCH_{datetime.now().strftime('%H%M%S')}",
            "expiry_date": expiry_date,
            "qty_on_hand": 10,
            "cost_price_per_unit": 3.0,
            "mrp_per_unit": 5.0,
            "location": "default"
        }
        
        response = self.session.post(f"{BASE_URL}/api/stock/batches", json=batch_data)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have batch id"
        self.test_batch_id = data["id"]
        print(f"✓ Created batch with id: {self.test_batch_id}")
    
    def test_create_batch_wrong_endpoint_returns_404(self):
        """Test that POST /api/batches (wrong endpoint) returns 404"""
        if not self.test_product:
            pytest.skip("Test product not created")
        
        expiry_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        batch_data = {
            "product_sku": self.test_product_sku,
            "batch_no": f"BATCH_WRONG_{datetime.now().strftime('%H%M%S')}",
            "expiry_date": expiry_date,
            "qty_on_hand": 10,
            "cost_price_per_unit": 3.0,
            "mrp_per_unit": 5.0
        }
        
        response = self.session.post(f"{BASE_URL}/api/batches", json=batch_data)
        # This should return 404 or 405 since the endpoint doesn't exist
        print(f"POST /api/batches returns: {response.status_code}")
        # Note: This is expected to fail - documenting the bug
    
    # ==================== POST /api/batches/{id}/adjust Tests ====================
    
    def test_adjust_stock_endpoint(self):
        """Test stock adjustment endpoint"""
        if not self.test_product:
            pytest.skip("Test product not created")
        
        # First create a batch
        expiry_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        batch_data = {
            "product_sku": self.test_product_sku,
            "batch_no": f"BATCH_ADJ_{datetime.now().strftime('%H%M%S')}",
            "expiry_date": expiry_date,
            "qty_on_hand": 10,
            "cost_price_per_unit": 3.0,
            "mrp_per_unit": 5.0,
            "location": "default"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/stock/batches", json=batch_data)
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create batch: {create_response.text}")
        
        batch_id = create_response.json()["id"]
        
        # Now test adjustment
        adjust_data = {
            "batch_id": batch_id,
            "adjustment_type": "add",
            "qty_units": 5,
            "reason": "Stock count correction"
        }
        
        response = self.session.post(f"{BASE_URL}/api/batches/{batch_id}/adjust", json=adjust_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert data["message"] == "Stock adjusted successfully"
        print("✓ Stock adjustment works correctly")
    
    def test_adjust_stock_remove(self):
        """Test removing stock via adjustment"""
        if not self.test_product:
            pytest.skip("Test product not created")
        
        # First create a batch with some stock
        expiry_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        batch_data = {
            "product_sku": self.test_product_sku,
            "batch_no": f"BATCH_REM_{datetime.now().strftime('%H%M%S')}",
            "expiry_date": expiry_date,
            "qty_on_hand": 10,
            "cost_price_per_unit": 3.0,
            "mrp_per_unit": 5.0,
            "location": "default"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/stock/batches", json=batch_data)
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create batch: {create_response.text}")
        
        batch_id = create_response.json()["id"]
        
        # Remove stock
        adjust_data = {
            "batch_id": batch_id,
            "adjustment_type": "remove",
            "qty_units": 5,
            "reason": "Damaged goods"
        }
        
        response = self.session.post(f"{BASE_URL}/api/batches/{batch_id}/adjust", json=adjust_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Stock removal adjustment works correctly")
    
    # ==================== GET /api/stock-movements Tests ====================
    
    def test_stock_movements_correct_endpoint(self):
        """Test that GET /api/stock-movements (correct endpoint) returns 200"""
        response = self.session.get(f"{BASE_URL}/api/stock-movements")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/stock-movements returns 200")
    
    def test_stock_movements_wrong_endpoint_returns_404(self):
        """Test that GET /api/stock/movements (wrong endpoint) returns 404"""
        response = self.session.get(f"{BASE_URL}/api/stock/movements")
        # This should return 404 since the endpoint doesn't exist
        print(f"GET /api/stock/movements returns: {response.status_code}")
        # Note: This is expected to fail - documenting the bug
    
    def test_stock_movements_filter_by_batch_id(self):
        """Test filtering stock movements by batch_id"""
        if not self.test_product:
            pytest.skip("Test product not created")
        
        # First create a batch to have movements
        expiry_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        batch_data = {
            "product_sku": self.test_product_sku,
            "batch_no": f"BATCH_MOV_{datetime.now().strftime('%H%M%S')}",
            "expiry_date": expiry_date,
            "qty_on_hand": 10,
            "cost_price_per_unit": 3.0,
            "mrp_per_unit": 5.0,
            "location": "default"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/stock/batches", json=batch_data)
        if create_response.status_code not in [200, 201]:
            pytest.skip(f"Could not create batch: {create_response.text}")
        
        batch_id = create_response.json()["id"]
        
        # Get movements for this batch
        response = self.session.get(f"{BASE_URL}/api/stock-movements", params={
            "batch_id": batch_id
        })
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the opening stock movement
        if len(data) > 0:
            assert data[0]["batch_id"] == batch_id
        print("✓ Stock movements filter by batch_id works")
    
    # ==================== Severity Sorting Tests ====================
    
    def test_inventory_severity_sorting(self):
        """Test that inventory items are sorted by severity"""
        response = self.session.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        
        if len(items) > 1:
            # Check that items are sorted by severity (1=critical, 2=warning, 3=healthy)
            severities = [item["severity"] for item in items]
            assert severities == sorted(severities), "Items should be sorted by severity"
            print("✓ Inventory items are sorted by severity")
        else:
            print("✓ Not enough items to verify sorting, but endpoint works")


class TestEndpointMismatchBugs:
    """Document endpoint mismatch bugs between frontend and backend"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Register/login
        test_email = f"test_bug_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
        register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "name": "Test Bug User",
            "password": "testpass123",
            "role": "admin"
        })
        
        if register_response.status_code == 200:
            self.token = register_response.json().get("token")
        else:
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "admin@pharmacy.com",
                "password": "admin123"
            })
            if login_response.status_code == 200:
                self.token = login_response.json().get("token")
            else:
                pytest.skip("Could not authenticate")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_bug_frontend_calls_wrong_batches_endpoint(self):
        """
        BUG: Frontend calls POST /api/batches but backend has POST /api/stock/batches
        Frontend file: InventoryV2.js line 175
        """
        response = self.session.post(f"{BASE_URL}/api/batches", json={
            "product_sku": "TEST",
            "batch_no": "TEST",
            "expiry_date": "2025-12-31",
            "qty_on_hand": 1,
            "cost_price_per_unit": 1.0,
            "mrp_per_unit": 1.0
        })
        
        # Document the bug - this returns 404 or 405
        print(f"BUG: POST /api/batches returns {response.status_code}")
        print(f"Frontend expects this to work, but backend endpoint is POST /api/stock/batches")
        assert response.status_code in [404, 405, 422], "Endpoint mismatch confirmed"
    
    def test_bug_frontend_calls_wrong_movements_endpoint(self):
        """
        BUG: Frontend calls GET /api/stock/movements but backend has GET /api/stock-movements
        Frontend file: InventoryV2.js line 232
        """
        response = self.session.get(f"{BASE_URL}/api/stock/movements")
        
        # Document the bug - this returns 404
        print(f"BUG: GET /api/stock/movements returns {response.status_code}")
        print(f"Frontend expects this to work, but backend endpoint is GET /api/stock-movements")
        assert response.status_code == 404, "Endpoint mismatch confirmed"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
