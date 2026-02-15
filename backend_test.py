#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class PharmacyAPITester:
    def __init__(self, base_url: str = "https://inventory-importer.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_medicine_id = None
        self.created_supplier_id = None
        self.created_customer_id = None
        self.created_doctor_id = None
        self.created_bill_id = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}
            
            return success, response_data
            
        except Exception as e:
            return False, {"error": str(e)}

    def test_user_registration(self):
        """Test user registration"""
        test_user_data = {
            "name": "Test Admin",
            "email": f"admin_{datetime.now().strftime('%H%M%S')}@pharmacy.com",
            "password": "TestPass123!",
            "role": "admin"
        }
        
        success, response = self.make_request('POST', 'auth/register', test_user_data, 200)
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            self.log_test("User Registration", True, f"User created with ID: {self.user_id}")
            return True
        else:
            self.log_test("User Registration", False, f"Registration failed: {response}")
            return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        # Try to login with a test user
        login_data = {
            "email": "admin@pharmacy.com",
            "password": "admin123"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, 200)
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            self.log_test("User Login", True, f"Login successful for user: {response['user']['name']}")
            return True
        else:
            self.log_test("User Login", False, f"Login failed: {response}")
            return False

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.make_request('GET', 'auth/me', expected_status=200)
        
        if success and 'id' in response:
            self.log_test("Auth Me", True, f"User info retrieved: {response['name']}")
            return True
        else:
            self.log_test("Auth Me", False, f"Failed to get user info: {response}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.make_request('GET', 'reports/dashboard', expected_status=200)
        
        if success and 'today_sales' in response:
            self.log_test("Dashboard Stats", True, f"Stats retrieved - Today's sales: ₹{response['today_sales']}")
            return True
        else:
            self.log_test("Dashboard Stats", False, f"Failed to get dashboard stats: {response}")
            return False

    def test_add_medicine(self):
        """Test adding a new medicine"""
        medicine_data = {
            "name": "Test Paracetamol",
            "batch_number": f"BATCH{datetime.now().strftime('%H%M%S')}",
            "expiry_date": (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d'),
            "mrp": 50.0,
            "quantity": 100,
            "supplier_name": "Test Supplier",
            "purchase_rate": 40.0,
            "selling_price": 45.0,
            "hsn_code": "30049099"
        }
        
        success, response = self.make_request('POST', 'medicines', medicine_data, 200)
        
        if success and 'id' in response:
            self.created_medicine_id = response['id']
            self.log_test("Add Medicine", True, f"Medicine added with ID: {self.created_medicine_id}")
            return True
        else:
            self.log_test("Add Medicine", False, f"Failed to add medicine: {response}")
            return False

    def test_get_medicines(self):
        """Test getting medicines list"""
        success, response = self.make_request('GET', 'medicines', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Medicines", True, f"Retrieved {len(response)} medicines")
            return True
        else:
            self.log_test("Get Medicines", False, f"Failed to get medicines: {response}")
            return False

    def test_search_medicines(self):
        """Test medicine search"""
        success, response = self.make_request('GET', 'medicines/search?q=Test', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Search Medicines", True, f"Search returned {len(response)} results")
            return True
        else:
            self.log_test("Search Medicines", False, f"Failed to search medicines: {response}")
            return False

    def test_low_stock_alerts(self):
        """Test low stock alerts"""
        success, response = self.make_request('GET', 'medicines/alerts/low-stock', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Low Stock Alerts", True, f"Found {len(response)} low stock items")
            return True
        else:
            self.log_test("Low Stock Alerts", False, f"Failed to get low stock alerts: {response}")
            return False

    def test_expiring_medicines(self):
        """Test expiring medicines alerts"""
        success, response = self.make_request('GET', 'medicines/alerts/expiring-soon', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Expiring Medicines", True, f"Found {len(response)} expiring medicines")
            return True
        else:
            self.log_test("Expiring Medicines", False, f"Failed to get expiring medicines: {response}")
            return False

    def test_add_supplier(self):
        """Test adding a supplier"""
        supplier_data = {
            "name": f"Test Supplier {datetime.now().strftime('%H%M%S')}",
            "contact": "9876543210",
            "gstin": "29ABCDE1234F1Z5",
            "address": "Test Address, Test City"
        }
        
        success, response = self.make_request('POST', 'suppliers', supplier_data, 200)
        
        if success and 'id' in response:
            self.created_supplier_id = response['id']
            self.log_test("Add Supplier", True, f"Supplier added with ID: {self.created_supplier_id}")
            return True
        else:
            self.log_test("Add Supplier", False, f"Failed to add supplier: {response}")
            return False

    def test_get_suppliers(self):
        """Test getting suppliers list"""
        success, response = self.make_request('GET', 'suppliers', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Suppliers", True, f"Retrieved {len(response)} suppliers")
            return True
        else:
            self.log_test("Get Suppliers", False, f"Failed to get suppliers: {response}")
            return False

    def test_add_customer(self):
        """Test adding a customer"""
        customer_data = {
            "name": f"Test Customer {datetime.now().strftime('%H%M%S')}",
            "phone": "9876543210",
            "address": "Test Customer Address"
        }
        
        success, response = self.make_request('POST', 'customers', customer_data, 200)
        
        if success and 'id' in response:
            self.created_customer_id = response['id']
            self.log_test("Add Customer", True, f"Customer added with ID: {self.created_customer_id}")
            return True
        else:
            self.log_test("Add Customer", False, f"Failed to add customer: {response}")
            return False

    def test_get_customers(self):
        """Test getting customers list"""
        success, response = self.make_request('GET', 'customers', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Customers", True, f"Retrieved {len(response)} customers")
            return True
        else:
            self.log_test("Get Customers", False, f"Failed to get customers: {response}")
            return False

    def test_add_doctor(self):
        """Test adding a doctor"""
        doctor_data = {
            "name": f"Dr. Test {datetime.now().strftime('%H%M%S')}",
            "contact": "9876543210",
            "specialization": "General Medicine"
        }
        
        success, response = self.make_request('POST', 'doctors', doctor_data, 200)
        
        if success and 'id' in response:
            self.created_doctor_id = response['id']
            self.log_test("Add Doctor", True, f"Doctor added with ID: {self.created_doctor_id}")
            return True
        else:
            self.log_test("Add Doctor", False, f"Failed to add doctor: {response}")
            return False

    def test_get_doctors(self):
        """Test getting doctors list"""
        success, response = self.make_request('GET', 'doctors', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Doctors", True, f"Retrieved {len(response)} doctors")
            return True
        else:
            self.log_test("Get Doctors", False, f"Failed to get doctors: {response}")
            return False

    def test_create_bill(self):
        """Test creating a bill"""
        if not self.created_medicine_id:
            self.log_test("Create Bill", False, "No medicine available for billing")
            return False
        
        bill_data = {
            "customer_name": "Test Customer",
            "doctor_name": "Dr. Test",
            "items": [{
                "medicine_id": self.created_medicine_id,
                "medicine_name": "Test Paracetamol",
                "batch_number": f"BATCH{datetime.now().strftime('%H%M%S')}",
                "quantity": 2,
                "rate": 45.0,
                "discount": 0,
                "total": 90.0
            }],
            "discount": 5.0,
            "tax_rate": 5.0,
            "payment_method": "cash"
        }
        
        success, response = self.make_request('POST', 'bills', bill_data, 200)
        
        if success and 'id' in response:
            self.created_bill_id = response['id']
            self.log_test("Create Bill", True, f"Bill created with ID: {self.created_bill_id}, Amount: ₹{response['total_amount']}")
            return True
        else:
            self.log_test("Create Bill", False, f"Failed to create bill: {response}")
            return False

    def test_get_bills(self):
        """Test getting bills list"""
        success, response = self.make_request('GET', 'bills', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Bills", True, f"Retrieved {len(response)} bills")
            return True
        else:
            self.log_test("Get Bills", False, f"Failed to get bills: {response}")
            return False

    def test_add_purchase(self):
        """Test adding a purchase"""
        if not self.created_supplier_id or not self.created_medicine_id:
            self.log_test("Add Purchase", False, "Missing supplier or medicine for purchase")
            return False
        
        purchase_data = {
            "invoice_number": f"INV{datetime.now().strftime('%H%M%S')}",
            "supplier_id": self.created_supplier_id,
            "supplier_name": "Test Supplier",
            "items": [{
                "medicine_id": self.created_medicine_id,
                "medicine_name": "Test Paracetamol",
                "quantity": 50,
                "rate": 40.0,
                "total": 2000.0
            }],
            "total_amount": 2000.0
        }
        
        success, response = self.make_request('POST', 'purchases', purchase_data, 200)
        
        if success and 'id' in response:
            self.log_test("Add Purchase", True, f"Purchase added with ID: {response['id']}")
            return True
        else:
            self.log_test("Add Purchase", False, f"Failed to add purchase: {response}")
            return False

    def test_get_purchases(self):
        """Test getting purchases list"""
        success, response = self.make_request('GET', 'purchases', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Purchases", True, f"Retrieved {len(response)} purchases")
            return True
        else:
            self.log_test("Get Purchases", False, f"Failed to get purchases: {response}")
            return False

    def test_sales_report(self):
        """Test sales report"""
        success, response = self.make_request('GET', 'reports/sales', expected_status=200)
        
        if success and 'bills' in response and 'summary' in response:
            self.log_test("Sales Report", True, f"Report generated - Total bills: {response['summary']['total_bills']}")
            return True
        else:
            self.log_test("Sales Report", False, f"Failed to get sales report: {response}")
            return False

    def test_export_data(self):
        """Test data export"""
        success, response = self.make_request('GET', 'backup/export', expected_status=200)
        
        if success and 'export_date' in response:
            self.log_test("Export Data", True, f"Data exported successfully")
            return True
        else:
            self.log_test("Export Data", False, f"Failed to export data: {response}")
            return False

    def test_get_users(self):
        """Test getting users list (admin only)"""
        success, response = self.make_request('GET', 'users', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Users", True, f"Retrieved {len(response)} users")
            return True
        else:
            self.log_test("Get Users", False, f"Failed to get users: {response}")
            return False

    def test_logout(self):
        """Test user logout"""
        success, response = self.make_request('POST', 'auth/logout', expected_status=200)
        
        if success and 'message' in response:
            self.log_test("User Logout", True, "Logout successful")
            return True
        else:
            self.log_test("User Logout", False, f"Logout failed: {response}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🧪 Starting Pharmacy Management System API Tests")
        print("=" * 60)
        
        # Authentication Tests
        print("\n📋 Authentication Tests")
        if not self.test_user_registration():
            # If registration fails, try login
            if not self.test_user_login():
                print("❌ Cannot proceed without authentication")
                return False
        
        self.test_auth_me()
        
        # Dashboard Tests
        print("\n📊 Dashboard Tests")
        self.test_dashboard_stats()
        
        # Medicine Management Tests
        print("\n💊 Medicine Management Tests")
        self.test_add_medicine()
        self.test_get_medicines()
        self.test_search_medicines()
        self.test_low_stock_alerts()
        self.test_expiring_medicines()
        
        # Supplier Management Tests
        print("\n🏢 Supplier Management Tests")
        self.test_add_supplier()
        self.test_get_suppliers()
        
        # Customer Management Tests
        print("\n👥 Customer Management Tests")
        self.test_add_customer()
        self.test_get_customers()
        
        # Doctor Management Tests
        print("\n👨‍⚕️ Doctor Management Tests")
        self.test_add_doctor()
        self.test_get_doctors()
        
        # Billing Tests
        print("\n🧾 Billing Tests")
        self.test_create_bill()
        self.test_get_bills()
        
        # Purchase Management Tests
        print("\n📦 Purchase Management Tests")
        self.test_add_purchase()
        self.test_get_purchases()
        
        # Reports Tests
        print("\n📈 Reports Tests")
        self.test_sales_report()
        self.test_export_data()
        
        # User Management Tests
        print("\n👤 User Management Tests")
        self.test_get_users()
        
        # Logout Test
        print("\n🚪 Logout Test")
        self.test_logout()
        
        # Print Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"✅ Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main function to run tests"""
    tester = PharmacyAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0,
            'test_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())