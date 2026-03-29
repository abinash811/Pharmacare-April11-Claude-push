"""
Test suite for Purchases & Purchase Returns Module
Tests: PurchasesList, PurchaseNew, Mark as Paid, Settings Modal, LIFA/LILA, LP update
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testadmin@pharmacy.com"
TEST_PASSWORD = "admin123"


class TestPurchasesModule:
    """Test suite for Purchases module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.supplier_id = None
        self.product_sku = None
        self.purchase_id = None
        
    def login(self):
        """Login and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return self.token
    
    def get_or_create_supplier(self):
        """Get existing supplier or create one for testing"""
        self.login()
        
        # Try to get existing suppliers
        response = self.session.get(f"{BASE_URL}/api/suppliers?page_size=5")
        assert response.status_code == 200, f"Failed to get suppliers: {response.text}"
        
        data = response.json()
        suppliers = data.get('data', data) if isinstance(data, dict) else data
        
        if suppliers and len(suppliers) > 0:
            self.supplier_id = suppliers[0]['id']
            return suppliers[0]
        
        # Create a test supplier
        supplier_data = {
            "name": f"TEST_Supplier_{uuid.uuid4().hex[:8]}",
            "contact_name": "Test Contact",
            "phone": "9876543210",
            "email": "test@supplier.com",
            "gstin": "29ABCDE1234F1Z5",
            "address": "Test Address",
            "payment_terms_days": 30
        }
        
        response = self.session.post(f"{BASE_URL}/api/suppliers", json=supplier_data)
        assert response.status_code in [200, 201], f"Failed to create supplier: {response.text}"
        
        supplier = response.json()
        self.supplier_id = supplier['id']
        return supplier
    
    def get_or_create_product(self):
        """Get existing product or create one for testing"""
        # Try to get existing products
        response = self.session.get(f"{BASE_URL}/api/products?page_size=5")
        assert response.status_code == 200, f"Failed to get products: {response.text}"
        
        data = response.json()
        products = data.get('data', data) if isinstance(data, dict) else data
        
        if products and len(products) > 0:
            self.product_sku = products[0]['sku']
            return products[0]
        
        # Create a test product
        product_data = {
            "sku": f"TEST_SKU_{uuid.uuid4().hex[:8]}",
            "name": f"TEST_Product_{uuid.uuid4().hex[:8]}",
            "manufacturer": "Test Manufacturer",
            "default_mrp_per_unit": 100.0,
            "default_ptr_per_unit": 80.0,
            "gst_percent": 5.0,
            "units_per_pack": 10,
            "pack_size": "Strip",
            "status": "active"
        }
        
        response = self.session.post(f"{BASE_URL}/api/products", json=product_data)
        assert response.status_code in [200, 201], f"Failed to create product: {response.text}"
        
        product = response.json()
        self.product_sku = product['sku']
        return product
    
    # ==================== PURCHASES LIST TESTS ====================
    
    def test_get_purchases_list(self):
        """Test GET /api/purchases returns list with pagination"""
        self.login()
        
        response = self.session.get(f"{BASE_URL}/api/purchases?page_size=10")
        assert response.status_code == 200, f"Failed to get purchases: {response.text}"
        
        data = response.json()
        assert 'data' in data or isinstance(data, list), "Response should contain data array"
        print(f"✓ GET /api/purchases returns {len(data.get('data', data))} purchases")
    
    def test_get_purchases_with_filters(self):
        """Test GET /api/purchases with status and supplier filters"""
        self.login()
        
        # Test status filter
        response = self.session.get(f"{BASE_URL}/api/purchases?status=draft&page_size=10")
        assert response.status_code == 200, f"Failed with status filter: {response.text}"
        print("✓ GET /api/purchases with status filter works")
        
        # Test supplier filter (if we have a supplier)
        supplier = self.get_or_create_supplier()
        response = self.session.get(f"{BASE_URL}/api/purchases?supplier_id={supplier['id']}&page_size=10")
        assert response.status_code == 200, f"Failed with supplier filter: {response.text}"
        print("✓ GET /api/purchases with supplier filter works")
    
    # ==================== CREATE PURCHASE TESTS ====================
    
    def test_create_draft_purchase(self):
        """Test creating a draft purchase"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        purchase_data = {
            "supplier_id": supplier['id'],
            "purchase_date": datetime.now().strftime("%Y-%m-%d"),
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "credit",
            "status": "draft",
            "payment_status": "unpaid",
            "items": [
                {
                    "product_sku": product['sku'],
                    "product_name": product['name'],
                    "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                    "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                    "qty_units": 100,
                    "free_qty_units": 10,
                    "cost_price_per_unit": 75.0,
                    "ptr_per_unit": 80.0,
                    "mrp_per_unit": 100.0,
                    "gst_percent": 5.0,
                    "batch_priority": "LIFA"
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
        assert response.status_code == 200, f"Failed to create draft purchase: {response.text}"
        
        purchase = response.json()
        assert purchase['status'] == 'draft', "Purchase should be in draft status"
        assert purchase['payment_status'] == 'unpaid', "Draft purchase should be unpaid"
        assert 'purchase_number' in purchase, "Purchase should have a purchase_number"
        
        self.purchase_id = purchase['id']
        print(f"✓ Created draft purchase: {purchase['purchase_number']}")
        return purchase
    
    def test_create_confirmed_credit_purchase(self):
        """Test creating a confirmed credit purchase - should add to supplier outstanding"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        # Get supplier's current outstanding
        supplier_before = self.session.get(f"{BASE_URL}/api/suppliers/{supplier['id']}").json()
        outstanding_before = supplier_before.get('outstanding', 0)
        
        purchase_data = {
            "supplier_id": supplier['id'],
            "purchase_date": datetime.now().strftime("%Y-%m-%d"),
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "credit",
            "status": "confirmed",
            "payment_status": "unpaid",
            "items": [
                {
                    "product_sku": product['sku'],
                    "product_name": product['name'],
                    "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                    "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                    "qty_units": 50,
                    "free_qty_units": 5,
                    "cost_price_per_unit": 80.0,
                    "ptr_per_unit": 85.0,
                    "mrp_per_unit": 100.0,
                    "gst_percent": 5.0,
                    "batch_priority": "LIFA"
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
        assert response.status_code == 200, f"Failed to create confirmed purchase: {response.text}"
        
        purchase = response.json()
        assert purchase['status'] == 'confirmed', "Purchase should be confirmed"
        assert purchase['payment_status'] == 'unpaid', "Credit purchase should be unpaid"
        
        # Verify supplier outstanding increased
        supplier_after = self.session.get(f"{BASE_URL}/api/suppliers/{supplier['id']}").json()
        outstanding_after = supplier_after.get('outstanding', 0)
        
        expected_increase = purchase['total_value']
        actual_increase = outstanding_after - outstanding_before
        
        assert actual_increase == expected_increase, f"Supplier outstanding should increase by {expected_increase}, got {actual_increase}"
        
        self.purchase_id = purchase['id']
        print(f"✓ Created confirmed credit purchase: {purchase['purchase_number']}")
        print(f"✓ Supplier outstanding increased from {outstanding_before} to {outstanding_after}")
        return purchase
    
    def test_create_confirmed_cash_purchase(self):
        """Test creating a confirmed cash purchase - should be marked as paid"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        purchase_data = {
            "supplier_id": supplier['id'],
            "purchase_date": datetime.now().strftime("%Y-%m-%d"),
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "cash",
            "status": "confirmed",
            "payment_status": "unpaid",  # Should be auto-set to paid
            "items": [
                {
                    "product_sku": product['sku'],
                    "product_name": product['name'],
                    "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                    "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                    "qty_units": 25,
                    "free_qty_units": 0,
                    "cost_price_per_unit": 70.0,
                    "ptr_per_unit": 75.0,
                    "mrp_per_unit": 100.0,
                    "gst_percent": 5.0,
                    "batch_priority": "LILA"
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
        assert response.status_code == 200, f"Failed to create cash purchase: {response.text}"
        
        purchase = response.json()
        assert purchase['status'] == 'confirmed', "Purchase should be confirmed"
        assert purchase['payment_status'] == 'paid', "Cash purchase should be auto-marked as paid"
        
        print(f"✓ Created confirmed cash purchase: {purchase['purchase_number']} (auto-paid)")
        return purchase
    
    def test_confirmed_purchase_updates_product_lp(self):
        """Test that confirmed purchase updates product landing_price_per_unit to PTR"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        # Get product's current LP
        product_before = self.session.get(f"{BASE_URL}/api/products/{product['sku']}").json()
        lp_before = product_before.get('landing_price_per_unit', 0)
        
        new_ptr = 95.0  # New PTR value
        
        purchase_data = {
            "supplier_id": supplier['id'],
            "purchase_date": datetime.now().strftime("%Y-%m-%d"),
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "credit",
            "status": "confirmed",
            "items": [
                {
                    "product_sku": product['sku'],
                    "product_name": product['name'],
                    "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                    "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                    "qty_units": 20,
                    "free_qty_units": 0,
                    "cost_price_per_unit": 90.0,
                    "ptr_per_unit": new_ptr,
                    "mrp_per_unit": 120.0,
                    "gst_percent": 5.0,
                    "batch_priority": "LIFA"
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
        assert response.status_code == 200, f"Failed to create purchase: {response.text}"
        
        # Verify product LP updated
        product_after = self.session.get(f"{BASE_URL}/api/products/{product['sku']}").json()
        lp_after = product_after.get('landing_price_per_unit', 0)
        
        assert lp_after == new_ptr, f"Product LP should be updated to {new_ptr}, got {lp_after}"
        
        print(f"✓ Product LP updated from {lp_before} to {lp_after} (PTR: {new_ptr})")
    
    def test_confirmed_purchase_creates_stock_batch(self):
        """Test that confirmed purchase creates stock batch with correct fields"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        batch_no = f"BATCH_{uuid.uuid4().hex[:6]}"
        ptr_value = 88.0
        batch_priority = "LILA"
        
        purchase_data = {
            "supplier_id": supplier['id'],
            "purchase_date": datetime.now().strftime("%Y-%m-%d"),
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "credit",
            "status": "confirmed",
            "items": [
                {
                    "product_sku": product['sku'],
                    "product_name": product['name'],
                    "batch_no": batch_no,
                    "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                    "qty_units": 30,
                    "free_qty_units": 5,
                    "cost_price_per_unit": 85.0,
                    "ptr_per_unit": ptr_value,
                    "mrp_per_unit": 110.0,
                    "gst_percent": 5.0,
                    "batch_priority": batch_priority
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
        assert response.status_code == 200, f"Failed to create purchase: {response.text}"
        
        purchase = response.json()
        
        # Get stock batches for this product
        batches_response = self.session.get(f"{BASE_URL}/api/stock-batches?product_sku={product['sku']}")
        
        if batches_response.status_code == 200:
            batches = batches_response.json()
            batches_list = batches.get('data', batches) if isinstance(batches, dict) else batches
            
            # Find our batch
            our_batch = None
            for batch in batches_list:
                if batch.get('batch_no') == batch_no:
                    our_batch = batch
                    break
            
            if our_batch:
                assert our_batch.get('ptr_per_unit') == ptr_value, f"Batch PTR should be {ptr_value}"
                assert our_batch.get('batch_priority') == batch_priority, f"Batch priority should be {batch_priority}"
                assert our_batch.get('qty_on_hand') == 35, "Batch qty should be 30 + 5 free = 35"
                print(f"✓ Stock batch created with PTR={ptr_value}, priority={batch_priority}, qty=35")
            else:
                print(f"⚠ Could not find batch {batch_no} in stock batches")
        else:
            print(f"⚠ Stock batches endpoint returned {batches_response.status_code}")
    
    # ==================== MARK AS PAID TESTS ====================
    
    def test_mark_purchase_as_paid(self):
        """Test POST /api/purchases/{id}/pay endpoint"""
        # First create a confirmed credit purchase
        purchase = self.test_create_confirmed_credit_purchase()
        
        # Get supplier's outstanding before payment
        supplier_before = self.session.get(f"{BASE_URL}/api/suppliers/{purchase['supplier_id']}").json()
        outstanding_before = supplier_before.get('outstanding', 0)
        
        payment_data = {
            "amount": purchase['total_value'],
            "payment_method": "bank_transfer",
            "reference_no": f"REF_{uuid.uuid4().hex[:8]}",
            "notes": "Test payment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json=payment_data)
        assert response.status_code == 200, f"Failed to mark as paid: {response.text}"
        
        updated_purchase = response.json()
        assert updated_purchase['payment_status'] == 'paid', "Purchase should be marked as paid"
        assert updated_purchase['amount_paid'] == purchase['total_value'], "Amount paid should equal total"
        
        # Verify supplier outstanding decreased
        supplier_after = self.session.get(f"{BASE_URL}/api/suppliers/{purchase['supplier_id']}").json()
        outstanding_after = supplier_after.get('outstanding', 0)
        
        expected_decrease = purchase['total_value']
        actual_decrease = outstanding_before - outstanding_after
        
        assert actual_decrease == expected_decrease, f"Supplier outstanding should decrease by {expected_decrease}"
        
        print(f"✓ Purchase marked as paid, supplier outstanding reduced by {actual_decrease}")
    
    def test_partial_payment(self):
        """Test partial payment updates payment_status to 'partial'"""
        # Create a confirmed credit purchase
        purchase = self.test_create_confirmed_credit_purchase()
        
        partial_amount = purchase['total_value'] / 2
        
        payment_data = {
            "amount": partial_amount,
            "payment_method": "cash",
            "notes": "Partial payment"
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json=payment_data)
        assert response.status_code == 200, f"Failed partial payment: {response.text}"
        
        updated_purchase = response.json()
        assert updated_purchase['payment_status'] == 'partial', "Payment status should be 'partial'"
        assert updated_purchase['amount_paid'] == partial_amount, f"Amount paid should be {partial_amount}"
        
        print(f"✓ Partial payment recorded: {partial_amount} of {purchase['total_value']}")
    
    def test_cannot_pay_already_paid_purchase(self):
        """Test that paying an already paid purchase returns error"""
        # Create a cash purchase (auto-paid)
        purchase = self.test_create_confirmed_cash_purchase()
        
        payment_data = {
            "amount": 100,
            "payment_method": "cash"
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json=payment_data)
        assert response.status_code == 400, "Should reject payment for already paid purchase"
        
        print("✓ Correctly rejected payment for already paid purchase")
    
    # ==================== PURCHASE DETAIL TESTS ====================
    
    def test_get_purchase_detail(self):
        """Test GET /api/purchases/{id} returns purchase details"""
        purchase = self.test_create_draft_purchase()
        
        response = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert response.status_code == 200, f"Failed to get purchase detail: {response.text}"
        
        detail = response.json()
        assert detail['id'] == purchase['id'], "Purchase ID should match"
        assert 'items' in detail, "Purchase should have items"
        assert len(detail['items']) > 0, "Purchase should have at least one item"
        
        print(f"✓ GET /api/purchases/{purchase['id']} returns correct details")
    
    # ==================== PURCHASE RETURNS TESTS ====================
    
    def test_get_purchase_returns(self):
        """Test GET /api/purchase-returns endpoint"""
        self.login()
        
        response = self.session.get(f"{BASE_URL}/api/purchase-returns")
        assert response.status_code == 200, f"Failed to get purchase returns: {response.text}"
        
        print("✓ GET /api/purchase-returns works")
    
    # ==================== SETTINGS MODAL FIELDS TESTS ====================
    
    def test_purchase_with_different_order_types(self):
        """Test creating purchases with different order types"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        for order_type in ['direct', 'credit', 'consignment']:
            purchase_data = {
                "supplier_id": supplier['id'],
                "purchase_date": datetime.now().strftime("%Y-%m-%d"),
                "order_type": order_type,
                "with_gst": True,
                "purchase_on": "credit",
                "status": "draft",
                "items": [
                    {
                        "product_sku": product['sku'],
                        "product_name": product['name'],
                        "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                        "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                        "qty_units": 10,
                        "cost_price_per_unit": 80.0,
                        "ptr_per_unit": 85.0,
                        "mrp_per_unit": 100.0,
                        "gst_percent": 5.0
                    }
                ]
            }
            
            response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
            assert response.status_code == 200, f"Failed with order_type={order_type}: {response.text}"
            
            purchase = response.json()
            assert purchase['order_type'] == order_type, f"Order type should be {order_type}"
            
            print(f"✓ Created purchase with order_type={order_type}")
    
    def test_purchase_with_gst_toggle(self):
        """Test creating purchases with and without GST"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        for with_gst in [True, False]:
            purchase_data = {
                "supplier_id": supplier['id'],
                "purchase_date": datetime.now().strftime("%Y-%m-%d"),
                "order_type": "direct",
                "with_gst": with_gst,
                "purchase_on": "credit",
                "status": "draft",
                "items": [
                    {
                        "product_sku": product['sku'],
                        "product_name": product['name'],
                        "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                        "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                        "qty_units": 10,
                        "cost_price_per_unit": 80.0,
                        "ptr_per_unit": 85.0,
                        "mrp_per_unit": 100.0,
                        "gst_percent": 5.0
                    }
                ]
            }
            
            response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
            assert response.status_code == 200, f"Failed with with_gst={with_gst}: {response.text}"
            
            purchase = response.json()
            assert purchase['with_gst'] == with_gst, f"with_gst should be {with_gst}"
            
            if with_gst:
                assert purchase['tax_value'] > 0, "Tax value should be > 0 when GST is enabled"
            else:
                assert purchase['tax_value'] == 0, "Tax value should be 0 when GST is disabled"
            
            print(f"✓ Created purchase with with_gst={with_gst}, tax_value={purchase['tax_value']}")
    
    def test_purchase_with_lifa_lila_batch_priority(self):
        """Test creating purchases with LIFA and LILA batch priorities"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        for priority in ['LIFA', 'LILA']:
            purchase_data = {
                "supplier_id": supplier['id'],
                "purchase_date": datetime.now().strftime("%Y-%m-%d"),
                "order_type": "direct",
                "with_gst": True,
                "purchase_on": "credit",
                "status": "draft",
                "items": [
                    {
                        "product_sku": product['sku'],
                        "product_name": product['name'],
                        "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                        "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                        "qty_units": 10,
                        "cost_price_per_unit": 80.0,
                        "ptr_per_unit": 85.0,
                        "mrp_per_unit": 100.0,
                        "gst_percent": 5.0,
                        "batch_priority": priority
                    }
                ]
            }
            
            response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
            assert response.status_code == 200, f"Failed with batch_priority={priority}: {response.text}"
            
            purchase = response.json()
            assert purchase['items'][0]['batch_priority'] == priority, f"Batch priority should be {priority}"
            
            print(f"✓ Created purchase with batch_priority={priority}")
    
    # ==================== DUE DATE TESTS ====================
    
    def test_auto_due_date_calculation(self):
        """Test that due date is auto-calculated for credit purchases"""
        self.login()
        supplier = self.get_or_create_supplier()
        product = self.get_or_create_product()
        
        purchase_date = datetime.now().strftime("%Y-%m-%d")
        
        purchase_data = {
            "supplier_id": supplier['id'],
            "purchase_date": purchase_date,
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "credit",
            "status": "draft",
            "items": [
                {
                    "product_sku": product['sku'],
                    "product_name": product['name'],
                    "batch_no": f"BATCH_{uuid.uuid4().hex[:6]}",
                    "expiry_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
                    "qty_units": 10,
                    "cost_price_per_unit": 80.0,
                    "ptr_per_unit": 85.0,
                    "mrp_per_unit": 100.0,
                    "gst_percent": 5.0
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/purchases", json=purchase_data)
        assert response.status_code == 200, f"Failed to create purchase: {response.text}"
        
        purchase = response.json()
        assert purchase.get('due_date') is not None, "Due date should be auto-calculated for credit purchase"
        
        print(f"✓ Due date auto-calculated: {purchase['due_date']}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
