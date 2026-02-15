"""
Excel Bulk Upload Feature Tests
Testing the 4-step wizard: Upload, Map, Validate, Import
"""
import pytest
import requests
import os
import tempfile
import pandas as pd
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExcelBulkUploadFeature:
    """Excel Bulk Upload Feature - Backend API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_01_template_download(self):
        """Test downloading sample template"""
        response = self.session.get(f"{BASE_URL}/api/inventory/bulk-upload/template")
        assert response.status_code == 200
        assert "spreadsheetml" in response.headers.get("content-type", "").lower() or \
               "octet-stream" in response.headers.get("content-type", "").lower()
        assert len(response.content) > 0
        print("Template download: SUCCESS")
    
    def test_02_parse_excel_file(self):
        """Test parsing uploaded Excel file"""
        # Use the pre-created test file
        test_file_path = "/tmp/test_upload.xlsx"
        
        with open(test_file_path, "rb") as f:
            files = {"file": ("test_upload.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            # Remove Content-Type header for multipart
            headers = {k: v for k, v in self.session.headers.items() if k != "Content-Type"}
            response = requests.post(
                f"{BASE_URL}/api/inventory/bulk-upload/parse",
                files=files,
                headers=headers
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "job_id" in data
        assert "filename" in data
        assert "total_rows" in data
        assert "columns" in data
        assert "auto_mappings" in data
        assert "required_fields" in data
        assert "optional_fields" in data
        assert "sample_data" in data
        
        # Verify auto-mappings detected
        assert data["auto_mappings"].get("sku") == "SKU"
        assert data["auto_mappings"].get("name") == "Name"
        
        # Store job_id for subsequent tests
        self.__class__.job_id = data["job_id"]
        print(f"Parse Excel: SUCCESS - Job ID: {data['job_id']}, Rows: {data['total_rows']}")
    
    def test_03_validate_mapped_data(self):
        """Test validating mapped data"""
        if not hasattr(self.__class__, 'job_id'):
            pytest.skip("No job_id from previous test")
        
        response = self.session.post(f"{BASE_URL}/api/inventory/bulk-upload/validate", json={
            "job_id": self.__class__.job_id,
            "column_mapping": {
                "sku": "SKU",
                "name": "Name",
                "price": "MRP per Unit",
                "quantity": "Quantity",
                "expiry_date": "Expiry Date",
                "batch_number": "Batch Number",
                "brand": "Brand",
                "category": "Category",
                "cost_price": "Cost Price",
                "gst_percent": "GST %"
            }
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify validation response
        assert "job_id" in data
        assert "total_rows" in data
        assert "valid_count" in data
        assert "error_count" in data
        assert "preview_results" in data
        assert "can_import" in data
        
        # Should have valid rows to import
        assert data["can_import"] == True
        assert data["valid_count"] > 0
        
        print(f"Validate Data: SUCCESS - Valid: {data['valid_count']}, Errors: {data['error_count']}")
    
    def test_04_import_valid_data(self):
        """Test importing validated data"""
        if not hasattr(self.__class__, 'job_id'):
            pytest.skip("No job_id from previous test")
        
        response = self.session.post(f"{BASE_URL}/api/inventory/bulk-upload/import", json={
            "job_id": self.__class__.job_id,
            "import_valid_only": True
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["job_id"] == self.__class__.job_id
        assert "message" in data
        assert "total_rows" in data
        
        print(f"Import Started: SUCCESS - Total rows: {data['total_rows']}")
    
    def test_05_check_import_progress(self):
        """Test checking import progress"""
        if not hasattr(self.__class__, 'job_id'):
            pytest.skip("No job_id from previous test")
        
        import time
        time.sleep(2)  # Wait for import to complete
        
        response = self.session.get(f"{BASE_URL}/api/inventory/bulk-upload/progress/{self.__class__.job_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify progress response
        assert "job_id" in data
        assert "status" in data
        assert "import_progress" in data
        
        # Check import progress details
        progress = data["import_progress"]
        assert "total" in progress
        assert "processed" in progress
        assert "success" in progress
        assert "failed" in progress
        
        print(f"Import Progress: SUCCESS - Status: {data['status']}, Processed: {progress['processed']}/{progress['total']}")
    
    def test_06_download_error_report(self):
        """Test downloading error report"""
        if not hasattr(self.__class__, 'job_id'):
            pytest.skip("No job_id from previous test")
        
        response = self.session.get(f"{BASE_URL}/api/inventory/bulk-upload/error-report/{self.__class__.job_id}")
        
        assert response.status_code == 200
        assert len(response.content) > 0
        
        print("Error Report Download: SUCCESS")
    
    def test_07_invalid_job_id_handling(self):
        """Test error handling for invalid job ID"""
        # Test progress with invalid job ID
        response = self.session.get(f"{BASE_URL}/api/inventory/bulk-upload/progress/invalid-job-id")
        assert response.status_code == 404
        
        # Test validate with invalid job ID
        response = self.session.post(f"{BASE_URL}/api/inventory/bulk-upload/validate", json={
            "job_id": "invalid-job-id",
            "column_mapping": {"sku": "SKU"}
        })
        assert response.status_code == 404
        
        # Test import with invalid job ID
        response = self.session.post(f"{BASE_URL}/api/inventory/bulk-upload/import", json={
            "job_id": "invalid-job-id",
            "import_valid_only": True
        })
        assert response.status_code == 404
        
        print("Invalid Job ID Handling: SUCCESS")
    
    def test_08_missing_required_field_validation(self):
        """Test validation fails when required fields missing in mapping"""
        # First create a new job
        test_file_path = "/tmp/test_upload.xlsx"
        
        with open(test_file_path, "rb") as f:
            files = {"file": ("test_upload.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            headers = {k: v for k, v in self.session.headers.items() if k != "Content-Type"}
            response = requests.post(
                f"{BASE_URL}/api/inventory/bulk-upload/parse",
                files=files,
                headers=headers
            )
        
        assert response.status_code == 200
        job_id = response.json()["job_id"]
        
        # Try to validate with incomplete mapping (missing required fields)
        response = self.session.post(f"{BASE_URL}/api/inventory/bulk-upload/validate", json={
            "job_id": job_id,
            "column_mapping": {
                "sku": "SKU",
                "name": "Name"
                # Missing: price, quantity, expiry_date, batch_number
            }
        })
        
        # Should return 400 or validation error
        if response.status_code == 200:
            data = response.json()
            # If 200, check that error_count is high
            assert data.get("error_count", 0) > 0 or data.get("can_import") == False
        else:
            assert response.status_code in [400, 422]
        
        print("Missing Required Field Validation: SUCCESS")


class TestExcelUploadEndpointAuth:
    """Test authentication requirements for Excel upload endpoints"""
    
    def test_template_requires_auth(self):
        """Template endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inventory/bulk-upload/template")
        assert response.status_code == 401
        print("Template Auth Check: SUCCESS")
    
    def test_parse_requires_auth(self):
        """Parse endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/inventory/bulk-upload/parse")
        assert response.status_code == 401
        print("Parse Auth Check: SUCCESS")
    
    def test_validate_requires_auth(self):
        """Validate endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/inventory/bulk-upload/validate", json={})
        assert response.status_code == 401
        print("Validate Auth Check: SUCCESS")
    
    def test_import_requires_auth(self):
        """Import endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/inventory/bulk-upload/import", json={})
        assert response.status_code == 401
        print("Import Auth Check: SUCCESS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
