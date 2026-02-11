from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Header, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import random
import math
import re
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
import io
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize Firebase Admin SDK
firebase_admin_path = os.environ.get('FIREBASE_ADMIN_SDK_PATH', str(ROOT_DIR / 'firebase-admin.json'))
if os.path.exists(firebase_admin_path) and not firebase_admin._apps:
    cred = credentials.Certificate(firebase_admin_path)
    firebase_admin.initialize_app(cred)
    logging.info("Firebase Admin SDK initialized")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client_db = AsyncIOMotorClient(mongo_url)
db = client_db[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Twilio setup (optional - Firebase Phone Auth is preferred)
VERIFY_SERVICE_SID = os.environ.get('TWILIO_VERIFY_SERVICE')
twilio_client = None
try:
    from twilio.rest import Client as TwilioClient
    if os.environ.get('TWILIO_ACCOUNT_SID') and os.environ.get('TWILIO_AUTH_TOKEN'):
        twilio_client = TwilioClient(os.environ.get('TWILIO_ACCOUNT_SID'), os.environ.get('TWILIO_AUTH_TOKEN'))
except ImportError:
    pass

# Google Vision setup - Use dedicated Vision API key
GOOGLE_VISION_API_KEY = os.environ.get('GOOGLE_VISION_API_KEY')
if not GOOGLE_VISION_API_KEY:
    logging.warning("GOOGLE_VISION_API_KEY not set - OCR will not work")

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class SendOTPRequest(BaseModel):
    phone_number: str

class VerifyOTPRequest(BaseModel):
    phone_number: str
    otp_code: str

class FirebaseAuthRequest(BaseModel):
    firebase_token: str
    name: Optional[str] = None

class RegisterRequest(BaseModel):
    phone_number: str
    name: str

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    phone_number: str
    name: str
    college: str
    dob: Optional[str] = None  # Date of birth in YYYY-MM-DD format
    verification_status: str = "not_started"  # not_started, pending, approved, rejected
    is_student: bool = False  # True if opted for loyalty
    loyalty_active: bool = False  # Auto-disabled when turns 24
    points: int = 0
    last_visit: Optional[str] = None
    created_at: str
    rejection_reason: Optional[str] = None

class MenuItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    price: float
    category: str
    veg: bool
    prep_time: int  # in minutes
    available: bool = True
    image_url: Optional[str] = None
    description: Optional[str] = None
    is_manual_override: bool = False  # True if manually edited, overrides PDF

class MenuPDF(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    filename: str
    uploaded_at: str
    file_path: str
    active: bool = True

class CreateMenuItem(BaseModel):
    name: str
    price: float
    category: str
    veg: bool
    prep_time: int
    image_url: Optional[str] = None

class OrderItem(BaseModel):
    menu_item_id: str
    quantity: int
    price: float

class CreateOrder(BaseModel):
    items: List[OrderItem]
    delivery_address: str
    latitude: float
    longitude: float
    coupon_code: Optional[str] = None

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    items: List[OrderItem]
    total_amount: float
    delivery_fee: float
    discount: float = 0
    final_amount: float
    delivery_address: str
    status: str = "pending"  # pending, confirmed, preparing, out_for_delivery, delivered
    created_at: str

class Coupon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    code: str
    type: str  # flat or percentage
    value: float
    min_order: float = 0
    expiry_date: str
    usage_limit: int
    used_count: int = 0
    active: bool = True

class CreateCoupon(BaseModel):
    code: str
    type: str
    value: float
    min_order: float = 0
    expiry_date: str
    usage_limit: int

class LoyaltyBill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    bill_number: str
    amount: float
    points_earned: int
    date: str
    status: str = "pending"  # pending, approved, rejected
    image_url: Optional[str] = None

class AboutContent(BaseModel):
    title: str
    content: str

class Settings(BaseModel):
    delivery_charge: float
    delivery_radius_km: float = 2.0
    shop_name: str
    shop_tagline: str
    shop_latitude: float
    shop_longitude: float
    shop_address: str
    payment_info: str = "Cash on Delivery only"
    weekly_off_day: int = 1  # 0=Monday, 1=Tuesday, etc.

class LocationValidation(BaseModel):
    latitude: float
    longitude: float

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminChangePassword(BaseModel):
    current_password: str
    new_password: str

class ApplyStudentLoyaltyRequest(BaseModel):
    college: str
    dob: str  # YYYY-MM-DD format

class AdminVerificationAction(BaseModel):
    action: str  # approve or reject
    reason: Optional[str] = None  # Required for rejection

class AdminChangeUsername(BaseModel):
    new_username: str
    password: str  # Require password for security

# ==================== HELPER FUNCTIONS ====================

def create_jwt_token(user_id: str, role: str = "user") -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        role = payload.get("role")
        if role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid admin token")

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula (in km)"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def is_shop_open() -> tuple[bool, str]:
    """Check if shop is open. Tuesday is weekly closed."""
    now = datetime.now(timezone.utc)
    day_of_week = now.weekday()  # 0=Monday, 1=Tuesday, etc.
    
    if day_of_week == 1:  # Tuesday
        return False, "Closed (Weekly Off - Tuesday)"
    
    # Check admin closed days from settings
    # For MVP, assuming shop is open other days
    return True, "Open Now"

def calculate_age_from_dob(dob_str: str) -> int:
    """Calculate current age from date of birth"""
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d")
        today = datetime.now()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age
    except:
        return 0

def is_loyalty_eligible(dob_str: str) -> bool:
    """Check if user is eligible for loyalty based on DOB (17-23 years)"""
    age = calculate_age_from_dob(dob_str)
    return 17 <= age <= 23

async def check_and_update_loyalty_status(user_id: str):
    """Automatically disable loyalty if user turns 24"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get('dob') or not user.get('is_student'):
        return
    
    if not is_loyalty_eligible(user['dob']):
        # User has aged out - disable loyalty
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"loyalty_active": False}}
        )
        logging.info(f"User {user_id} loyalty disabled - aged out")

async def extract_text_from_image(image_bytes: bytes) -> str:
    """Extract text from image using Google Cloud Vision API"""
    import base64
    import httpx
    
    try:
        # Encode image to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Use Google Vision REST API with dedicated key
        api_key = GOOGLE_VISION_API_KEY
        if not api_key:
            logging.error("GOOGLE_VISION_API_KEY not configured")
            return ""
        
        url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
        
        payload = {
            "requests": [{
                "image": {"content": image_base64},
                "features": [{"type": "TEXT_DETECTION"}]
            }]
        }
        
        logging.info("Calling Google Vision API for OCR...")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload)
        
        logging.info(f"Vision API response status: {response.status_code}")
        
        if response.status_code != 200:
            logging.error(f"Vision API error: {response.status_code} - {response.text}")
            return ""
        
        result = response.json()
        
        # Check for API errors in response
        if 'error' in result:
            logging.error(f"Vision API returned error: {result['error']}")
            return ""
        
        # Extract text from response
        if 'responses' in result and result['responses']:
            response_data = result['responses'][0]
            
            # Check for errors in individual response
            if 'error' in response_data:
                logging.error(f"Vision API response error: {response_data['error']}")
                return ""
            
            annotations = response_data.get('textAnnotations', [])
            if annotations:
                extracted_text = annotations[0].get('description', '')
                logging.info(f"OCR extracted {len(extracted_text)} characters")
                return extracted_text
        
        logging.info("No text found in image")
        return ""
        
    except Exception as e:
        logging.error(f"OCR Error: {str(e)}")
        return ""

def extract_age_from_text(text: str) -> Optional[int]:
    """Extract age from student ID text"""
    # Look for date of birth patterns
    dob_patterns = [
        r'DOB[:\s]*(\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2}))',
        r'Date of Birth[:\s]*(\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2}))',
        r'Born[:\s]*(\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2}))',
        r'(\d{1,2}[-/]\d{1,2}[-/](\d{4}))'
    ]
    
    for pattern in dob_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            dob_str = match.group(1)
            try:
                # Try different date formats
                for fmt in ['%d-%m-%Y', '%d/%m/%Y', '%m-%d-%Y', '%m/%d/%Y']:
                    try:
                        dob = datetime.strptime(dob_str, fmt)
                        age = (datetime.now() - dob).days // 365
                        if 15 <= age <= 30:  # Sanity check
                            return age
                    except:
                        continue
            except:
                pass
    
    # Look for age directly
    age_pattern = r'Age[:\s]*(\d{2})'
    match = re.search(age_pattern, text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    
    return None

def extract_dob_from_text(text: str) -> Optional[str]:
    """Extract date of birth from student ID text, return in YYYY-MM-DD format"""
    dob_patterns = [
        r'DOB[:\s]*(\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2}))',
        r'Date of Birth[:\s]*(\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2}))',
        r'Born[:\s]*(\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2}))',
        r'(\d{1,2}[-/]\d{1,2}[-/](\d{4}))'
    ]
    
    for pattern in dob_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            dob_str = match.group(1)
            try:
                # Try different date formats
                for fmt in ['%d-%m-%Y', '%d/%m/%Y', '%m-%d-%Y', '%m/%d/%Y', '%d-%m-%y', '%d/%m/%y']:
                    try:
                        dob = datetime.strptime(dob_str, fmt)
                        # Return in standard format
                        return dob.strftime('%Y-%m-%d')
                    except:
                        continue
            except:
                pass
    
    return None

def extract_bill_info(text: str) -> tuple[Optional[str], Optional[float]]:
    """Extract bill number and amount from bill text"""
    bill_number = None
    amount = None
    
    # Extract bill number
    bill_patterns = [
        r'Bill[\s#:No]*(\d{6,})',
        r'Receipt[\s#:No]*(\d{6,})',
        r'Invoice[\s#:No]*(\d{6,})'
    ]
    for pattern in bill_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            bill_number = match.group(1)
            break
    
    # Extract total amount
    amount_patterns = [
        r'Total[:\s]*Rs?\.?\s*(\d+\.?\d*)',
        r'Total[:\s]*₹\s*(\d+\.?\d*)',
        r'Amount[:\s]*Rs?\.?\s*(\d+\.?\d*)',
        r'Grand Total[:\s]*Rs?\.?\s*(\d+\.?\d*)'
    ]
    for pattern in amount_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount = float(match.group(1))
            break
    
    return bill_number, amount

async def calculate_loyalty_points(user_id: str, amount: float, bill_date: str) -> int:
    """Calculate loyalty points based on amount and rules - only for eligible students"""
    # Get user and check loyalty eligibility
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is a student with active loyalty
    if not user.get('is_student') or not user.get('loyalty_active'):
        raise HTTPException(status_code=403, detail="Loyalty program not active for this account")
    
    # Automatically check and update loyalty status based on age
    await check_and_update_loyalty_status(user_id)
    
    # Re-check after update
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user.get('loyalty_active'):
        raise HTTPException(status_code=403, detail="You have aged out of the student loyalty program")
    
    # Check if user already uploaded a bill today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    existing_bill = await db.loyalty_bills.find_one({
        "user_id": user_id,
        "date": {"$gte": today_start}
    })
    
    if existing_bill:
        raise HTTPException(status_code=400, detail="Only one bill per day is allowed")
    
    # Calculate points
    if 100 <= amount < 200:
        return 1
    elif amount >= 200:
        return 2
    return 0

async def check_and_reset_points(user_id: str):
    """Check if user missed 3 open days and reset points"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get('last_visit'):
        return
    
    last_visit = datetime.fromisoformat(user['last_visit'])
    now = datetime.now(timezone.utc)
    
    # Count open days missed
    missed_days = 0
    current_date = last_visit + timedelta(days=1)
    
    while current_date < now:
        day_of_week = current_date.weekday()
        if day_of_week != 1:  # Not Tuesday
            # Check if shop was not admin-closed (for MVP, assuming open)
            missed_days += 1
        
        if missed_days >= 3:
            # Reset points
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"points": 0}}
            )
            break
        
        current_date += timedelta(days=1)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/firebase")
