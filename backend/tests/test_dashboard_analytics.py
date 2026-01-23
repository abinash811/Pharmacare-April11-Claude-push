"""
Dashboard Analytics API Tests
Tests for /api/analytics/dashboard endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardAnalytics:
    """Dashboard Analytics endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping dashboard tests")
    
    def test_dashboard_endpoint_returns_200(self):
        """Test that dashboard endpoint returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_dashboard_returns_metrics(self):
        """Test that dashboard returns metrics object with required fields"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "metrics" in data, "Response should contain 'metrics'"
        
        metrics = data["metrics"]
        required_fields = ["today_sales", "today_change", "week_sales", "week_change", 
                          "month_sales", "month_change", "total_sales"]
        
        for field in required_fields:
            assert field in metrics, f"Metrics should contain '{field}'"
            assert isinstance(metrics[field], (int, float)), f"'{field}' should be numeric"
    
    def test_dashboard_returns_daily_trend(self):
        """Test that dashboard returns daily_trend array"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "daily_trend" in data, "Response should contain 'daily_trend'"
        assert isinstance(data["daily_trend"], list), "daily_trend should be a list"
        
        # Should have up to 14 days of data
        assert len(data["daily_trend"]) <= 14, "daily_trend should have at most 14 entries"
        
        # Check structure of trend items
        if len(data["daily_trend"]) > 0:
            trend_item = data["daily_trend"][0]
            assert "date" in trend_item, "Trend item should have 'date'"
            assert "sales" in trend_item, "Trend item should have 'sales'"
    
    def test_dashboard_returns_category_sales(self):
        """Test that dashboard returns category_sales array"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "category_sales" in data, "Response should contain 'category_sales'"
        assert isinstance(data["category_sales"], list), "category_sales should be a list"
    
    def test_dashboard_returns_top_products(self):
        """Test that dashboard returns top_products array"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "top_products" in data, "Response should contain 'top_products'"
        assert isinstance(data["top_products"], list), "top_products should be a list"
        
        # Should have at most 5 products
        assert len(data["top_products"]) <= 5, "top_products should have at most 5 entries"
        
        # Check structure if products exist
        if len(data["top_products"]) > 0:
            product = data["top_products"][0]
            assert "name" in product, "Product should have 'name'"
            assert "revenue" in product, "Product should have 'revenue'"
            assert "qty" in product, "Product should have 'qty'"
    
    def test_dashboard_returns_top_customers(self):
        """Test that dashboard returns top_customers array"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "top_customers" in data, "Response should contain 'top_customers'"
        assert isinstance(data["top_customers"], list), "top_customers should be a list"
        
        # Should have at most 5 customers
        assert len(data["top_customers"]) <= 5, "top_customers should have at most 5 entries"
        
        # Check structure if customers exist
        if len(data["top_customers"]) > 0:
            customer = data["top_customers"][0]
            assert "name" in customer, "Customer should have 'name'"
            assert "revenue" in customer, "Customer should have 'revenue'"
            assert "bills" in customer, "Customer should have 'bills'"
    
    def test_dashboard_returns_low_stock_alerts(self):
        """Test that dashboard returns low_stock array"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "low_stock" in data, "Response should contain 'low_stock'"
        assert isinstance(data["low_stock"], list), "low_stock should be a list"
        
        # Check structure if items exist
        if len(data["low_stock"]) > 0:
            item = data["low_stock"][0]
            assert "product_name" in item, "Low stock item should have 'product_name'"
            assert "batch_no" in item, "Low stock item should have 'batch_no'"
            assert "qty" in item, "Low stock item should have 'qty'"
    
    def test_dashboard_returns_expiring_soon_alerts(self):
        """Test that dashboard returns expiring_soon array"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "expiring_soon" in data, "Response should contain 'expiring_soon'"
        assert isinstance(data["expiring_soon"], list), "expiring_soon should be a list"
        
        # Check structure if items exist
        if len(data["expiring_soon"]) > 0:
            item = data["expiring_soon"][0]
            assert "product_name" in item, "Expiring item should have 'product_name'"
            assert "batch_no" in item, "Expiring item should have 'batch_no'"
            assert "expiry_date" in item, "Expiring item should have 'expiry_date'"
    
    def test_dashboard_returns_recent_bills(self):
        """Test that dashboard returns recent_bills array"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "recent_bills" in data, "Response should contain 'recent_bills'"
        assert isinstance(data["recent_bills"], list), "recent_bills should be a list"
        
        # Should have at most 5 bills
        assert len(data["recent_bills"]) <= 5, "recent_bills should have at most 5 entries"
        
        # Check structure if bills exist
        if len(data["recent_bills"]) > 0:
            bill = data["recent_bills"][0]
            assert "id" in bill, "Bill should have 'id'"
            assert "bill_number" in bill, "Bill should have 'bill_number'"
            assert "customer_name" in bill, "Bill should have 'customer_name'"
            assert "amount" in bill, "Bill should have 'amount'"
    
    def test_dashboard_returns_quick_stats(self):
        """Test that dashboard returns quick_stats object"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "quick_stats" in data, "Response should contain 'quick_stats'"
        
        quick_stats = data["quick_stats"]
        required_fields = ["pending_payments", "draft_bills", "month_returns", 
                          "stock_value", "low_stock_count", "expiring_count"]
        
        for field in required_fields:
            assert field in quick_stats, f"Quick stats should contain '{field}'"
    
    def test_dashboard_requires_authentication(self):
        """Test that dashboard endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
    
    def test_dashboard_percentage_changes_are_valid(self):
        """Test that percentage changes are valid numbers"""
        response = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        metrics = data["metrics"]
        
        # Percentage changes should be numbers (can be positive, negative, or zero)
        assert isinstance(metrics["today_change"], (int, float)), "today_change should be numeric"
        assert isinstance(metrics["week_change"], (int, float)), "week_change should be numeric"
        assert isinstance(metrics["month_change"], (int, float)), "month_change should be numeric"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
