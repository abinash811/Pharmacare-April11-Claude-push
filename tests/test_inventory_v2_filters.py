"""
Test suite for InventoryV2 NEW features:
- GET /api/inventory/filters endpoint
- GET /api/inventory with status_filter, category_filter, brand_filter params
- POST /api/products (Add Purchase/Product)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pharmacy-draft-save.preview.emergentagent.com')


class TestInventoryFiltersAPI:
    """Test suite for new inventory filter features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user = login_response.json().get("user")
        else:
            pytest.skip("Could not authenticate - skipping tests")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    # ==================== GET /api/inventory/filters Tests ====================
    
    def test_filters_endpoint_returns_200(self):
        """Test that GET /api/inventory/filters returns 200 status"""
        response = self.session.get(f"{BASE_URL}/api/inventory/filters")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/inventory/filters returns 200")
    
    def test_filters_response_structure(self):
        """Test that filters response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/inventory/filters")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data, "Response should have 'categories' field"
        assert "brands" in data, "Response should have 'brands' field"
        assert "statuses" in data, "Response should have 'statuses' field"
        
        # Check statuses structure
        statuses = data["statuses"]
        assert isinstance(statuses, list), "Statuses should be a list"
        assert len(statuses) == 5, "Should have 5 status options"
        
        # Verify status values
        status_values = [s["value"] for s in statuses]
        expected_statuses = ["out_of_stock", "expired", "near_expiry", "low_stock", "healthy"]
        for expected in expected_statuses:
            assert expected in status_values, f"Missing status: {expected}"
        
        print("✓ Filters response has correct structure")
    
    def test_filters_categories_are_sorted(self):
        """Test that categories are sorted alphabetically"""
        response = self.session.get(f"{BASE_URL}/api/inventory/filters")
        assert response.status_code == 200
        
        data = response.json()
        categories = data["categories"]
        assert categories == sorted(categories), "Categories should be sorted"
        print("✓ Categories are sorted alphabetically")
    
    def test_filters_brands_are_sorted(self):
        """Test that brands are sorted alphabetically"""
        response = self.session.get(f"{BASE_URL}/api/inventory/filters")
        assert response.status_code == 200
        
        data = response.json()
        brands = data["brands"]
        assert brands == sorted(brands), "Brands should be sorted"
        print("✓ Brands are sorted alphabetically")
    
    # ==================== GET /api/inventory with Filters Tests ====================
    
    def test_inventory_status_filter_healthy(self):
        """Test filtering inventory by healthy status"""
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "status_filter": "healthy",
            "page_size": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        
        # All items should have healthy status
        for item in items:
            assert item["status"] == "healthy", f"Expected healthy status, got {item['status']}"
        
        print(f"✓ Status filter 'healthy' works - {len(items)} items returned")
    
    def test_inventory_status_filter_out_of_stock(self):
        """Test filtering inventory by out_of_stock status"""
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "status_filter": "out_of_stock",
            "page_size": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        
        # All items should have out_of_stock status
        for item in items:
            assert item["status"] == "out_of_stock", f"Expected out_of_stock status, got {item['status']}"
        
        print(f"✓ Status filter 'out_of_stock' works - {len(items)} items returned")
    
    def test_inventory_status_filter_low_stock(self):
        """Test filtering inventory by low_stock status"""
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "status_filter": "low_stock",
            "page_size": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        
        # All items should have low_stock status
        for item in items:
            assert item["status"] == "low_stock", f"Expected low_stock status, got {item['status']}"
        
        print(f"✓ Status filter 'low_stock' works - {len(items)} items returned")
    
    def test_inventory_category_filter(self):
        """Test filtering inventory by category"""
        # First get available categories
        filters_response = self.session.get(f"{BASE_URL}/api/inventory/filters")
        categories = filters_response.json().get("categories", [])
        
        if not categories:
            pytest.skip("No categories available for testing")
        
        test_category = categories[0]
        
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "category_filter": test_category,
            "page_size": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        
        # All items should have the filtered category
        for item in items:
            assert item["product"]["category"] == test_category, \
                f"Expected category {test_category}, got {item['product']['category']}"
        
        print(f"✓ Category filter '{test_category}' works - {len(items)} items returned")
    
    def test_inventory_brand_filter(self):
        """Test filtering inventory by brand"""
        # First get available brands
        filters_response = self.session.get(f"{BASE_URL}/api/inventory/filters")
        brands = filters_response.json().get("brands", [])
        
        if not brands:
            pytest.skip("No brands available for testing")
        
        test_brand = brands[0]
        
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "brand_filter": test_brand,
            "page_size": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        items = data["items"]
        
        # All items should have the filtered brand
        for item in items:
            assert item["product"]["brand"] == test_brand, \
                f"Expected brand {test_brand}, got {item['product']['brand']}"
        
        print(f"✓ Brand filter '{test_brand}' works - {len(items)} items returned")
    
    def test_inventory_combined_filters(self):
        """Test combining multiple filters"""
        # Get available filters
        filters_response = self.session.get(f"{BASE_URL}/api/inventory/filters")
        filters_data = filters_response.json()
        
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "status_filter": "healthy",
            "page_size": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Combined filters work - {len(data['items'])} items returned")
    
    def test_inventory_filter_with_search(self):
        """Test combining filter with search"""
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "search": "para",
            "status_filter": "healthy",
            "page_size": 50
        })
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Filter with search works - {len(data['items'])} items returned")
    
    def test_inventory_filter_pagination(self):
        """Test that pagination works with filters"""
        response = self.session.get(f"{BASE_URL}/api/inventory", params={
            "status_filter": "out_of_stock",
            "page": 1,
            "page_size": 5
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "pagination" in data
        assert data["pagination"]["page_size"] == 5
        assert data["pagination"]["current_page"] == 1
        
        print("✓ Pagination works with filters")
    
    # ==================== Add Product Tests ====================
    
    def test_add_product_endpoint(self):
        """Test POST /api/products to add a new product"""
        test_sku = f"TEST_FILTER_{datetime.now().strftime('%H%M%S')}"
        
        response = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": test_sku,
            "name": "Test Filter Product",
            "brand": "Test Brand",
            "category": "Test Category",
            "units_per_pack": 10,
            "default_mrp_per_unit": 15.0,
            "gst_percent": 5.0,
            "low_stock_threshold_units": 10
        })
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["sku"] == test_sku
        assert data["name"] == "Test Filter Product"
        
        print(f"✓ Add product works - created {test_sku}")
    
    def test_add_product_with_initial_stock(self):
        """Test adding product and then adding initial stock batch"""
        test_sku = f"TEST_STOCK_{datetime.now().strftime('%H%M%S')}"
        
        # Create product
        product_response = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": test_sku,
            "name": "Test Product With Stock",
            "brand": "Test Brand",
            "units_per_pack": 10,
            "default_mrp_per_unit": 20.0,
            "gst_percent": 5.0
        })
        
        assert product_response.status_code in [200, 201]
        
        # Add initial stock batch
        expiry_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        batch_response = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": test_sku,
            "batch_no": f"INIT-{datetime.now().strftime('%H%M%S')}",
            "expiry_date": expiry_date,
            "qty_on_hand": 10,
            "cost_price_per_unit": 15.0,
            "mrp_per_unit": 20.0,
            "location": "default"
        })
        
        assert batch_response.status_code in [200, 201], f"Expected 200/201, got {batch_response.status_code}: {batch_response.text}"
        
        print(f"✓ Add product with initial stock works - created {test_sku}")
    
    def test_add_product_duplicate_sku_fails(self):
        """Test that adding product with duplicate SKU fails"""
        test_sku = f"TEST_DUP_{datetime.now().strftime('%H%M%S')}"
        
        # Create first product
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": test_sku,
            "name": "First Product",
            "brand": "Test Brand",
            "units_per_pack": 1,
            "default_mrp_per_unit": 10.0,
            "gst_percent": 5.0
        })
        
        # Try to create duplicate
        response = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": test_sku,
            "name": "Duplicate Product",
            "brand": "Test Brand",
            "units_per_pack": 1,
            "default_mrp_per_unit": 10.0,
            "gst_percent": 5.0
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate SKU, got {response.status_code}"
        print("✓ Duplicate SKU correctly rejected")


class TestExportButtonRemoved:
    """Test that Export button functionality is removed"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
        else:
            pytest.skip("Could not authenticate")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_no_export_endpoint(self):
        """Verify there's no export endpoint (as Export button was removed)"""
        # This test documents that export functionality was removed
        # The frontend no longer has an Export button
        response = self.session.get(f"{BASE_URL}/api/inventory/export")
        # Should return 404 or similar since endpoint doesn't exist
        assert response.status_code in [404, 405, 422], \
            f"Export endpoint should not exist, got {response.status_code}"
        print("✓ Export endpoint correctly does not exist (Export button removed)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
