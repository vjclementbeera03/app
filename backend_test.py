import requests
import sys
import json
from datetime import datetime

class ThuGoZiAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def test_api_health(self):
        """Test basic API connectivity"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Message: {data.get('message', 'No message')}"
            self.log_test("API Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("API Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_admin_login(self):
        """Test admin login functionality"""
        try:
            response = requests.post(f"{self.api_url}/admin/login", 
                json={"username": "admin", "password": "admin@123"}, 
                timeout=10)
            
            success = response.status_code == 200
            if success:
                data = response.json()
                self.admin_token = data.get('token')
                details = "Login successful, token received"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:100]}"
            
            self.log_test("Admin Login", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Login", False, f"Error: {str(e)}")
            return False

    def test_settings_endpoints(self):
        """Test settings endpoints (public and admin)"""
        # Test public settings endpoint
        try:
            response = requests.get(f"{self.api_url}/settings", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                required_fields = ['shop_name', 'shop_latitude', 'shop_longitude', 'delivery_charge']
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    details = f"All required fields present. Shop: {data.get('shop_name')}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("GET /api/settings (public)", success, details)
        except Exception as e:
            self.log_test("GET /api/settings (public)", False, f"Error: {str(e)}")

        # Test admin settings update (requires admin token)
        if self.admin_token:
            try:
                headers = {"Authorization": f"Bearer {self.admin_token}"}
                test_settings = {
                    "delivery_charge": 50.0,
                    "delivery_radius_km": 2.0,
                    "shop_name": "Thu.Go.Zi – Food on Truck",
                    "shop_tagline": "Fresh food delivered from our food truck",
                    "shop_latitude": 28.6139,
                    "shop_longitude": 77.2090,
                    "shop_address": "Connaught Place, New Delhi, India",
                    "payment_info": "Cash on Delivery only",
                    "weekly_off_day": 1
                }
                
                response = requests.put(f"{self.api_url}/admin/settings", 
                    json=test_settings, headers=headers, timeout=10)
                
                success = response.status_code == 200
                details = f"Status: {response.status_code}"
                if success:
                    details += ", Settings updated successfully"
                
                self.log_test("PUT /api/admin/settings", success, details)
            except Exception as e:
                self.log_test("PUT /api/admin/settings", False, f"Error: {str(e)}")

    def test_menu_endpoints(self):
        """Test menu-related endpoints"""
        try:
            response = requests.get(f"{self.api_url}/menu", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                details = f"Menu items count: {len(data)}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("GET /api/menu", success, details)
        except Exception as e:
            self.log_test("GET /api/menu", False, f"Error: {str(e)}")

    def test_location_validation(self):
        """Test location validation endpoint"""
        try:
            test_location = {
                "latitude": 28.6139,  # Near Connaught Place
                "longitude": 77.2090
            }
            
            response = requests.post(f"{self.api_url}/validate-location", 
                json=test_location, timeout=10)
            
            success = response.status_code == 200
            if success:
                data = response.json()
                details = f"Within radius: {data.get('within_radius')}, Distance: {data.get('distance_km')}km"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("POST /api/validate-location", success, details)
        except Exception as e:
            self.log_test("POST /api/validate-location", False, f"Error: {str(e)}")

    def test_shop_status(self):
        """Test shop status endpoint"""
        try:
            response = requests.get(f"{self.api_url}/shop/status", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                details = f"Shop open: {data.get('is_open')}, Message: {data.get('message')}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("GET /api/shop/status", success, details)
        except Exception as e:
            self.log_test("GET /api/shop/status", False, f"Error: {str(e)}")

    def test_about_endpoint(self):
        """Test about page endpoint"""
        try:
            response = requests.get(f"{self.api_url}/about", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                details = f"Title: {data.get('title', 'No title')[:50]}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("GET /api/about", success, details)
        except Exception as e:
            self.log_test("GET /api/about", False, f"Error: {str(e)}")

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        if not self.admin_token:
            self.log_test("GET /api/admin/dashboard", False, "No admin token available")
            return

        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{self.api_url}/admin/dashboard", 
                headers=headers, timeout=10)
            
            success = response.status_code == 200
            if success:
                data = response.json()
                details = f"Users: {data.get('total_users')}, Orders today: {data.get('orders_today')}"
            else:
                details = f"Status: {response.status_code}"
            
            self.log_test("GET /api/admin/dashboard", success, details)
        except Exception as e:
            self.log_test("GET /api/admin/dashboard", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Thu.Go.Zi Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test basic connectivity first
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Test admin login
        self.test_admin_login()
        
        # Test public endpoints
        self.test_settings_endpoints()
        self.test_menu_endpoints()
        self.test_location_validation()
        self.test_shop_status()
        self.test_about_endpoint()
        
        # Test admin endpoints
        self.test_admin_dashboard()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            failed_tests = [r for r in self.test_results if not r['success']]
            print(f"❌ {len(failed_tests)} tests failed:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['details']}")
            return False
def main():
    tester = ThuGoZiAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_api_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': f"{tester.tests_passed}/{tester.tests_run}",
                'overall_success': success
            },
            'test_results': tester.test_results,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())