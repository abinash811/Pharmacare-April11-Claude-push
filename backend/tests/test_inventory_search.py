"""
Test cases for Inventory Search-First feature
Tests: Search, Filters, Bulk Update API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pharmacare-v2.preview.emergentagent.com')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "testadmin@pharmacy.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture
def api_client(auth_token):
    """Authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestInventoryAPI:
    """Test inventory API endpoints"""
    
    def test_inventory_get_without_search(self, api_client):
        """Test inventory endpoint returns data without search"""
        response = api_client.get(f"{BASE_URL}/api/inventory", params={"page": 1, "page_size": 5})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "pagination" in data
        print(f"Got {len(data['items'])} items")
    
    def test_inventory_search_with_query(self, api_client):
        """Test inventory search with search query"""
        response = api_client.get(f"{BASE_URL}/api/inventory", params={
            "page": 1,
            "page_size": 20,
            "search": "pa"  # Search for "pa" (paracetamol, etc.)
        })
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        # Results should contain items matching "pa"
        print(f"Search 'pa' returned {len(data['items'])} items")
    
    def test_inventory_filter_by_status(self, api_client):
        """Test inventory filter by stock status"""
        response = api_client.get(f"{BASE_URL}/api/inventory", params={
            "page": 1,
            "page_size": 20,
            "status_filter": "healthy"
        })
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        # Check all returned items have healthy status
        for item in data['items']:
            assert item.get('status') == 'healthy', f"Expected 'healthy' status, got {item.get('status')}"
        print(f"Filter 'healthy' returned {len(data['items'])} items")
    
    def test_inventory_filter_options(self, api_client):
        """Test getting filter options for inventory"""
        response = api_client.get(f"{BASE_URL}/api/inventory/filters")
        assert response.status_code == 200
        data = response.json()
        # Should contain categories and statuses
        assert "categories" in data or "statuses" in data
        print(f"Filter options: {data}")


class TestBulkUpdateAPI:
    """Test bulk update API endpoint"""
    
    def test_bulk_update_location(self, api_client):
        """Test bulk update location field"""
        # First get some product SKUs
        products_response = api_client.get(f"{BASE_URL}/api/products", params={"page": 1, "page_size": 3})
        assert products_response.status_code == 200
        products = products_response.json()
        
        # Get first available SKU
        if isinstance(products, list) and len(products) > 0:
            sku = products[0].get('sku')
        elif isinstance(products, dict) and 'data' in products:
            sku = products['data'][0].get('sku') if products['data'] else None
        else:
            pytest.skip("No products found to test bulk update")
            return
        
        if not sku:
            pytest.skip("No product SKU found")
            return
        
        response = api_client.post(f"{BASE_URL}/api/products/bulk-update", json={
            "skus": [sku],
            "field": "location",
            "value": "Store A"
        })
        assert response.status_code == 200
        data = response.json()
        assert "modified_count" in data
        print(f"Bulk update result: {data}")
    
    def test_bulk_update_discount(self, api_client):
        """Test bulk update discount_percent field"""
        # Get some product SKUs
        products_response = api_client.get(f"{BASE_URL}/api/products", params={"page": 1, "page_size": 2})
        assert products_response.status_code == 200
        products = products_response.json()
        
        if isinstance(products, list) and len(products) > 0:
            sku = products[0].get('sku')
        elif isinstance(products, dict) and 'data' in products:
            sku = products['data'][0].get('sku') if products['data'] else None
        else:
            pytest.skip("No products found")
            return
        
        if not sku:
            pytest.skip("No product SKU found")
            return
        
        response = api_client.post(f"{BASE_URL}/api/products/bulk-update", json={
            "skus": [sku],
            "field": "discount_percent",
            "value": "5"
        })
        assert response.status_code == 200
        data = response.json()
        assert "modified_count" in data
        print(f"Discount update result: {data}")
    
    def test_bulk_update_invalid_field(self, api_client):
        """Test bulk update with invalid field returns error"""
        response = api_client.post(f"{BASE_URL}/api/products/bulk-update", json={
            "skus": ["test123"],
            "field": "invalid_field",
            "value": "test"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Invalid field error: {data['detail']}")
    
    def test_bulk_update_missing_skus(self, api_client):
        """Test bulk update without SKUs returns error"""
        response = api_client.post(f"{BASE_URL}/api/products/bulk-update", json={
            "skus": [],
            "field": "location",
            "value": "Store A"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Missing SKUs error: {data['detail']}")


class TestProductsAPI:
    """Test products API endpoints"""
    
    def test_get_products(self, api_client):
        """Test getting products list"""
        response = api_client.get(f"{BASE_URL}/api/products", params={"page": 1, "page_size": 10})
        assert response.status_code == 200
        data = response.json()
        # Can be list or paginated response
        assert isinstance(data, (list, dict))
        print(f"Got products: {type(data)}")
    
    def test_search_products(self, api_client):
        """Test searching products"""
        response = api_client.get(f"{BASE_URL}/api/products", params={
            "search": "test",
            "page": 1,
            "page_size": 10
        })
        assert response.status_code == 200
        data = response.json()
        print(f"Product search returned: {type(data)}")


class TestAuthenticationRequired:
    """Test that endpoints require authentication"""
    
    def test_inventory_requires_auth(self):
        """Test inventory endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 401
    
    def test_bulk_update_requires_auth(self):
        """Test bulk update endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/products/bulk-update", json={
            "skus": ["test"],
            "field": "location",
            "value": "test"
        })
        assert response.status_code == 401
    
    def test_products_requires_auth(self):
        """Test products endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
