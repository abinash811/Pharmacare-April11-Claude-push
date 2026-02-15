"""
Backend Tests for P0 (Critical Optimizations) and P1 (Core Feature Completion)
- P0: Barcode lookup API, Product search with barcode
- P1: Customers CRUD, Doctors CRUD, Reports (Low Stock, Expiry, Sales Summary)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

@pytest.fixture(scope="session")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(f"{API}/auth/login", json={
        "email": "testadmin@pharmacy.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("token")

@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ===================== P0: BARCODE LOOKUP TESTS =====================
class TestBarcodeLookup:
    """P0: Fast barcode lookup API tests"""
    
    def test_barcode_lookup_nonexistent(self, auth_headers):
        """Test barcode lookup with non-existent barcode"""
        response = requests.get(f"{API}/products/barcode/9999999999999", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("found") == False
        assert "No product found" in data.get("message", "")
    
    def test_barcode_lookup_endpoint_accessible(self, auth_headers):
        """Verify barcode endpoint is accessible with auth"""
        response = requests.get(f"{API}/products/barcode/TEST123", headers=auth_headers)
        # Should return 200 even if not found (returns found: False)
        assert response.status_code == 200
        data = response.json()
        assert "found" in data
    
    def test_product_search_with_barcode_param(self, auth_headers):
        """Test product search includes barcode in searchable fields"""
        response = requests.get(f"{API}/products/search-with-batches", params={"q": "PARA"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Should return a list
        assert isinstance(data, list)


# ===================== P1: CUSTOMERS CRUD TESTS =====================
class TestCustomersCRUD:
    """P1: Customer Management CRUD tests"""
    
    @pytest.fixture
    def test_customer_id(self, auth_headers):
        """Create a test customer and return its ID for other tests"""
        unique_phone = f"TEST_{str(uuid.uuid4())[:8]}"
        customer_data = {
            "name": f"TEST_Customer_{unique_phone}",
            "phone": unique_phone,
            "email": f"test_{unique_phone}@test.com",
            "customer_type": "regular",
            "credit_limit": 5000
        }
        response = requests.post(f"{API}/customers", json=customer_data, headers=auth_headers)
        if response.status_code in [200, 201]:
            return response.json().get("id")
        return None
    
    def test_list_customers(self, auth_headers):
        """Test GET /customers - List all customers"""
        response = requests.get(f"{API}/customers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_customer(self, auth_headers):
        """Test POST /customers - Create new customer"""
        unique_phone = f"TEST_{str(uuid.uuid4())[:8]}"
        customer_data = {
            "name": f"TEST_NewCustomer_{unique_phone}",
            "phone": unique_phone,
            "email": f"newcust_{unique_phone}@test.com",
            "customer_type": "regular",
            "credit_limit": 10000
        }
        response = requests.post(f"{API}/customers", json=customer_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Create customer failed: {response.text}"
        data = response.json()
        assert data.get("name") == customer_data["name"]
        assert data.get("phone") == customer_data["phone"]
        assert "id" in data
        
        # Verify persistence - GET the created customer
        customer_id = data["id"]
        verify_response = requests.get(f"{API}/customers/{customer_id}", headers=auth_headers)
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["name"] == customer_data["name"]
    
    def test_update_customer(self, auth_headers, test_customer_id):
        """Test PUT /customers/{id} - Update customer"""
        if not test_customer_id:
            pytest.skip("Failed to create test customer")
        
        update_data = {
            "name": f"TEST_UpdatedCustomer_{test_customer_id[:8]}",
            "credit_limit": 15000
        }
        response = requests.put(f"{API}/customers/{test_customer_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200, f"Update customer failed: {response.text}"
        
        # Verify update persisted
        verify_response = requests.get(f"{API}/customers/{test_customer_id}", headers=auth_headers)
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["name"] == update_data["name"]
    
    def test_search_customers(self, auth_headers):
        """Test GET /customers/search - Search customers"""
        response = requests.get(f"{API}/customers/search", params={"q": "test"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_customer_stats(self, auth_headers, test_customer_id):
        """Test GET /customers/{id}/stats - Get customer statistics"""
        if not test_customer_id:
            pytest.skip("Failed to create test customer")
        
        response = requests.get(f"{API}/customers/{test_customer_id}/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_purchases" in data or "customer_id" in data
    
    def test_delete_customer(self, auth_headers):
        """Test DELETE /customers/{id} - Delete customer"""
        # Create a customer to delete
        unique_phone = f"DEL_{str(uuid.uuid4())[:8]}"
        customer_data = {
            "name": f"TEST_DeleteMe_{unique_phone}",
            "phone": unique_phone,
            "email": f"delete_{unique_phone}@test.com",
            "customer_type": "regular"
        }
        create_response = requests.post(f"{API}/customers", json=customer_data, headers=auth_headers)
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        customer_id = create_response.json().get("id")
        
        # Delete the customer
        delete_response = requests.delete(f"{API}/customers/{customer_id}", headers=auth_headers)
        assert delete_response.status_code in [200, 204], f"Delete failed: {delete_response.text}"
        
        # Verify deletion - should return 404
        verify_response = requests.get(f"{API}/customers/{customer_id}", headers=auth_headers)
        assert verify_response.status_code == 404


# ===================== P1: DOCTORS CRUD TESTS =====================
class TestDoctorsCRUD:
    """P1: Doctors Management CRUD tests"""
    
    @pytest.fixture
    def test_doctor_id(self, auth_headers):
        """Create a test doctor and return its ID"""
        unique_id = str(uuid.uuid4())[:8]
        doctor_data = {
            "name": f"TEST_Dr_{unique_id}",
            "contact": f"99{unique_id[:8]}",
            "specialization": "General Medicine",
            "clinic_address": "Test Clinic Address"
        }
        response = requests.post(f"{API}/doctors", json=doctor_data, headers=auth_headers)
        if response.status_code in [200, 201]:
            return response.json().get("id")
        return None
    
    def test_list_doctors(self, auth_headers):
        """Test GET /doctors - List all doctors"""
        response = requests.get(f"{API}/doctors", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_doctor(self, auth_headers):
        """Test POST /doctors - Create new doctor"""
        unique_id = str(uuid.uuid4())[:8]
        doctor_data = {
            "name": f"TEST_NewDoctor_{unique_id}",
            "contact": f"88{unique_id[:8]}",
            "specialization": "Cardiologist",
            "clinic_address": "New Test Clinic"
        }
        response = requests.post(f"{API}/doctors", json=doctor_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Create doctor failed: {response.text}"
        data = response.json()
        assert data.get("name") == doctor_data["name"]
        assert "id" in data
    
    def test_update_doctor(self, auth_headers, test_doctor_id):
        """Test PUT /doctors/{id} - Update doctor"""
        if not test_doctor_id:
            pytest.skip("Failed to create test doctor")
        
        update_data = {
            "specialization": "Neurologist",
            "clinic_address": "Updated Clinic Address"
        }
        response = requests.put(f"{API}/doctors/{test_doctor_id}", json=update_data, headers=auth_headers)
        assert response.status_code == 200, f"Update doctor failed: {response.text}"
    
    def test_delete_doctor(self, auth_headers):
        """Test DELETE /doctors/{id} - Delete doctor"""
        # Create a doctor to delete
        unique_id = str(uuid.uuid4())[:8]
        doctor_data = {
            "name": f"TEST_DeleteDoctor_{unique_id}",
            "contact": f"77{unique_id[:8]}",
            "specialization": "Test Specialty"
        }
        create_response = requests.post(f"{API}/doctors", json=doctor_data, headers=auth_headers)
        assert create_response.status_code in [200, 201]
        doctor_id = create_response.json().get("id")
        
        # Delete the doctor
        delete_response = requests.delete(f"{API}/doctors/{doctor_id}", headers=auth_headers)
        assert delete_response.status_code in [200, 204]


# ===================== P1: REPORTS TESTS =====================
class TestReports:
    """P1: Reports endpoints tests"""
    
    def test_low_stock_report(self, auth_headers):
        """Test GET /reports/low-stock - Low stock report"""
        response = requests.get(f"{API}/reports/low-stock", headers=auth_headers)
        assert response.status_code == 200, f"Low stock report failed: {response.text}"
        data = response.json()
        assert "summary" in data
        assert "data" in data
        assert "total_items" in data["summary"]
        assert "out_of_stock" in data["summary"]
        # Verify data structure
        assert isinstance(data["data"], list)
    
    def test_expiry_report_default(self, auth_headers):
        """Test GET /reports/expiry - Expiry report with default 30 days"""
        response = requests.get(f"{API}/reports/expiry", headers=auth_headers)
        assert response.status_code == 200, f"Expiry report failed: {response.text}"
        data = response.json()
        assert "summary" in data
        assert "data" in data
        assert "total_items" in data["summary"]
        assert "total_value" in data["summary"]
        assert "expired" in data["summary"]
    
    def test_expiry_report_with_days_param(self, auth_headers):
        """Test GET /reports/expiry?days=60 - Expiry report with custom days"""
        response = requests.get(f"{API}/reports/expiry", params={"days": 60}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "data" in data
    
    def test_sales_summary_report(self, auth_headers):
        """Test GET /reports/sales-summary - Sales summary report"""
        response = requests.get(f"{API}/reports/sales-summary", headers=auth_headers)
        assert response.status_code == 200, f"Sales summary report failed: {response.text}"
        data = response.json()
        assert "summary" in data
        assert "data" in data
        assert "total_bills" in data["summary"]
        assert "total_sales" in data["summary"]
    
    def test_sales_summary_with_date_range(self, auth_headers):
        """Test GET /reports/sales-summary with date range"""
        response = requests.get(f"{API}/reports/sales-summary", params={
            "from_date": "2024-01-01",
            "to_date": "2026-12-31"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "data" in data


# ===================== AUTHENTICATION TESTS =====================
class TestAuthentication:
    """Basic authentication tests"""
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{API}/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
    
    def test_protected_endpoint_without_auth(self):
        """Test that protected endpoints require auth"""
        response = requests.get(f"{API}/customers")
        assert response.status_code == 401 or response.status_code == 403


# ===================== CLEANUP =====================
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data(auth_token):
    """Cleanup TEST_ prefixed data after all tests complete"""
    yield
    # Cleanup after tests
    headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    # Cleanup test customers
    try:
        customers_response = requests.get(f"{API}/customers", headers=headers)
        if customers_response.status_code == 200:
            for customer in customers_response.json():
                if customer.get("name", "").startswith("TEST_"):
                    requests.delete(f"{API}/customers/{customer['id']}", headers=headers)
    except Exception as e:
        print(f"Cleanup customers error: {e}")
    
    # Cleanup test doctors
    try:
        doctors_response = requests.get(f"{API}/doctors", headers=headers)
        if doctors_response.status_code == 200:
            for doctor in doctors_response.json():
                if doctor.get("name", "").startswith("TEST_"):
                    requests.delete(f"{API}/doctors/{doctor['id']}", headers=headers)
    except Exception as e:
        print(f"Cleanup doctors error: {e}")
