"""
Backend API Tests for Order Management and Coupon System
Tests: Order status updates, Coupon CRUD, Coupon validation, Order enrichment
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAdminCoupons:
    """Admin coupon management tests - Create, List, Delete"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "admin",
            "password": "admin@123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_get_all_coupons(self, admin_token):
        """Test GET /api/admin/coupons returns all coupons"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/coupons", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/admin/coupons returned {len(data)} coupons")
        return data
    
    def test_create_coupon_flat(self, admin_token):
        """Test POST /api/admin/coupons - create flat discount coupon"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a unique coupon code
        coupon_code = f"TEST_FLAT_{uuid.uuid4().hex[:6].upper()}"
        expiry_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        coupon_data = {
            "code": coupon_code,
            "type": "flat",
            "value": 50.0,
            "min_order": 200.0,
            "expiry_date": expiry_date,
            "usage_limit": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/coupons", json=coupon_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Coupon ID not returned"
        assert data["code"] == coupon_code, "Coupon code mismatch"
        assert data["type"] == "flat", "Coupon type mismatch"
        assert data["value"] == 50.0, "Coupon value mismatch"
        assert data["min_order"] == 200.0, "Min order mismatch"
        assert data["usage_limit"] == 100, "Usage limit mismatch"
        assert data["used_count"] == 0, "Used count should be 0"
        assert data["active"] == True, "Coupon should be active"
        
        print(f"✓ Created flat coupon: {coupon_code} - ₹50 OFF")
        return data
    
    def test_create_coupon_percentage(self, admin_token):
        """Test POST /api/admin/coupons - create percentage discount coupon"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        coupon_code = f"TEST_PCT_{uuid.uuid4().hex[:6].upper()}"
        expiry_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        coupon_data = {
            "code": coupon_code,
            "type": "percentage",
            "value": 15.0,
            "min_order": 100.0,
            "expiry_date": expiry_date,
            "usage_limit": 50
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/coupons", json=coupon_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["type"] == "percentage", "Coupon type should be percentage"
        assert data["value"] == 15.0, "Coupon value should be 15%"
        
        print(f"✓ Created percentage coupon: {coupon_code} - 15% OFF")
        return data
    
    def test_delete_coupon(self, admin_token):
        """Test DELETE /api/admin/coupons/{coupon_id}"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a coupon to delete
        coupon_code = f"TEST_DEL_{uuid.uuid4().hex[:6].upper()}"
        expiry_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        create_response = requests.post(f"{BASE_URL}/api/admin/coupons", json={
            "code": coupon_code,
            "type": "flat",
            "value": 10.0,
            "min_order": 0,
            "expiry_date": expiry_date,
            "usage_limit": 10
        }, headers=headers)
        
        assert create_response.status_code == 200, f"Failed to create coupon: {create_response.text}"
        coupon_id = create_response.json()["id"]
        
        # Now delete it
        delete_response = requests.delete(f"{BASE_URL}/api/admin/coupons/{coupon_id}", headers=headers)
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify it's deleted by checking the list
        list_response = requests.get(f"{BASE_URL}/api/admin/coupons", headers=headers)
        coupons = list_response.json()
        coupon_ids = [c["id"] for c in coupons]
        
        assert coupon_id not in coupon_ids, "Coupon still exists after deletion"
        print(f"✓ Coupon {coupon_code} deleted successfully")
    
    def test_delete_nonexistent_coupon(self, admin_token):
        """Test DELETE /api/admin/coupons/{coupon_id} with non-existent ID"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        fake_id = str(uuid.uuid4())
        
        response = requests.delete(f"{BASE_URL}/api/admin/coupons/{fake_id}", headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Delete non-existent coupon correctly returns 404")
    
    def test_coupons_require_auth(self):
        """Test coupon endpoints require authentication"""
        # GET coupons without auth
        response = requests.get(f"{BASE_URL}/api/admin/coupons")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        # POST coupon without auth
        response = requests.post(f"{BASE_URL}/api/admin/coupons", json={
            "code": "TEST",
            "type": "flat",
            "value": 10,
            "min_order": 0,
            "expiry_date": "2025-12-31",
            "usage_limit": 10
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print(f"✓ Coupon endpoints correctly require authentication")


class TestCouponValidation:
    """Public coupon validation endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "admin",
            "password": "admin@123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_validate_valid_coupon(self, admin_token):
        """Test GET /api/coupons/validate/{code} with valid coupon"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a test coupon
        coupon_code = f"VALID_{uuid.uuid4().hex[:6].upper()}"
        expiry_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        create_response = requests.post(f"{BASE_URL}/api/admin/coupons", json={
            "code": coupon_code,
            "type": "flat",
            "value": 25.0,
            "min_order": 100.0,
            "expiry_date": expiry_date,
            "usage_limit": 50
        }, headers=headers)
        
        assert create_response.status_code == 200, f"Failed to create coupon: {create_response.text}"
        
        # Validate the coupon (public endpoint)
        validate_response = requests.get(f"{BASE_URL}/api/coupons/validate/{coupon_code}")
        
        assert validate_response.status_code == 200, f"Expected 200, got {validate_response.status_code}: {validate_response.text}"
        data = validate_response.json()
        
        assert data["code"] == coupon_code, "Coupon code mismatch"
        assert data["type"] == "flat", "Coupon type mismatch"
        assert data["value"] == 25.0, "Coupon value mismatch"
        
        print(f"✓ Coupon {coupon_code} validated successfully")
        
        # Cleanup
        coupon_id = create_response.json()["id"]
        requests.delete(f"{BASE_URL}/api/admin/coupons/{coupon_id}", headers=headers)
    
    def test_validate_invalid_coupon(self):
        """Test GET /api/coupons/validate/{code} with invalid coupon"""
        response = requests.get(f"{BASE_URL}/api/coupons/validate/INVALID_CODE_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Invalid coupon correctly returns 404")


class TestAdminOrders:
    """Admin order management tests - List, Status Update"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "admin",
            "password": "admin@123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_get_all_orders(self, admin_token):
        """Test GET /api/admin/orders returns all orders with enriched data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are orders, verify enrichment
        if len(data) > 0:
            order = data[0]
            assert "id" in order, "Order ID missing"
            assert "user_id" in order, "User ID missing"
            assert "items" in order, "Items missing"
            assert "status" in order, "Status missing"
            assert "user_name" in order, "User name enrichment missing"
            assert "user_phone" in order, "User phone enrichment missing"
            
            # Check items have names
            if len(order["items"]) > 0:
                item = order["items"][0]
                assert "name" in item, "Item name enrichment missing"
            
            print(f"✓ Order enrichment verified - user_name: {order['user_name']}")
        
        print(f"✓ GET /api/admin/orders returned {len(data)} orders")
        return data
    
    def test_orders_require_auth(self):
        """Test orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Orders endpoint correctly requires authentication")


class TestOrderStatusUpdate:
    """Order status update tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "admin",
            "password": "admin@123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def user_token(self):
        """Create a test user and get token"""
        test_phone = f"+1555{str(uuid.uuid4())[:7].replace('-', '')}"
        
        # Send OTP
        otp_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "phone_number": test_phone
        })
        
        if otp_response.status_code != 200:
            pytest.skip(f"OTP send failed: {otp_response.text}")
        
        otp_data = otp_response.json()
        mock_otp = None
        if "message" in otp_data and "Mock OTP:" in otp_data["message"]:
            mock_otp = otp_data["message"].split("Mock OTP:")[1].strip()
        
        if not mock_otp:
            pytest.skip("Could not get mock OTP")
        
        # Verify OTP
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone_number": test_phone,
            "otp_code": mock_otp
        })
        
        if verify_response.status_code != 200:
            pytest.skip(f"OTP verify failed: {verify_response.text}")
        
        verify_data = verify_response.json()
        
        # Register if new user
        if verify_data.get("is_new_user"):
            register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "phone_number": test_phone,
                "name": "TEST_OrderUser"
            })
            
            if register_response.status_code != 200:
                pytest.skip(f"Registration failed: {register_response.text}")
            
            return register_response.json()["token"], register_response.json()["user"]["id"]
        else:
            return verify_data["token"], verify_data["user"]["id"]
    
    def test_update_order_status_valid_statuses(self, admin_token):
        """Test PUT /api/admin/orders/{order_id}/status with all valid statuses"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing orders
        orders_response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders available to test status update")
        
        order_id = orders[0]["id"]
        original_status = orders[0]["status"]
        
        # Test all valid statuses
        valid_statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']
        
        for status in valid_statuses:
            response = requests.put(
                f"{BASE_URL}/api/admin/orders/{order_id}/status?status={status}",
                headers=headers
            )
            
            assert response.status_code == 200, f"Failed to update to {status}: {response.text}"
            print(f"  ✓ Status updated to: {status}")
        
        # Restore original status
        requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}/status?status={original_status}",
            headers=headers
        )
        
        print(f"✓ All valid order statuses tested successfully")
    
    def test_update_order_status_invalid(self, admin_token):
        """Test PUT /api/admin/orders/{order_id}/status with invalid status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing orders
        orders_response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders available to test")
        
        order_id = orders[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}/status?status=invalid_status",
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Invalid status correctly rejected")
    
    def test_update_nonexistent_order_status(self, admin_token):
        """Test PUT /api/admin/orders/{order_id}/status with non-existent order"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        fake_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/admin/orders/{fake_id}/status?status=confirmed",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent order correctly returns 404")
    
    def test_order_status_requires_auth(self):
        """Test order status update requires authentication"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/admin/orders/{fake_id}/status?status=confirmed")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Order status update correctly requires authentication")


class TestUserOrders:
    """User order history tests"""
    
    @pytest.fixture
    def user_token(self):
        """Create a test user and get token"""
        test_phone = f"+1555{str(uuid.uuid4())[:7].replace('-', '')}"
        
        # Send OTP
        otp_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "phone_number": test_phone
        })
        
        if otp_response.status_code != 200:
            pytest.skip(f"OTP send failed: {otp_response.text}")
        
        otp_data = otp_response.json()
        mock_otp = None
        if "message" in otp_data and "Mock OTP:" in otp_data["message"]:
            mock_otp = otp_data["message"].split("Mock OTP:")[1].strip()
        
        if not mock_otp:
            pytest.skip("Could not get mock OTP")
        
        # Verify OTP
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone_number": test_phone,
            "otp_code": mock_otp
        })
        
        if verify_response.status_code != 200:
            pytest.skip(f"OTP verify failed: {verify_response.text}")
        
        verify_data = verify_response.json()
        
        # Register if new user
        if verify_data.get("is_new_user"):
            register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "phone_number": test_phone,
                "name": "TEST_OrderHistoryUser"
            })
            
            if register_response.status_code != 200:
                pytest.skip(f"Registration failed: {register_response.text}")
            
            return register_response.json()["token"]
        else:
            return verify_data["token"]
    
    def test_get_my_orders(self, user_token):
        """Test GET /api/orders/my-orders returns user's orders with enriched items"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/orders/my-orders", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are orders, verify enrichment
        if len(data) > 0:
            order = data[0]
            assert "items" in order, "Items missing"
            
            if len(order["items"]) > 0:
                item = order["items"][0]
                assert "name" in item, "Item name enrichment missing"
        
        print(f"✓ GET /api/orders/my-orders returned {len(data)} orders")
    
    def test_my_orders_requires_auth(self):
        """Test my-orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orders/my-orders")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ My orders endpoint correctly requires authentication")


class TestLoyaltyExpiryScheduler:
    """Loyalty expiry background scheduler tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "admin",
            "password": "admin@123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_manual_expiry_check(self, admin_token):
        """Test POST /api/admin/loyalty/check-expiry triggers manual check"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/admin/loyalty/check-expiry", json={}, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain message"
        
        print(f"✓ Manual loyalty expiry check triggered successfully")
    
    def test_get_expiry_logs(self, admin_token):
        """Test GET /api/admin/loyalty/expiry-logs returns logs"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/loyalty/expiry-logs?limit=20", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/admin/loyalty/expiry-logs returned {len(data)} logs")
    
    def test_expiry_check_requires_auth(self):
        """Test expiry check endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/loyalty/check-expiry", json={})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Expiry check endpoint correctly requires authentication")


# Cleanup test coupons after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_coupons():
    """Cleanup TEST_ prefixed coupons after all tests"""
    yield
    
    # Login as admin
    response = requests.post(f"{BASE_URL}/api/admin/login", json={
        "username": "admin",
        "password": "admin@123"
    })
    
    if response.status_code == 200:
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all coupons
        coupons_response = requests.get(f"{BASE_URL}/api/admin/coupons", headers=headers)
        if coupons_response.status_code == 200:
            coupons = coupons_response.json()
            
            # Delete TEST_ prefixed coupons
            for coupon in coupons:
                if coupon["code"].startswith("TEST_") or coupon["code"].startswith("VALID_"):
                    requests.delete(f"{BASE_URL}/api/admin/coupons/{coupon['id']}", headers=headers)
                    print(f"Cleaned up test coupon: {coupon['code']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
