"""
Test Suite for Save as Draft Feature in Billing Module
Tests:
1. Draft bills get DRAFT-xxx bill number instead of INV-xxx
2. Stock is NOT deducted when saving as draft
3. Regular save still works with INV-xxx and DOES deduct stock
4. Draft status is correctly saved
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestSaveAsDraftFeature:
    """Test Save as Draft feature for Billing module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures with authentication"""
        # Login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Find a product with batches for testing
        products_response = requests.get(f"{BASE_URL}/api/products/search-with-batches?q=para", headers=self.headers)
        if products_response.status_code == 200 and products_response.json():
            self.test_product = products_response.json()[0]
            if self.test_product.get('batches'):
                self.test_batch = self.test_product['batches'][0]
            else:
                self.test_batch = None
        else:
            self.test_product = None
            self.test_batch = None
    
    def test_draft_bill_gets_draft_prefix_number(self):
        """Test that draft bills get DRAFT-xxx identifier instead of INV-xxx"""
        if not self.test_product or not self.test_batch:
            pytest.skip("No test product/batch available")
        
        bill_data = {
            "customer_name": "TEST_Draft_Prefix_Customer",
            "customer_mobile": "1234567890",
            "doctor_name": "Dr. Test",
            "payment_method": "cash",
            "items": [{
                "product_sku": self.test_product['sku'],
                "product_name": self.test_product['name'],
                "batch_no": self.test_batch['batch_no'],
                "quantity": 1,
                "unit_price": self.test_batch.get('mrp_per_unit', 10),
                "discount_percent": 0,
                "gst_percent": 5,
                "line_total": self.test_batch.get('mrp_per_unit', 10) * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "draft"  # Key: saving as draft
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create draft bill: {response.text}"
        
        bill = response.json()
        # Verify bill number starts with DRAFT- instead of INV-
        assert bill['bill_number'].startswith('DRAFT-'), f"Draft bill should have DRAFT- prefix, got: {bill['bill_number']}"
        assert not bill['bill_number'].startswith('INV-'), "Draft bill should NOT have INV- prefix"
        
        print(f"✓ Draft bill number: {bill['bill_number']}")
    
    def test_draft_bill_has_draft_status(self):
        """Test that draft bills have status='draft'"""
        if not self.test_product or not self.test_batch:
            pytest.skip("No test product/batch available")
        
        bill_data = {
            "customer_name": "TEST_Draft_Status_Customer",
            "customer_mobile": "1234567890",
            "payment_method": "cash",
            "items": [{
                "product_sku": self.test_product['sku'],
                "product_name": self.test_product['name'],
                "batch_no": self.test_batch['batch_no'],
                "quantity": 1,
                "unit_price": self.test_batch.get('mrp_per_unit', 10),
                "discount_percent": 0,
                "gst_percent": 5,
                "line_total": self.test_batch.get('mrp_per_unit', 10) * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "draft"
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create draft bill: {response.text}"
        
        bill = response.json()
        assert bill['status'] == 'draft', f"Bill status should be 'draft', got: {bill['status']}"
        
        print(f"✓ Draft bill status: {bill['status']}")
    
    def test_draft_does_not_deduct_stock(self):
        """Test that saving as draft does NOT deduct stock from inventory"""
        if not self.test_product or not self.test_batch:
            pytest.skip("No test product/batch available")
        
        # Get current stock level
        batches_response = requests.get(
            f"{BASE_URL}/api/products/search-with-batches?q={self.test_product['name'][:5]}", 
            headers=self.headers
        )
        assert batches_response.status_code == 200
        
        initial_stock = None
        for product in batches_response.json():
            if product['sku'] == self.test_product['sku']:
                for batch in product.get('batches', []):
                    if batch['batch_no'] == self.test_batch['batch_no']:
                        initial_stock = batch['qty_on_hand']
                        break
        
        assert initial_stock is not None, "Could not find initial stock level"
        print(f"Initial stock: {initial_stock}")
        
        # Create draft bill (should NOT deduct stock)
        bill_data = {
            "customer_name": "TEST_Stock_NoDeduct_Customer",
            "customer_mobile": "9876543210",
            "payment_method": "cash",
            "items": [{
                "product_sku": self.test_product['sku'],
                "product_name": self.test_product['name'],
                "batch_no": self.test_batch['batch_no'],
                "batch_id": self.test_batch.get('id'),
                "quantity": 2,  # Qty to sell
                "unit_price": self.test_batch.get('mrp_per_unit', 10),
                "discount_percent": 0,
                "gst_percent": 5,
                "line_total": self.test_batch.get('mrp_per_unit', 10) * 2 * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "draft"  # DRAFT - should NOT deduct
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create draft bill: {response.text}"
        
        # Check stock after draft (should be UNCHANGED)
        batches_response = requests.get(
            f"{BASE_URL}/api/products/search-with-batches?q={self.test_product['name'][:5]}", 
            headers=self.headers
        )
        assert batches_response.status_code == 200
        
        stock_after_draft = None
        for product in batches_response.json():
            if product['sku'] == self.test_product['sku']:
                for batch in product.get('batches', []):
                    if batch['batch_no'] == self.test_batch['batch_no']:
                        stock_after_draft = batch['qty_on_hand']
                        break
        
        assert stock_after_draft is not None, "Could not find stock after draft"
        print(f"Stock after draft: {stock_after_draft}")
        
        # Stock should be UNCHANGED
        assert stock_after_draft == initial_stock, f"Stock should NOT be deducted for draft. Initial: {initial_stock}, After draft: {stock_after_draft}"
        
        print(f"✓ Draft bill did NOT deduct stock (Initial: {initial_stock}, After: {stock_after_draft})")
    
    def test_regular_save_deducts_stock(self):
        """Test that regular bill save (paid) DOES deduct stock"""
        if not self.test_product or not self.test_batch:
            pytest.skip("No test product/batch available")
        
        # Get current stock level
        batches_response = requests.get(
            f"{BASE_URL}/api/products/search-with-batches?q={self.test_product['name'][:5]}", 
            headers=self.headers
        )
        assert batches_response.status_code == 200
        
        initial_stock = None
        batch_id = None
        for product in batches_response.json():
            if product['sku'] == self.test_product['sku']:
                for batch in product.get('batches', []):
                    if batch['batch_no'] == self.test_batch['batch_no']:
                        initial_stock = batch['qty_on_hand']
                        batch_id = batch.get('id')
                        break
        
        if initial_stock is None or initial_stock < 1:
            pytest.skip("Not enough stock for regular save test")
        
        print(f"Initial stock for regular save: {initial_stock}")
        
        qty_to_sell = 1
        # Create regular bill (should deduct stock)
        bill_data = {
            "customer_name": "TEST_Stock_Deduct_Customer",
            "customer_mobile": "5555555555",
            "payment_method": "cash",
            "items": [{
                "product_sku": self.test_product['sku'],
                "product_name": self.test_product['name'],
                "batch_no": self.test_batch['batch_no'],
                "batch_id": batch_id,
                "quantity": qty_to_sell,
                "unit_price": self.test_batch.get('mrp_per_unit', 10),
                "discount_percent": 0,
                "gst_percent": 5,
                "line_total": self.test_batch.get('mrp_per_unit', 10) * qty_to_sell * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "paid"  # PAID - should deduct stock
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create bill: {response.text}"
        
        bill = response.json()
        # Verify it got INV- prefix
        assert bill['bill_number'].startswith('INV-'), f"Paid bill should have INV- prefix, got: {bill['bill_number']}"
        
        # Check stock after (should be reduced)
        batches_response = requests.get(
            f"{BASE_URL}/api/products/search-with-batches?q={self.test_product['name'][:5]}", 
            headers=self.headers
        )
        assert batches_response.status_code == 200
        
        stock_after_paid = None
        for product in batches_response.json():
            if product['sku'] == self.test_product['sku']:
                for batch in product.get('batches', []):
                    if batch['batch_no'] == self.test_batch['batch_no']:
                        stock_after_paid = batch['qty_on_hand']
                        break
        
        assert stock_after_paid is not None, "Could not find stock after paid bill"
        print(f"Stock after paid bill: {stock_after_paid}")
        
        # Stock should be DEDUCTED (qty_on_hand is in packs)
        # Note: if units_per_pack > 1, the deduction is qty_to_sell / units_per_pack
        units_per_pack = self.test_product.get('units_per_pack', 1)
        expected_deduction = qty_to_sell / units_per_pack
        
        assert stock_after_paid < initial_stock, f"Stock should be deducted for paid bill. Initial: {initial_stock}, After: {stock_after_paid}"
        
        print(f"✓ Paid bill DID deduct stock (Initial: {initial_stock}, After: {stock_after_paid}, Expected deduction: {expected_deduction})")
    
    def test_regular_save_gets_inv_prefix(self):
        """Test that regular (non-draft) bills get INV-xxx bill number"""
        if not self.test_product or not self.test_batch:
            pytest.skip("No test product/batch available")
        
        bill_data = {
            "customer_name": "TEST_INV_Prefix_Customer",
            "customer_mobile": "1111111111",
            "payment_method": "cash",
            "items": [{
                "product_sku": self.test_product['sku'],
                "product_name": self.test_product['name'],
                "batch_no": self.test_batch['batch_no'],
                "quantity": 1,
                "unit_price": self.test_batch.get('mrp_per_unit', 10),
                "discount_percent": 0,
                "gst_percent": 5,
                "line_total": self.test_batch.get('mrp_per_unit', 10) * 1.05
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "paid"  # Regular paid bill
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create bill: {response.text}"
        
        bill = response.json()
        # Verify bill number starts with INV-
        assert bill['bill_number'].startswith('INV-'), f"Paid bill should have INV- prefix, got: {bill['bill_number']}"
        assert not bill['bill_number'].startswith('DRAFT-'), "Paid bill should NOT have DRAFT- prefix"
        
        print(f"✓ Paid bill number: {bill['bill_number']}")
    
    def test_draft_bill_response_structure(self):
        """Test that draft bill response has correct structure"""
        if not self.test_product or not self.test_batch:
            pytest.skip("No test product/batch available")
        
        bill_data = {
            "customer_name": "TEST_Structure_Customer",
            "customer_mobile": "2222222222",
            "payment_method": "cash",
            "items": [{
                "product_sku": self.test_product['sku'],
                "product_name": self.test_product['name'],
                "batch_no": self.test_batch['batch_no'],
                "quantity": 1,
                "unit_price": 10,
                "discount_percent": 0,
                "gst_percent": 5,
                "line_total": 10.50
            }],
            "discount": 0,
            "tax_rate": 5,
            "status": "draft"
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create draft bill: {response.text}"
        
        bill = response.json()
        
        # Verify required fields
        assert 'id' in bill, "Bill should have id"
        assert 'bill_number' in bill, "Bill should have bill_number"
        assert 'status' in bill, "Bill should have status"
        assert 'items' in bill, "Bill should have items"
        assert 'total_amount' in bill, "Bill should have total_amount"
        
        # Verify draft-specific values
        assert bill['status'] == 'draft', f"Status should be draft, got: {bill['status']}"
        assert bill['bill_number'].startswith('DRAFT-'), f"Bill number should start with DRAFT-, got: {bill['bill_number']}"
        
        print(f"✓ Draft bill response structure is correct")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
