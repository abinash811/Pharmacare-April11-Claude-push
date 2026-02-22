"""
Test Product Transactions API
Tests the /api/products/{sku}/transactions endpoint
Product SKU '3004' (Paracetamol 500mg) should have linked transactions
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "testadmin@pharmacy.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("token")

@pytest.fixture(scope="module")
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestProductTransactionsEndpoint:
    """Tests for /api/products/{sku}/transactions endpoint"""
    
    def test_product_3004_exists(self, api_client):
        """Verify product SKU 3004 (Paracetamol 500mg) exists"""
        response = api_client.get(f"{BASE_URL}/api/products?search=3004")
        assert response.status_code == 200
        
        products = response.json()
        # Products could be a list or paginated response
        if isinstance(products, dict) and "data" in products:
            products = products["data"]
        
        product_3004 = next((p for p in products if p.get("sku") == "3004"), None)
        assert product_3004 is not None, "Product SKU 3004 not found"
        assert product_3004["name"] == "Paracetamol 500mg"
        print(f"✓ Product 3004 found: {product_3004['name']}")
    
    def test_transactions_endpoint_returns_200(self, api_client):
        """Test transactions endpoint returns 200 for valid SKU"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Transactions endpoint returns 200")
    
    def test_transactions_response_structure(self, api_client):
        """Test transactions response has correct structure"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields exist
        assert "product_sku" in data, "Missing product_sku field"
        assert "product_name" in data, "Missing product_name field"
        assert "sales" in data, "Missing sales array"
        assert "purchases" in data, "Missing purchases array"
        assert "sales_returns" in data, "Missing sales_returns array"
        assert "purchase_returns" in data, "Missing purchase_returns array"
        
        assert data["product_sku"] == "3004"
        assert data["product_name"] == "Paracetamol 500mg"
        
        # All transaction arrays should be lists
        assert isinstance(data["sales"], list)
        assert isinstance(data["purchases"], list)
        assert isinstance(data["sales_returns"], list)
        assert isinstance(data["purchase_returns"], list)
        
        print(f"✓ Response structure correct with all required fields")
    
    def test_sales_transactions_exist(self, api_client):
        """Test that sales transactions exist for product 3004"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        sales = data["sales"]
        
        # According to context, there should be 2 sales records
        assert len(sales) >= 1, "Expected at least 1 sales record"
        
        # Verify sales record structure
        if len(sales) > 0:
            sale = sales[0]
            required_fields = ["bill_number", "date", "customer_name", "batch_no", 
                             "quantity", "unit_price", "discount", "line_total", "status"]
            for field in required_fields:
                assert field in sale, f"Sales record missing field: {field}"
            
            # Verify status is valid
            assert sale["status"] in ["paid", "due", "draft", "refunded", "cancelled"]
        
        print(f"✓ Found {len(sales)} sales records with correct structure")
    
    def test_purchases_transactions_exist(self, api_client):
        """Test that purchase transactions exist for product 3004"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        purchases = data["purchases"]
        
        # According to context, there should be 4 purchase records
        assert len(purchases) >= 1, "Expected at least 1 purchase record"
        
        # Verify purchase record structure
        if len(purchases) > 0:
            purchase = purchases[0]
            required_fields = ["purchase_number", "date", "supplier_name", "supplier_invoice",
                             "batch_no", "quantity", "cost_price", "mrp", "line_total", "status"]
            for field in required_fields:
                assert field in purchase, f"Purchase record missing field: {field}"
            
            # Verify status is valid
            assert purchase["status"] in ["draft", "confirmed", "received", "partially_received", "closed", "cancelled"]
        
        print(f"✓ Found {len(purchases)} purchase records with correct structure")
    
    def test_sales_returns_transactions_exist(self, api_client):
        """Test that sales return transactions exist for product 3004"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        sales_returns = data["sales_returns"]
        
        # According to context, there should be 2 sales return records
        assert len(sales_returns) >= 1, "Expected at least 1 sales return record"
        
        # Verify sales return record structure
        if len(sales_returns) > 0:
            return_rec = sales_returns[0]
            required_fields = ["return_number", "date", "customer_name", "batch_no",
                             "quantity", "refund_amount", "status"]
            for field in required_fields:
                assert field in return_rec, f"Sales return record missing field: {field}"
        
        print(f"✓ Found {len(sales_returns)} sales return records with correct structure")
    
    def test_purchase_returns_transactions_exist(self, api_client):
        """Test that purchase return transactions exist for product 3004"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        purchase_returns = data["purchase_returns"]
        
        # According to context, there should be 2 purchase return records
        assert len(purchase_returns) >= 1, "Expected at least 1 purchase return record"
        
        # Verify purchase return record structure
        if len(purchase_returns) > 0:
            return_rec = purchase_returns[0]
            required_fields = ["return_number", "date", "supplier_name", "original_purchase",
                             "batch_no", "quantity", "reason", "line_total", "status"]
            for field in required_fields:
                assert field in return_rec, f"Purchase return record missing field: {field}"
            
            # Verify status is valid
            assert return_rec["status"] in ["draft", "confirmed"]
        
        print(f"✓ Found {len(purchase_returns)} purchase return records with correct structure")
    
    def test_transactions_count_summary(self, api_client):
        """Summary test: verify expected transaction counts for product 3004"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        
        print(f"\n=== Transaction Summary for Product 3004 (Paracetamol 500mg) ===")
        print(f"Sales: {len(data['sales'])} records")
        print(f"Purchases: {len(data['purchases'])} records")
        print(f"Sales Returns: {len(data['sales_returns'])} records")
        print(f"Purchase Returns: {len(data['purchase_returns'])} records")
        print(f"Total: {len(data['sales']) + len(data['purchases']) + len(data['sales_returns']) + len(data['purchase_returns'])} records")
        
        # Based on context: 4 purchases, 2 sales, 2 sales returns, 2 purchase returns
        assert len(data['sales']) >= 2, f"Expected at least 2 sales, got {len(data['sales'])}"
        assert len(data['purchases']) >= 4, f"Expected at least 4 purchases, got {len(data['purchases'])}"
        assert len(data['sales_returns']) >= 2, f"Expected at least 2 sales returns, got {len(data['sales_returns'])}"
        assert len(data['purchase_returns']) >= 2, f"Expected at least 2 purchase returns, got {len(data['purchase_returns'])}"
        
        print("✓ All expected transaction counts verified")
    
    def test_transactions_404_for_nonexistent_product(self, api_client):
        """Test transactions endpoint returns 404 for non-existent SKU"""
        response = api_client.get(f"{BASE_URL}/api/products/NONEXISTENT999/transactions")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Returns 404 for non-existent product")
    
    def test_sales_status_badges_values(self, api_client):
        """Test that sales status values match expected badge colors (paid=green, due=red)"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        sales = data["sales"]
        
        status_counts = {}
        for sale in sales:
            status = sale.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"✓ Sales status distribution: {status_counts}")
        
        # All statuses should be valid
        valid_statuses = ["paid", "due", "draft", "refunded", "cancelled"]
        for status in status_counts.keys():
            assert status in valid_statuses, f"Invalid status: {status}"
    
    def test_purchase_returns_status_badges_values(self, api_client):
        """Test that purchase returns status values match expected (confirmed=green)"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions")
        assert response.status_code == 200
        
        data = response.json()
        purchase_returns = data["purchase_returns"]
        
        status_counts = {}
        for pr in purchase_returns:
            status = pr.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"✓ Purchase returns status distribution: {status_counts}")
        
        # All statuses should be valid
        valid_statuses = ["draft", "confirmed"]
        for status in status_counts.keys():
            assert status in valid_statuses, f"Invalid status: {status}"


class TestProductTransactionsTypeFilter:
    """Tests for transaction_type filter parameter"""
    
    def test_filter_sales_only(self, api_client):
        """Test filtering for sales transactions only"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions?transaction_type=sales")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["sales"]) >= 1
        # Other arrays might be empty or populated depending on implementation
        print(f"✓ Sales filter works: {len(data['sales'])} sales records")
    
    def test_filter_purchases_only(self, api_client):
        """Test filtering for purchase transactions only"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions?transaction_type=purchases")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["purchases"]) >= 1
        print(f"✓ Purchases filter works: {len(data['purchases'])} purchase records")
    
    def test_filter_all_transactions(self, api_client):
        """Test 'all' filter returns all transaction types"""
        response = api_client.get(f"{BASE_URL}/api/products/3004/transactions?transaction_type=all")
        assert response.status_code == 200
        
        data = response.json()
        total = (len(data["sales"]) + len(data["purchases"]) + 
                len(data["sales_returns"]) + len(data["purchase_returns"]))
        assert total >= 10, f"Expected at least 10 total transactions, got {total}"
        print(f"✓ All transactions filter works: {total} total records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
