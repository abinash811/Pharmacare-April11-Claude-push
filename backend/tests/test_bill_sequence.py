"""
Test Bill Number Sequence Generation System
Tests:
- GET /api/settings/bill-sequences - Get current sequences
- PUT /api/settings/bill-sequence - Update sequence settings
- Sequential bill number generation
- Draft bills use DRAFT- prefix
- Concurrent bill creation generates unique numbers
- Validation blocks starting number lower than last used
"""

import pytest
import requests
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testadmin@pharmacy.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture
def auth_headers(auth_token):
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestBillSequenceGetEndpoints:
    """Test GET endpoints for bill sequences"""
    
    def test_get_all_bill_sequences(self, auth_headers):
        """Test GET /api/settings/bill-sequences returns current sequences"""
        response = requests.get(f"{BASE_URL}/api/settings/bill-sequences", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "sequences" in data, "Response should contain 'sequences' array"
        
        sequences = data["sequences"]
        assert isinstance(sequences, list), "sequences should be a list"
        
        # Verify INV sequence exists
        inv_seq = next((s for s in sequences if s.get("prefix") == "INV"), None)
        assert inv_seq is not None, "INV sequence should exist"
        assert "current_sequence" in inv_seq, "Should have current_sequence"
        assert "next_number" in inv_seq, "Should have next_number"
        assert "sequence_length" in inv_seq, "Should have sequence_length"
        assert "document_type" in inv_seq, "Should have document_type"
        
        print(f"Found {len(sequences)} sequences: {[s['prefix'] for s in sequences]}")
        print(f"INV sequence: current={inv_seq['current_sequence']}, next={inv_seq['next_number']}")
    
    def test_get_single_bill_sequence(self, auth_headers):
        """Test GET /api/settings/bill-sequence?prefix=INV"""
        response = requests.get(f"{BASE_URL}/api/settings/bill-sequence?prefix=INV", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "prefix" in data, "Should have prefix"
        assert "current_sequence" in data, "Should have current_sequence"
        assert "next_number" in data, "Should have next_number"
        
        print(f"Single sequence for INV: {data}")
    
    def test_get_rtn_sequence(self, auth_headers):
        """Test GET /api/settings/bill-sequence?prefix=RTN for returns"""
        response = requests.get(f"{BASE_URL}/api/settings/bill-sequence?prefix=RTN", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("prefix") == "RTN", "Should have RTN prefix"
        print(f"RTN sequence: {data}")


class TestBillSequenceUpdateEndpoint:
    """Test PUT endpoint for updating bill sequence settings"""
    
    def test_update_sequence_settings(self, auth_headers):
        """Test PUT /api/settings/bill-sequence updates sequence settings"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings/bill-sequences", headers=auth_headers)
        assert get_response.status_code == 200
        
        sequences = get_response.json().get("sequences", [])
        inv_seq = next((s for s in sequences if s.get("prefix") == "INV"), None)
        
        # If INV sequence exists, we need to use a starting number greater than current
        current_seq = inv_seq.get("current_sequence", 0) if inv_seq else 0
        new_starting = max(current_seq + 100, 1000)  # Use a high number to avoid conflicts
        
        # Update sequence
        update_data = {
            "prefix": "INV",
            "starting_number": new_starting,
            "sequence_length": 6,
            "allow_prefix_change": True
        }
        
        response = requests.put(f"{BASE_URL}/api/settings/bill-sequence", 
                               json=update_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Should have success message"
        assert "settings" in data, "Should return updated settings"
        
        print(f"Updated sequence: {data}")
        
        # Verify the change
        verify_response = requests.get(f"{BASE_URL}/api/settings/bill-sequence?prefix=INV", 
                                       headers=auth_headers)
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data.get("next_number") == new_starting, "Next number should be updated"
    
    def test_update_sequence_length(self, auth_headers):
        """Test updating sequence length changes format"""
        # Get current sequence
        get_response = requests.get(f"{BASE_URL}/api/settings/bill-sequences", headers=auth_headers)
        sequences = get_response.json().get("sequences", [])
        inv_seq = next((s for s in sequences if s.get("prefix") == "INV"), None)
        
        current_seq = inv_seq.get("current_sequence", 0) if inv_seq else 0
        new_starting = max(current_seq + 1, 1)
        
        # Update with different sequence length
        update_data = {
            "prefix": "INV",
            "starting_number": new_starting,
            "sequence_length": 8,  # Change to 8 digits
            "allow_prefix_change": True
        }
        
        response = requests.put(f"{BASE_URL}/api/settings/bill-sequence", 
                               json=update_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify length was updated
        verify_response = requests.get(f"{BASE_URL}/api/settings/bill-sequence?prefix=INV", 
                                       headers=auth_headers)
        verify_data = verify_response.json()
        assert verify_data.get("sequence_length") == 8, "Sequence length should be 8"


class TestBillSequenceValidation:
    """Test validation rules for bill sequence settings"""
    
    def test_invalid_prefix_too_long(self, auth_headers):
        """Test that prefix longer than 10 chars is rejected"""
        update_data = {
            "prefix": "TOOLONGPREFIX123",
            "starting_number": 1,
            "sequence_length": 6,
            "allow_prefix_change": True
        }
        
        response = requests.put(f"{BASE_URL}/api/settings/bill-sequence", 
                               json=update_data, headers=auth_headers)
        assert response.status_code == 400, "Should reject long prefix"
        print(f"Correctly rejected long prefix: {response.json()}")
    
    def test_invalid_prefix_special_chars(self, auth_headers):
        """Test that prefix with special chars is rejected"""
        update_data = {
            "prefix": "INV-2024",
            "starting_number": 1,
            "sequence_length": 6,
            "allow_prefix_change": True
        }
        
        response = requests.put(f"{BASE_URL}/api/settings/bill-sequence", 
                               json=update_data, headers=auth_headers)
        assert response.status_code == 400, "Should reject special characters in prefix"
        print(f"Correctly rejected special chars: {response.json()}")
    
    def test_invalid_sequence_length_too_short(self, auth_headers):
        """Test that sequence length < 3 is rejected"""
        update_data = {
            "prefix": "INV",
            "starting_number": 1,
            "sequence_length": 2,
            "allow_prefix_change": True
        }
        
        response = requests.put(f"{BASE_URL}/api/settings/bill-sequence", 
                               json=update_data, headers=auth_headers)
        assert response.status_code == 400, "Should reject sequence length < 3"
        print(f"Correctly rejected short length: {response.json()}")
    
    def test_invalid_starting_number_zero(self, auth_headers):
        """Test that starting number < 1 is rejected"""
        update_data = {
            "prefix": "INV",
            "starting_number": 0,
            "sequence_length": 6,
            "allow_prefix_change": True
        }
        
        response = requests.put(f"{BASE_URL}/api/settings/bill-sequence", 
                               json=update_data, headers=auth_headers)
        assert response.status_code == 400, "Should reject starting number < 1"
        print(f"Correctly rejected zero starting number: {response.json()}")
    
    def test_starting_number_less_than_current_rejected(self, auth_headers):
        """Test that starting number less than current sequence is rejected"""
        # First get current sequence
        get_response = requests.get(f"{BASE_URL}/api/settings/bill-sequences", headers=auth_headers)
        sequences = get_response.json().get("sequences", [])
        inv_seq = next((s for s in sequences if s.get("prefix") == "INV"), None)
        
        if inv_seq and inv_seq.get("current_sequence", 0) > 0:
            # Try to set starting number less than current
            update_data = {
                "prefix": "INV",
                "starting_number": 1,  # Should be rejected if current > 1
                "sequence_length": 6,
                "allow_prefix_change": True
            }
            
            response = requests.put(f"{BASE_URL}/api/settings/bill-sequence", 
                                   json=update_data, headers=auth_headers)
            assert response.status_code == 400, f"Should reject starting number less than current ({inv_seq['current_sequence']})"
            assert "greater than" in response.json().get("detail", "").lower(), "Error should mention needing greater value"
            print(f"Correctly rejected low starting number: {response.json()}")
        else:
            pytest.skip("No existing sequence to test against")


class TestDraftBillsNoSequence:
    """Test that draft bills don't consume sequence numbers"""
    
    def test_draft_bill_uses_draft_prefix(self, auth_headers):
        """Test that draft bills get DRAFT- prefix instead of INV-"""
        # Get current sequence number
        get_response = requests.get(f"{BASE_URL}/api/settings/bill-sequence?prefix=INV", headers=auth_headers)
        current_next = get_response.json().get("next_number", 1)
        
        # Create a draft bill
        draft_bill = {
            "customer_name": "TEST Draft Customer",
            "customer_mobile": "9999999999",
            "items": [
                {
                    "product_id": "test-product-draft",
                    "product_name": "Test Product for Draft",
                    "batch_no": "BATCH-DRAFT",
                    "quantity": 1,
                    "unit_price": 10,
                    "mrp": 10,
                    "discount": 0,
                    "gst_percent": 5,
                    "line_total": 10.5
                }
            ],
            "discount": 0,
            "tax_rate": 5,
            "payment_method": "cash",
            "status": "draft",
            "invoice_type": "SALE"
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=draft_bill, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create draft bill: {response.text}"
        
        bill = response.json()
        assert bill.get("bill_number", "").startswith("DRAFT-"), f"Draft bill should have DRAFT- prefix, got: {bill.get('bill_number')}"
        print(f"Draft bill number: {bill.get('bill_number')}")
        
        # Verify sequence number didn't change
        verify_response = requests.get(f"{BASE_URL}/api/settings/bill-sequence?prefix=INV", headers=auth_headers)
        new_next = verify_response.json().get("next_number", 1)
        assert new_next == current_next, "Draft bill should not consume sequence number"
        print(f"Sequence unchanged: was {current_next}, still {new_next}")


class TestSequentialBillGeneration:
    """Test that settled bills generate sequential numbers"""
    
    def test_settled_bill_gets_sequential_number(self, auth_headers):
        """Test that a settled bill gets INV-XXXXXX format"""
        # Create a settled bill
        bill_data = {
            "customer_name": "TEST Sequential Customer",
            "customer_mobile": "8888888888",
            "items": [
                {
                    "product_id": "test-product-seq",
                    "product_name": "Test Product Sequential",
                    "batch_no": "BATCH-SEQ",
                    "quantity": 1,
                    "unit_price": 10,
                    "mrp": 10,
                    "discount": 0,
                    "gst_percent": 5,
                    "line_total": 10.5
                }
            ],
            "discount": 0,
            "tax_rate": 5,
            "payment_method": "cash",
            "status": "paid",  # Settled bill
            "invoice_type": "SALE"
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create bill: {response.text}"
        
        bill = response.json()
        bill_number = bill.get("bill_number", "")
        assert bill_number.startswith("INV-"), f"Settled bill should have INV- prefix, got: {bill_number}"
        
        # Extract sequence number
        parts = bill_number.split("-")
        assert len(parts) == 2, f"Bill number should be PREFIX-NUMBER format: {bill_number}"
        
        seq_num = parts[1]
        assert seq_num.isdigit(), f"Sequence should be numeric: {seq_num}"
        
        print(f"Created settled bill: {bill_number}")
    
    def test_consecutive_bills_are_sequential(self, auth_headers):
        """Test that two consecutive bills have sequential numbers"""
        bill_numbers = []
        
        for i in range(2):
            bill_data = {
                "customer_name": f"TEST Consecutive {i}",
                "customer_mobile": f"777777777{i}",
                "items": [
                    {
                        "product_id": f"test-product-consec-{i}",
                        "product_name": f"Test Product Consecutive {i}",
                        "batch_no": f"BATCH-CONSEC-{i}",
                        "quantity": 1,
                        "unit_price": 10,
                        "mrp": 10,
                        "discount": 0,
                        "gst_percent": 5,
                        "line_total": 10.5
                    }
                ],
                "discount": 0,
                "tax_rate": 5,
                "payment_method": "cash",
                "status": "paid",
                "invoice_type": "SALE"
            }
            
            response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=auth_headers)
            assert response.status_code == 200, f"Failed to create bill {i}: {response.text}"
            bill_numbers.append(response.json().get("bill_number"))
        
        # Verify they are sequential
        num1 = int(bill_numbers[0].split("-")[1])
        num2 = int(bill_numbers[1].split("-")[1])
        
        assert num2 == num1 + 1, f"Bills should be sequential: {bill_numbers[0]} -> {bill_numbers[1]}"
        print(f"Sequential bills verified: {bill_numbers[0]} -> {bill_numbers[1]}")


class TestSalesReturnSequence:
    """Test that sales returns use RTN- prefix"""
    
    def test_sales_return_uses_rtn_prefix(self, auth_headers):
        """Test that SALES_RETURN invoice type uses RTN- prefix"""
        return_data = {
            "customer_name": "TEST Return Customer",
            "customer_mobile": "6666666666",
            "items": [
                {
                    "product_id": "test-product-return",
                    "product_name": "Test Product Return",
                    "batch_no": "BATCH-RETURN",
                    "quantity": 1,
                    "unit_price": 10,
                    "mrp": 10,
                    "discount": 0,
                    "gst_percent": 5,
                    "line_total": 10.5
                }
            ],
            "discount": 0,
            "tax_rate": 5,
            "status": "paid",
            "invoice_type": "SALES_RETURN",  # This should use RTN-
            "refund": {
                "amount": 10.5,
                "refund_method": "cash"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/bills", json=return_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create return: {response.text}"
        
        bill = response.json()
        bill_number = bill.get("bill_number", "")
        assert bill_number.startswith("RTN-"), f"Sales return should have RTN- prefix, got: {bill_number}"
        print(f"Created sales return: {bill_number}")


class TestConcurrentBillCreation:
    """Test concurrent bill creation generates unique sequential numbers"""
    
    def test_concurrent_bills_unique_numbers(self, auth_headers):
        """Test that concurrent bill creation generates unique numbers"""
        def create_bill(index):
            bill_data = {
                "customer_name": f"TEST Concurrent {index}",
                "customer_mobile": f"555555555{index}",
                "items": [
                    {
                        "product_id": f"test-product-concurrent-{index}",
                        "product_name": f"Test Product Concurrent {index}",
                        "batch_no": f"BATCH-CONC-{index}",
                        "quantity": 1,
                        "unit_price": 10,
                        "mrp": 10,
                        "discount": 0,
                        "gst_percent": 5,
                        "line_total": 10.5
                    }
                ],
                "discount": 0,
                "tax_rate": 5,
                "payment_method": "cash",
                "status": "paid",
                "invoice_type": "SALE"
            }
            
            try:
                response = requests.post(f"{BASE_URL}/api/bills", json=bill_data, headers=auth_headers)
                if response.status_code == 200:
                    return response.json().get("bill_number")
                else:
                    return f"ERROR: {response.status_code}"
            except Exception as e:
                return f"EXCEPTION: {str(e)}"
        
        # Create 5 bills concurrently using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(create_bill, i) for i in range(5)]
            bill_numbers = [f.result() for f in futures]
        
        print(f"Concurrent bills created: {bill_numbers}")
        
        # Filter out errors
        valid_bills = [b for b in bill_numbers if b and not b.startswith("ERROR") and not b.startswith("EXCEPTION")]
        
        # Check all bill numbers are unique
        unique_bills = set(valid_bills)
        assert len(unique_bills) == len(valid_bills), f"Duplicate bill numbers found: {valid_bills}"
        
        # Check they are sequential (sorted)
        if len(valid_bills) > 1:
            numbers = sorted([int(b.split("-")[1]) for b in valid_bills])
            for i in range(1, len(numbers)):
                assert numbers[i] == numbers[i-1] + 1, f"Bills should be sequential: {numbers}"
        
        print(f"All {len(valid_bills)} concurrent bills have unique sequential numbers")


class TestPreviewEndpoint:
    """Test the preview endpoint"""
    
    def test_preview_bill_number(self, auth_headers):
        """Test POST /api/settings/bill-sequence/preview"""
        preview_data = {
            "prefix": "TEST",
            "starting_number": 123,
            "sequence_length": 6,
            "allow_prefix_change": True
        }
        
        response = requests.post(f"{BASE_URL}/api/settings/bill-sequence/preview", 
                                json=preview_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "preview" in data, "Should have preview field"
        assert data["preview"] == "TEST-000123", f"Preview should be TEST-000123, got: {data['preview']}"
        assert "format" in data, "Should have format field"
        
        print(f"Preview result: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