async def firebase_auth_handler(request: FirebaseAuthRequest):
    """Authenticate user with Firebase Phone Auth token"""
    try:
        # Verify Firebase ID token
        decoded_token = firebase_auth.verify_id_token(request.firebase_token)
        phone_number = decoded_token.get('phone_number')
        firebase_uid = decoded_token.get('uid')
        
        if not phone_number:
            raise HTTPException(status_code=400, detail="Phone number not found in token")
        
        # Check if user exists
        user = await db.users.find_one({"phone_number": phone_number}, {"_id": 0})
        
        if user:
            # Existing user - login
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {
                    "last_visit": datetime.now(timezone.utc).isoformat(),
                    "firebase_uid": firebase_uid
                }}
            )
            
            # Check and update loyalty eligibility if user is a student
            if user.get('is_student') and user.get('dob'):
                await check_and_update_loyalty_status(user['id'])
                user = await db.users.find_one({"phone_number": phone_number}, {"_id": 0})
            
            # Check and reset points if needed
            await check_and_reset_points(user['id'])
            
            token = create_jwt_token(user['id'])
            return {"token": token, "user": user, "is_new_user": False}
        
        # New user - check if name provided
        if request.name:
            # Register new user
            user_id = str(uuid.uuid4())
            user_data = {
                "id": user_id,
                "phone_number": phone_number,
                "firebase_uid": firebase_uid,
                "name": request.name,
                "college": None,
                "verification_status": "not_started",
                "is_student": False,
                "loyalty_active": False,
                "points": 0,
                "dob": None,
                "last_visit": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": None
            }
            
            await db.users.insert_one(user_data)
            user_data.pop('_id', None)
            
            token = create_jwt_token(user_id)
            return {"token": token, "user": user_data, "is_new_user": False, "message": "Registration successful"}
        
        # New user without name - need registration
        return {"is_new_user": True, "phone_number": phone_number, "firebase_verified": True}
    
    except firebase_admin.exceptions.FirebaseError as e:
        logging.error(f"Firebase auth error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
    except Exception as e:
        logging.error(f"Firebase auth error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOTPRequest):
    """Send OTP to phone number using Twilio"""
    try:
        # For development without Twilio credentials, generate mock OTP
        if not VERIFY_SERVICE_SID:
            mock_otp = str(random.randint(100000, 999999))
            await db.otp_verifications.update_one(
                {"phone_number": request.phone_number},
                {
                    "$set": {
                        "otp": mock_otp,
                        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
                    }
                },
                upsert=True
            )
            return {"status": "pending", "message": f"Mock OTP: {mock_otp}"}
        
        verification = twilio_client.verify.services(VERIFY_SERVICE_SID).verifications.create(
            to=request.phone_number,
            channel="sms"
        )
        return {"status": verification.status}
    except Exception as e:
        logging.error(f"Send OTP error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """Verify OTP and return token - handles both new and existing users"""
    try:
        is_valid = False
        
        # Check mock OTP for development
        if not VERIFY_SERVICE_SID:
            stored = await db.otp_verifications.find_one({"phone_number": request.phone_number})
            if stored and stored.get('otp') == request.otp_code:
                expires_at = datetime.fromisoformat(stored['expires_at'])
                if datetime.now(timezone.utc) < expires_at:
                    is_valid = True
        else:
            check = twilio_client.verify.services(VERIFY_SERVICE_SID).verification_checks.create(
                to=request.phone_number,
                code=request.otp_code
            )
            is_valid = check.status == "approved"
        
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        # Check if user exists
        user = await db.users.find_one({"phone_number": request.phone_number}, {"_id": 0})
        
        if user:
            # Existing user - login
            await db.users.update_one(
                {"id": user['id']},
                {"$set": {"last_visit": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Check and update loyalty eligibility if user is a student
            if user.get('is_student') and user.get('dob'):
                await check_and_update_loyalty_status(user['id'])
                # Refetch user to get updated loyalty_active status
                user = await db.users.find_one({"phone_number": request.phone_number}, {"_id": 0})
            
            # Check and reset points if needed
            await check_and_reset_points(user['id'])
            
            token = create_jwt_token(user['id'])
            return {"token": token, "user": user, "is_new_user": False}
        
        # New user - return flag to show registration form
        return {"is_new_user": True, "phone_number": request.phone_number, "otp_verified": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Verify OTP error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/register")
async def register_user(request: RegisterRequest):
    """Register new normal user - simple registration with name and phone only"""
    # Check if user already exists
    existing = await db.users.find_one({"phone_number": request.phone_number}, {"_id": 0})
    if existing:
        # Don't error - just login existing user
        token = create_jwt_token(existing['id'])
        return {"token": token, "user": existing, "message": "Logged in successfully"}
    
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "phone_number": request.phone_number,
        "name": request.name,
        "college": None,
        "verification_status": "not_applied",  # Changed from not_started
        "is_student": False,
        "loyalty_active": False,
        "points": 0,
        "dob": None,
        "last_visit": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "rejection_reason": None
    }
    
    await db.users.insert_one(user_data)
    
    # Remove MongoDB _id before returning
    user_data.pop("_id", None)
    
    token = create_jwt_token(user_id)
    return {"token": token, "user": user_data}

class ApplyStudentLoyaltyRequest(BaseModel):
    college: str
    dob: str

@api_router.post("/auth/apply-student-loyalty")
async def apply_student_loyalty(
    request: ApplyStudentLoyaltyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply for student loyalty program - marks user as student with college and DOB"""
    try:
        # Validate DOB (age must be 17-23)
        try:
            dob_date = datetime.strptime(request.dob, "%Y-%m-%d")
            today = datetime.now()
            age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
            
            if age < 17 or age > 23:
                raise HTTPException(status_code=400, detail=f"Age must be between 17-23 years. Your age: {age}")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Update user to be a student with verification_status 'not_started'
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": {
                "is_student": True,
                "college": request.college,
                "dob": request.dob,
                "age": age,
                "verification_status": "not_started",
                "loyalty_active": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": "Application submitted! Now upload your Student ID to verify."
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Apply student loyalty error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to apply for student loyalty")

@api_router.post("/auth/upload-student-id")
async def upload_student_id(
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    """Upload student ID for verification"""
    try:
        # Check if user has applied for student loyalty
        if not current_user.get('is_student'):
            raise HTTPException(status_code=400, detail="Please apply for student loyalty first from your Profile page")
        
        user_dob = current_user.get('dob', '')
        
        # Read image
        contents = await file.read()
        
        # Verify it's an image
        try:
            img = Image.open(io.BytesIO(contents))
            img.verify()
        except:
            return {
                "success": False,
                "message": "Invalid image file. Please upload a valid image (JPG, PNG, etc.)"
            }
        
        # Try to extract text using OCR (optional - won't fail if OCR fails)
        extracted_text = ""
        ocr_dob = None
        try:
            extracted_text = await extract_text_from_image(contents)
            if extracted_text and len(extracted_text) >= 10:
                ocr_dob = extract_dob_from_text(extracted_text)
        except Exception as ocr_error:
            logging.warning(f"OCR extraction failed (non-critical): {str(ocr_error)}")
            # Continue without OCR - admin will verify manually
        
        # Check if OCR DOB matches user DOB (if both exist)
        dob_match = (ocr_dob == user_dob) if (ocr_dob and user_dob) else None
        
        # Store image as base64 for admin review
        import base64
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Store for admin verification
        verification_doc = {
            "id": str(uuid.uuid4()),
            "user_id": current_user['id'],
            "user_name": current_user.get('name', 'Unknown'),
            "user_phone": current_user.get('phone_number', ''),
            "extracted_text": extracted_text or "OCR not available",
            "user_provided_dob": user_dob,
            "ocr_extracted_dob": ocr_dob,
            "dob_match": dob_match,
            "image_data": image_base64,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Delete any existing pending verifications for this user
        await db.student_id_verifications.delete_many({"user_id": current_user['id'], "status": "pending"})
        
        await db.student_id_verifications.insert_one(verification_doc)
        
        # Update user status
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": {"verification_status": "pending"}}
        )
        
        # Log the action
        await db.admin_logs.insert_one({
            "id": str(uuid.uuid4()),
            "action": "student_id_uploaded",
            "user_id": current_user['id'],
            "performed_by": current_user['id'],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {
                "ocr_dob": ocr_dob,
                "match": dob_match
            }
        })
        
        age = calculate_age_from_dob(user_dob)
        
        return {
            "success": True,
            "message": "Student ID uploaded successfully. Admin will review it shortly.",
            "ocr_feedback": {
                "dob_detected": ocr_dob is not None,
                "dob_match": dob_match,
                "age": age
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Student ID upload error: {str(e)}")
        return {
            "success": False,
            "message": "Upload failed. Please try again with a clearer photo."
        }

@api_router.get("/auth/me")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

@api_router.post("/student-loyalty/apply")
async def apply_student_loyalty(request: ApplyStudentLoyaltyRequest, current_user: dict = Depends(get_current_user)):
    """Apply for student loyalty program"""
    # Check if already applied
    if current_user.get('is_student'):
        raise HTTPException(status_code=400, detail="You have already applied for student loyalty")
    
    # Validate DOB and age
    try:
        user_dob = datetime.strptime(request.dob, "%Y-%m-%d")
    except:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    age = calculate_age_from_dob(request.dob)
    if not (17 <= age <= 23):
        raise HTTPException(status_code=400, detail="You must be between 17-23 years old for student loyalty")
    
    # Update user to student applicant
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {
            "is_student": True,
            "college": request.college,
            "dob": request.dob,
            "verification_status": "not_started"  # Ready for student ID upload
        }}
    )
    
    # Log action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "student_loyalty_applied",
        "user_id": current_user['id'],
        "performed_by": current_user['id'],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {"college": request.college, "age": age}
    })
    
    return {"message": "Student loyalty application started. Please upload your student ID to continue."}

# ==================== MENU ROUTES ====================

@api_router.get("/menu")
async def get_menu():
    """Get all menu items (manual overrides take precedence over PDF)"""
    # Get manual items (these override PDF)
    items = await db.menu_items.find({"available": True}, {"_id": 0}).to_list(1000)
    return items

@api_router.get("/menu/all")
async def get_all_menu_items(admin: dict = Depends(get_admin_user)):
    """Get all menu items including unavailable ones (admin only)"""
    items = await db.menu_items.find({}, {"_id": 0}).to_list(1000)
    return items

# ==================== ORDER ROUTES ====================

@api_router.post("/orders")
async def create_order(order_req: CreateOrder, current_user: dict = Depends(get_current_user)):
    """Create new order - available to ALL logged-in users"""
    # Get shop location from settings
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings or 'shop_latitude' not in settings:
        raise HTTPException(status_code=500, detail="Shop location not configured. Please contact admin.")
    
    shop_lat = settings['shop_latitude']
    shop_lon = settings['shop_longitude']
    delivery_radius = settings.get('delivery_radius_km', 2.0)
    
    # Validate location
    distance = calculate_distance(shop_lat, shop_lon, order_req.latitude, order_req.longitude)
    
    if distance > delivery_radius:
        raise HTTPException(status_code=400, detail=f"Delivery not available. Location is beyond {delivery_radius}km radius.")
    
    # Calculate total
    total_amount = sum(item.price * item.quantity for item in order_req.items)
    
    # Apply coupon if provided
    discount = 0
    if order_req.coupon_code:
        coupon = await db.coupons.find_one({"code": order_req.coupon_code, "active": True}, {"_id": 0})
        if coupon:
            # Parse expiry date - handle both date-only and datetime formats
            expiry_str = coupon['expiry_date']
            try:
                expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            except ValueError:
                expiry_date = datetime.fromisoformat(expiry_str)
                if expiry_date.tzinfo is None:
                    expiry_date = expiry_date.replace(tzinfo=timezone.utc)
            
            if datetime.now(timezone.utc) > expiry_date:
                raise HTTPException(status_code=400, detail="Coupon expired")
            if coupon['used_count'] >= coupon['usage_limit']:
                raise HTTPException(status_code=400, detail="Coupon usage limit reached")
            if total_amount < coupon.get('min_order', 0):
                raise HTTPException(status_code=400, detail=f"Minimum order amount is ₹{coupon['min_order']}")
            
            if coupon['type'] == 'flat':
                discount = coupon['value']
            else:  # percentage
                discount = (total_amount * coupon['value']) / 100
            
            # Update coupon usage
            await db.coupons.update_one(
                {"id": coupon['id']},
                {"$inc": {"used_count": 1}}
            )
    
    # Get delivery charge from settings
    delivery_fee = settings.get('delivery_charge', 50)
    
    final_amount = total_amount + delivery_fee - discount
    
    order_id = str(uuid.uuid4())
    order_data = {
        "id": order_id,
        "user_id": current_user['id'],
        "items": [item.model_dump() for item in order_req.items],
        "total_amount": total_amount,
        "delivery_fee": delivery_fee,
        "discount": discount,
        "final_amount": final_amount,
        "delivery_address": order_req.delivery_address,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order_data)
    # Remove MongoDB _id before returning
    order_data.pop("_id", None)
    return order_data

@api_router.get("/orders/my-orders")
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    """Get user's orders with enriched item details"""
    orders = await db.orders.find({"user_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich orders with item names
    for order in orders:
        enriched_items = []
        for item in order.get('items', []):
            menu_item = await db.menu_items.find_one({"id": item['menu_item_id']}, {"_id": 0})
            enriched_items.append({
                **item,
                "name": menu_item['name'] if menu_item else "Unknown Item"
            })
        order['items'] = enriched_items
    
    return orders

# ==================== LOYALTY ROUTES ====================

@api_router.post("/loyalty/upload-bill")
async def upload_bill(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload bill for loyalty points"""
    try:
        # Read image
        contents = await file.read()
        
        # Extract text using OCR
        extracted_text = await extract_text_from_image(contents)
        
        # Extract bill info
        bill_number, amount = extract_bill_info(extracted_text)
        
        if not bill_number or not amount:
            raise HTTPException(status_code=400, detail="Could not extract bill information. Please try with a clearer image.")
        
        # Check for duplicate bill globally
        existing_bill = await db.loyalty_bills.find_one({"bill_number": bill_number})
        if existing_bill:
            raise HTTPException(status_code=400, detail="This bill has already been submitted")
        
        # Calculate points
        bill_date = datetime.now(timezone.utc).isoformat()
        points = await calculate_loyalty_points(current_user['id'], amount, bill_date)
        
        # Create loyalty bill record
        bill_id = str(uuid.uuid4())
        bill_data = {
            "id": bill_id,
            "user_id": current_user['id'],
            "bill_number": bill_number,
            "amount": amount,
            "points_earned": points,
            "date": bill_date,
            "status": "approved",  # Auto-approve if OCR succeeds
            "extracted_text": extracted_text
        }
        
        await db.loyalty_bills.insert_one(bill_data)
        
        # Update user points
        await db.users.update_one(
            {"id": current_user['id']},
            {
                "$inc": {"points": points},
                "$set": {"last_visit": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        return {
            "message": "Bill uploaded successfully",
            "points_earned": points,
            "bill_number": bill_number,
            "amount": amount
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Bill upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process bill")

@api_router.get("/loyalty/points")
async def get_loyalty_points(current_user: dict = Depends(get_current_user)):
    """Get user's loyalty points"""
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    return {"points": user.get('points', 0)}

@api_router.get("/loyalty/history")
async def get_loyalty_history(current_user: dict = Depends(get_current_user)):
    """Get user's loyalty bill history"""
    bills = await db.loyalty_bills.find({"user_id": current_user['id']}, {"_id": 0}).sort("date", -1).to_list(100)
    return bills

# ==================== SHOP INFO ROUTES ====================

@api_router.get("/shop/status")
async def get_shop_status():
    """Get shop open/closed status"""
    is_open, message = is_shop_open()
    return {"is_open": is_open, "message": message}

@api_router.get("/about")
async def get_about():
    """Get about page content"""
    content = await db.about_content.find_one({}, {"_id": 0})
    if not content:
        content = {
            "title": "About Our Shop",
            "content": "Welcome to our food shop! We serve delicious meals to college students."
        }
    return content

@api_router.post("/validate-location")
async def validate_location(location: LocationValidation):
    """Validate if location is within delivery radius"""
    # Get shop location from settings
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings or 'shop_latitude' not in settings:
        raise HTTPException(status_code=500, detail="Shop location not configured. Please contact admin.")
    
    shop_lat = settings['shop_latitude']
    shop_lon = settings['shop_longitude']
    delivery_radius = settings.get('delivery_radius_km', 2.0)
    
    distance = calculate_distance(shop_lat, shop_lon, location.latitude, location.longitude)
    
    within_radius = distance <= delivery_radius
    return {
        "within_radius": within_radius,
        "distance_km": round(distance, 2),
        "delivery_available": within_radius,
        "shop_address": settings.get('shop_address', 'Shop location')
    }

@api_router.get("/coupons/validate/{code}")
async def validate_coupon(code: str):
    """Validate coupon code"""
    coupon = await db.coupons.find_one({"code": code, "active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Parse expiry date - handle both date-only and datetime formats
    expiry_str = coupon['expiry_date']
    try:
        # Try parsing as date only (YYYY-MM-DD)
        expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        # Try parsing as ISO format with timezone
        expiry_date = datetime.fromisoformat(expiry_str)
        if expiry_date.tzinfo is None:
            expiry_date = expiry_date.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expiry_date:
        raise HTTPException(status_code=400, detail="Coupon expired")
    
    if coupon['used_count'] >= coupon['usage_limit']:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    
    return coupon

# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/login")
async def admin_login(request: AdminLogin):
    """Admin login"""
    # Check for admin credentials in database
    admin_doc = await db.admin_users.find_one({"username": request.username}, {"_id": 0})
    
    if not admin_doc:
        # Fallback to default admin (for first time setup)
        if request.username == "admin" and request.password == "admin@123":
            # Create default admin in database with hashed password
            hashed_pw = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt())
            await db.admin_users.insert_one({
                "id": str(uuid.uuid4()),
                "username": "admin",
                "password": hashed_pw.decode('utf-8'),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            token = create_jwt_token("admin", role="admin")
            return {"token": token, "message": "Please change your password immediately"}
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not bcrypt.checkpw(request.password.encode('utf-8'), admin_doc['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(admin_doc['id'], role="admin")
    return {"token": token}

@api_router.get("/admin/dashboard")
async def get_admin_dashboard(admin: dict = Depends(get_admin_user)):
    """Get admin dashboard stats"""
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"verification_status": "approved"})
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    orders_today = await db.orders.count_documents({"created_at": {"$gte": today_start}})
    
    total_points_issued = await db.users.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]).to_list(1)
    
    points_issued = total_points_issued[0]['total'] if total_points_issued else 0
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "orders_today": orders_today,
        "points_issued": points_issued
    }

@api_router.get("/admin/users")
async def get_all_users(admin: dict = Depends(get_admin_user)):
    """Get all users"""
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return users

@api_router.get("/admin/users/students")
async def get_student_users(admin: dict = Depends(get_admin_user)):
    """Get all student users (opted for loyalty)"""
    users = await db.users.find({"is_student": True}, {"_id": 0}).to_list(1000)
    return users

@api_router.get("/admin/users/non-students")
async def get_non_student_users(admin: dict = Depends(get_admin_user)):
    """Get all non-student users (including those with is_student=None for backward compatibility)"""
    users = await db.users.find(
        {"$or": [{"is_student": False}, {"is_student": None}, {"is_student": {"$exists": False}}]}, 
        {"_id": 0}
    ).to_list(1000)
    return users

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Delete user account"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    # Delete related data
    await db.loyalty_bills.delete_many({"user_id": user_id})
    await db.orders.delete_many({"user_id": user_id})
    await db.student_id_verifications.delete_many({"user_id": user_id})
    
    # Log action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "user_deleted",
        "user_id": user_id,
        "performed_by": admin.get("user_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {"user_name": user.get('name')}
    })
    
    return {"message": "User deleted successfully"}

@api_router.post("/admin/users/{user_id}/disable-loyalty")
async def disable_user_loyalty(user_id: str, admin: dict = Depends(get_admin_user)):
    """Disable loyalty for a specific user"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"loyalty_active": False}}
    )
    
    # Log action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "loyalty_disabled",
        "user_id": user_id,
        "performed_by": admin.get("user_id"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Loyalty disabled for user"}

@api_router.post("/admin/loyalty/check-expiry")
async def trigger_loyalty_expiry_check(admin: dict = Depends(get_admin_user)):
    """Manually trigger loyalty expiry check for all users"""
    await check_all_users_loyalty_expiry()
    
    # Log admin action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "loyalty_expiry_manual_check",
        "user_id": None,
        "performed_by": admin.get("user_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {"triggered_by": "admin"}
    })
    
    return {"message": "Loyalty expiry check completed"}

@api_router.get("/admin/loyalty/expiry-logs")
async def get_loyalty_expiry_logs(limit: int = 50, admin: dict = Depends(get_admin_user)):
    """Get logs of automatic loyalty expirations"""
    logs = await db.admin_logs.find(
        {"action": {"$in": ["loyalty_auto_expired", "loyalty_expiry_manual_check"]}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return logs

@api_router.get("/admin/logs")
async def get_admin_logs(limit: int = 100, admin: dict = Depends(get_admin_user)):
    """Get admin action logs"""
    logs = await db.admin_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return logs

@api_router.get("/admin/verifications/pending")
async def get_pending_verifications(admin: dict = Depends(get_admin_user)):
    """Get pending student ID verifications"""
    verifications = await db.student_id_verifications.find({"status": "pending"}, {"_id": 0}).to_list(1000)
    return verifications

@api_router.post("/admin/verifications/approve/{verification_id}")
async def approve_verification(verification_id: str, admin: dict = Depends(get_admin_user)):
    """Approve student ID verification"""
    verification = await db.student_id_verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    user = await db.users.find_one({"id": verification['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check loyalty eligibility based on DOB
    is_eligible = is_loyalty_eligible(user['dob']) if user.get('dob') else False
    
    await db.student_id_verifications.update_one(
        {"id": verification_id},
        {"$set": {"status": "approved"}}
    )
    
    await db.users.update_one(
        {"id": verification['user_id']},
        {"$set": {
            "verification_status": "approved",
            "loyalty_active": is_eligible,
            "rejection_reason": None
        }}
    )
    
    # Log admin action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "verification_approved",
        "user_id": verification['user_id'],
        "performed_by": admin.get("user_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {
            "verification_id": verification_id,
            "loyalty_eligible": is_eligible
        }
    })
    
    return {"message": "Verification approved", "loyalty_active": is_eligible}

@api_router.post("/admin/verifications/reject/{verification_id}")
async def reject_verification(verification_id: str, reason: str = "", admin: dict = Depends(get_admin_user)):
    """Reject student ID verification"""
    verification = await db.student_id_verifications.find_one({"id": verification_id}, {"_id": 0})
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    await db.student_id_verifications.update_one(
        {"id": verification_id},
        {"$set": {"status": "rejected", "rejection_reason": reason}}
    )
    
    await db.users.update_one(
        {"id": verification['user_id']},
        {"$set": {
            "verification_status": "rejected",
            "rejection_reason": reason or "Student ID verification rejected by admin"
        }}
    )
    
    # Log admin action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "verification_rejected",
        "user_id": verification['user_id'],
        "performed_by": admin.get("user_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {
            "verification_id": verification_id,
            "reason": reason
        }
    })
    
    return {"message": "Verification rejected"}

@api_router.post("/admin/menu")
async def create_menu_item(item: CreateMenuItem, admin: dict = Depends(get_admin_user)):
    """Create new menu item"""
    item_id = str(uuid.uuid4())
    item_data = {
        "id": item_id,
        **item.model_dump(),
        "available": True,
        "is_manual_override": True  # Manually created items override PDF
    }
    await db.menu_items.insert_one(item_data)
    # Remove MongoDB _id before returning
    item_data.pop("_id", None)
    return item_data

@api_router.put("/admin/menu/{item_id}")
async def update_menu_item(item_id: str, item: CreateMenuItem, admin: dict = Depends(get_admin_user)):
    """Update menu item"""
    await db.menu_items.update_one(
        {"id": item_id},
        {"$set": {**item.model_dump(), "is_manual_override": True}}  # Mark as manually edited
    )
    return {"message": "Menu item updated"}

@api_router.delete("/admin/menu/{item_id}")
async def delete_menu_item(item_id: str, admin: dict = Depends(get_admin_user)):
    """Delete menu item"""
    await db.menu_items.delete_one({"id": item_id})
    return {"message": "Menu item deleted"}

@api_router.post("/admin/menu/{item_id}/reset-override")
async def reset_menu_item_override(item_id: str, admin: dict = Depends(get_admin_user)):
    """Reset manual override and revert to PDF"""
    result = await db.menu_items.update_one(
        {"id": item_id},
        {"$set": {"is_manual_override": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"message": "Override reset. Item will now follow PDF if available."}

@api_router.post("/admin/coupons")
async def create_coupon(coupon: CreateCoupon, admin: dict = Depends(get_admin_user)):
    """Create new coupon"""
    coupon_id = str(uuid.uuid4())
    coupon_data = {
        "id": coupon_id,
        **coupon.model_dump(),
        "used_count": 0,
        "active": True
    }
    await db.coupons.insert_one(coupon_data)
    # Return without MongoDB _id
    coupon_data.pop("_id", None)
    return coupon_data

@api_router.put("/admin/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, active: bool, admin: dict = Depends(get_admin_user)):
    """Enable/disable coupon"""
    await db.coupons.update_one(
        {"id": coupon_id},
        {"$set": {"active": active}}
    )
    return {"message": "Coupon updated"}

@api_router.put("/admin/about")
async def update_about(content: AboutContent, admin: dict = Depends(get_admin_user)):
    """Update about page content"""
    await db.about_content.update_one(
        {},
        {"$set": content.model_dump()},
        upsert=True
    )
    return {"message": "About content updated"}

@api_router.get("/admin/coupons")
async def get_all_coupons(admin: dict = Depends(get_admin_user)):
    """Get all coupons"""
    coupons = await db.coupons.find({}, {"_id": 0}).sort("expiry_date", -1).to_list(1000)
    return coupons

@api_router.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a coupon"""
    result = await db.coupons.delete_one({"id": coupon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deleted"}

@api_router.get("/settings")
async def get_settings():
    """Get shop settings (public endpoint)"""
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        # Return defaults
        return {
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
    return settings

@api_router.put("/admin/settings")
async def update_settings(settings: Settings, admin: dict = Depends(get_admin_user)):
    """Update shop settings"""
    await db.settings.update_one(
        {},
        {"$set": settings.model_dump()},
        upsert=True
    )
    return {"message": "Settings updated"}

@api_router.post("/admin/closed-days")
async def add_closed_day(date: str, admin: dict = Depends(get_admin_user)):
    """Add admin closed day"""
    await db.closed_days.insert_one({"date": date})
    return {"message": "Closed day added"}

@api_router.put("/admin/points/reset/{user_id}")
async def reset_user_points(user_id: str, admin: dict = Depends(get_admin_user)):
    """Reset user points"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"points": 0}}
    )
    return {"message": "Points reset"}

@api_router.put("/admin/points/restore/{user_id}")
async def restore_user_points(user_id: str, points: int, admin: dict = Depends(get_admin_user)):
    """Manually restore user points"""
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"points": points}}
    )
    return {"message": "Points restored"}

@api_router.post("/admin/change-password")
async def change_admin_password(request: AdminChangePassword, admin: dict = Depends(get_admin_user)):
    """Change admin password"""
    admin_id = admin.get("user_id")
    admin_doc = await db.admin_users.find_one({"id": admin_id}, {"_id": 0})
    
    if not admin_doc:
        raise HTTPException(status_code=404, detail="Admin user not found")
    
    # Verify current password
    if not bcrypt.checkpw(request.current_password.encode('utf-8'), admin_doc['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Hash new password
    hashed_pw = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update password
    await db.admin_users.update_one(
        {"id": admin_id},
        {"$set": {"password": hashed_pw.decode('utf-8')}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.post("/admin/change-username")
async def change_admin_username(request: AdminChangeUsername, admin: dict = Depends(get_admin_user)):
    """Change admin username"""
    admin_id = admin.get("user_id")
    admin_doc = await db.admin_users.find_one({"id": admin_id}, {"_id": 0})
    
    if not admin_doc:
        raise HTTPException(status_code=404, detail="Admin user not found")
    
    # Verify password for security
    if not bcrypt.checkpw(request.password.encode('utf-8'), admin_doc['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    
    # Check if new username already exists
    existing = await db.admin_users.find_one({"username": request.new_username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Update username
    await db.admin_users.update_one(
        {"id": admin_id},
        {"$set": {"username": request.new_username}}
    )
    
    return {"message": "Username changed successfully"}

@api_router.get("/admin/orders")
async def get_all_orders(admin: dict = Depends(get_admin_user)):
    """Get all orders with enriched item details"""
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich orders with item names
    for order in orders:
        enriched_items = []
        for item in order.get('items', []):
            menu_item = await db.menu_items.find_one({"id": item['menu_item_id']}, {"_id": 0})
            enriched_items.append({
                **item,
                "name": menu_item['name'] if menu_item else "Unknown Item"
            })
        order['items'] = enriched_items
        
        # Get user info
        user = await db.users.find_one({"id": order.get('user_id')}, {"_id": 0, "name": 1, "phone_number": 1})
        order['user_name'] = user.get('name') if user else 'Unknown'
        order['user_phone'] = user.get('phone_number') if user else 'Unknown'
    
    return orders

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, admin: dict = Depends(get_admin_user)):
    """Update order status"""
    valid_statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log admin action
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "order_status_updated",
        "user_id": order.get('user_id'),
        "performed_by": admin.get("user_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {
            "order_id": order_id,
            "old_status": order.get('status'),
            "new_status": status
        }
    })
    
    return {"message": f"Order status updated to {status}"}

@api_router.get("/orders/{order_id}")
async def get_order_details(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific order with enriched details"""
    order = await db.orders.find_one({"id": order_id, "user_id": current_user['id']}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Enrich items with names
    enriched_items = []
    for item in order.get('items', []):
        menu_item = await db.menu_items.find_one({"id": item['menu_item_id']}, {"_id": 0})
        enriched_items.append({
            **item,
            "name": menu_item['name'] if menu_item else "Unknown Item"
        })
    order['items'] = enriched_items
    
    return order

@api_router.post("/admin/menu-pdf")
async def upload_menu_pdf(file: UploadFile = File(...), keep_previous: bool = False, admin: dict = Depends(get_admin_user)):
    """Upload PDF menu"""
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Create uploads directory if not exists
    upload_dir = Path("/app/backend/uploads/menus")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    file_path = upload_dir / f"{file_id}_{file.filename}"
    
    # Save file
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Deactivate previous PDFs unless keep_previous is True
    if not keep_previous:
        await db.menu_pdfs.update_many(
            {"active": True},
            {"$set": {"active": False}}
        )
    
    # Create PDF record
    pdf_doc = {
        "id": file_id,
        "filename": file.filename,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "file_path": str(file_path),
        "active": True
    }
    
    await db.menu_pdfs.insert_one(pdf_doc)
    
    return {"message": "Menu PDF uploaded successfully", "pdf": pdf_doc}

@api_router.get("/admin/menu-pdfs")
async def get_menu_pdfs(admin: dict = Depends(get_admin_user)):
    """Get all uploaded menu PDFs"""
    pdfs = await db.menu_pdfs.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
    return pdfs

@api_router.get("/menu-pdf/active")
async def get_active_menu_pdf():
    """Get currently active menu PDF (public endpoint)"""
    pdf = await db.menu_pdfs.find_one({"active": True}, {"_id": 0})
    if not pdf:
        return {"message": "No active menu PDF"}
    return pdf

@api_router.get("/menu-pdf/download/{pdf_id}")
async def download_menu_pdf(pdf_id: str):
    """Download menu PDF file"""
    from fastapi.responses import FileResponse
    
    pdf = await db.menu_pdfs.find_one({"id": pdf_id}, {"_id": 0})
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    file_path = Path(pdf['file_path'])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on server")
    
    return FileResponse(file_path, media_type="application/pdf", filename=pdf['filename'])

@api_router.delete("/admin/menu-pdf/{pdf_id}")
async def delete_menu_pdf(pdf_id: str, admin: dict = Depends(get_admin_user)):
    """Delete menu PDF"""
    pdf = await db.menu_pdfs.find_one({"id": pdf_id}, {"_id": 0})
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    # Delete file from disk
    file_path = Path(pdf['file_path'])
    if file_path.exists():
        file_path.unlink()
    
    # Delete from database
    await db.menu_pdfs.delete_one({"id": pdf_id})
    
    return {"message": "Menu PDF deleted"}

# ==================== ROOT ROUTE ====================

@api_router.get("/")
async def root():
    return {"message": "Food Ordering API"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client_db.close()

# ==================== BACKGROUND TASKS ====================

async def check_all_users_loyalty_expiry():
    """
    Background task to check all student users and disable loyalty for those who turned 24.
    This runs once daily at startup and then every 24 hours.
    """
    try:
        # Find all students with active loyalty
        students = await db.users.find(
            {"is_student": True, "loyalty_active": True, "dob": {"$ne": None}},
            {"_id": 0, "id": 1, "name": 1, "dob": 1}
        ).to_list(10000)
        
        expired_count = 0
        for student in students:
            if not is_loyalty_eligible(student['dob']):
                # User has aged out (turned 24 or older)
                await db.users.update_one(
                    {"id": student['id']},
                    {"$set": {"loyalty_active": False}}
                )
                
                # Log the automatic expiry
                await db.admin_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "action": "loyalty_auto_expired",
                    "user_id": student['id'],
                    "performed_by": "system",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "details": {
                        "reason": "User turned 24",
                        "user_name": student.get('name'),
                        "dob": student.get('dob'),
                        "age": calculate_age_from_dob(student['dob'])
                    }
                })
                
                expired_count += 1
                logger.info(f"Loyalty auto-expired for user {student['id']} ({student.get('name')}) - turned 24")
        
        if expired_count > 0:
            logger.info(f"Loyalty expiry check complete: {expired_count} users expired")
        else:
            logger.info("Loyalty expiry check complete: No users expired")
            
    except Exception as e:
        logger.error(f"Error in loyalty expiry check: {str(e)}")

async def loyalty_expiry_scheduler():
    """
    Scheduler that runs the loyalty expiry check daily.
    First run happens immediately on startup, then every 24 hours.
    """
    while True:
        await check_all_users_loyalty_expiry()
        # Wait 24 hours before next check
        await asyncio.sleep(24 * 60 * 60)

@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup"""
    # Start the loyalty expiry scheduler as a background task
    asyncio.create_task(loyalty_expiry_scheduler())
    logger.info("Background scheduler started: Loyalty expiry check will run daily")