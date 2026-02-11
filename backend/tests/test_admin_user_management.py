"""
Backend API Tests for Admin User Management
Tests: Admin login, user listing (students/non-students), user deletion, dashboard stats
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "admin",
            "password": "admin@123"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned in response"
        assert len(data["token"]) > 0, "Token is empty"
        print(f"✓ Admin login successful, token received")
        return data["token"]
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected")


class TestAdminDashboard:
    """Admin dashboard stats tests"""
    
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
    
    def test_dashboard_stats(self, admin_token):
        """Test GET /api/admin/dashboard returns stats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify all required stats fields exist
        assert "total_users" in data, "total_users missing from dashboard stats"
        assert "active_users" in data, "active_users missing from dashboard stats"
        assert "orders_today" in data, "orders_today missing from dashboard stats"
        assert "points_issued" in data, "points_issued missing from dashboard stats"
        
        # Verify data types
        assert isinstance(data["total_users"], int), "total_users should be integer"
        assert isinstance(data["active_users"], int), "active_users should be integer"
        assert isinstance(data["orders_today"], int), "orders_today should be integer"
        assert isinstance(data["points_issued"], int), "points_issued should be integer"
        
        print(f"✓ Dashboard stats: total_users={data['total_users']}, active_users={data['active_users']}, orders_today={data['orders_today']}, points_issued={data['points_issued']}")
    
    def test_dashboard_unauthorized(self):
        """Test dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Dashboard correctly requires authentication")


class TestAdminUserListing:
    """Admin user listing tests - students and non-students"""
    
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
    
    def test_get_all_users(self, admin_token):
        """Test GET /api/admin/users returns all users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/admin/users returned {len(data)} users")
        return data
    
    def test_get_student_users(self, admin_token):
        """Test GET /api/admin/users/students returns only student users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users/students", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify all returned users are students
        for user in data:
            assert user.get("is_student") == True, f"Non-student user found in students list: {user.get('id')}"
        
        print(f"✓ GET /api/admin/users/students returned {len(data)} student users")
        return data
    
    def test_get_non_student_users(self, admin_token):
        """Test GET /api/admin/users/non-students returns only non-student users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users/non-students", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify all returned users are non-students (is_student=False, None, or not exists)
        for user in data:
            is_student = user.get("is_student")
            assert is_student in [False, None] or "is_student" not in user, f"Student user found in non-students list: {user.get('id')}"
        
        print(f"✓ GET /api/admin/users/non-students returned {len(data)} non-student users")
        return data
    
    def test_user_counts_match(self, admin_token):
        """Verify student + non-student counts equal total users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        all_users_resp = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        students_resp = requests.get(f"{BASE_URL}/api/admin/users/students", headers=headers)
        non_students_resp = requests.get(f"{BASE_URL}/api/admin/users/non-students", headers=headers)
        
        all_users = all_users_resp.json()
        students = students_resp.json()
        non_students = non_students_resp.json()
        
        total = len(all_users)
        student_count = len(students)
        non_student_count = len(non_students)
        
        assert student_count + non_student_count == total, \
            f"User counts don't match: {student_count} students + {non_student_count} non-students != {total} total"
        
        print(f"✓ User counts match: {student_count} students + {non_student_count} non-students = {total} total")
    
    def test_user_data_structure(self, admin_token):
        """Verify user data structure has required fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        data = response.json()
        
        if len(data) > 0:
            user = data[0]
            required_fields = ["id", "phone_number", "name", "created_at"]
            for field in required_fields:
                assert field in user, f"Required field '{field}' missing from user data"
            print(f"✓ User data structure verified with required fields")
        else:
            print("⚠ No users found to verify structure")


class TestAdminUserDeletion:
    """Admin user deletion tests"""
    
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
    
    def test_delete_nonexistent_user(self, admin_token):
        """Test deleting a non-existent user returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        fake_user_id = str(uuid.uuid4())
        
        response = requests.delete(f"{BASE_URL}/api/admin/users/{fake_user_id}", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Delete non-existent user correctly returns 404")
    
    def test_delete_user_unauthorized(self):
        """Test delete user requires authentication"""
        fake_user_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/admin/users/{fake_user_id}")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Delete user correctly requires authentication")
    
    def test_create_and_delete_user(self, admin_token):
        """Test creating a user via registration and then deleting via admin"""
        # First, create a test user via OTP flow
        test_phone = f"+1555{str(uuid.uuid4())[:7].replace('-', '')}"
        
        # Send OTP (mock mode)
        otp_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "phone_number": test_phone
        })
        
        if otp_response.status_code != 200:
            pytest.skip(f"OTP send failed: {otp_response.text}")
        
        otp_data = otp_response.json()
        # Extract mock OTP from response
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
        
        # Register new user
        if verify_data.get("is_new_user"):
            register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "phone_number": test_phone,
                "name": "TEST_DeleteUser"
            })
            
            if register_response.status_code != 200:
                pytest.skip(f"Registration failed: {register_response.text}")
            
            user_data = register_response.json()
            user_id = user_data["user"]["id"]
        else:
            user_id = verify_data["user"]["id"]
        
        # Now delete the user via admin
        headers = {"Authorization": f"Bearer {admin_token}"}
        delete_response = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=headers)
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify user is deleted by trying to get them
        all_users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        all_users = all_users_response.json()
        user_ids = [u["id"] for u in all_users]
        
        assert user_id not in user_ids, "User still exists after deletion"
        print(f"✓ User created and deleted successfully")


class TestAdminVerifications:
    """Admin verification approval/rejection tests"""
    
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
    
    def test_get_pending_verifications(self, admin_token):
        """Test GET /api/admin/verifications/pending"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/pending", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/admin/verifications/pending returned {len(data)} pending verifications")
    
    def test_approve_nonexistent_verification(self, admin_token):
        """Test approving non-existent verification returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        fake_id = str(uuid.uuid4())
        
        response = requests.post(f"{BASE_URL}/api/admin/verifications/approve/{fake_id}", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Approve non-existent verification correctly returns 404")
    
    def test_reject_nonexistent_verification(self, admin_token):
        """Test rejecting non-existent verification returns 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        fake_id = str(uuid.uuid4())
        
        response = requests.post(f"{BASE_URL}/api/admin/verifications/reject/{fake_id}", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Reject non-existent verification correctly returns 404")


class TestAdminLogout:
    """Admin logout tests - Note: JWT tokens don't have server-side logout, 
    client just removes token"""
    
    def test_admin_token_expiry_check(self):
        """Test that invalid token is rejected"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Invalid token correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
