# Local Food Hub - Zomato-Style Food Ordering & Loyalty System

## Overview
A production-grade, mobile-first food ordering and loyalty management system built for a single local food shop serving college students.

## Key Features

### 🍔 Core Features
- **Menu Management**: Browse categorized food items with veg/non-veg tags
- **Smart Ordering**: Add to cart, apply coupons, place orders (COD only)
- **Location-Based Delivery**: 2km radius check using Haversine formula
- **Mobile OTP Authentication**: Twilio-based phone verification
- **Student ID Verification**: OCR-powered age verification (17-23 years)
- **Loyalty Rewards System**: Earn points on bills with strict anti-abuse rules

### 💎 Loyalty System Rules
- ₹100-199 = 1 point | ₹200+ = 2 points
- Maximum 1 bill per user per day
- Duplicate bill numbers rejected globally
- Points reset after 3 missed OPEN days (Tuesday weekly off excluded)
- Admin-closed days don't count toward reset

### 👨‍💼 Admin Dashboard
- User management & verification approval
- Menu item CRUD operations
- Coupon creation & management
- About page content editor
- Delivery charge & shop settings
- Points management (reset/restore)
- Order tracking

## Tech Stack

**Frontend:**
- React 19 + React Router
- Tailwind CSS + Shadcn UI
- Axios for API calls
- Mobile-first responsive design

**Backend:**
- FastAPI (Python)
- Motor (Async MongoDB driver)
- JWT authentication
- Twilio Verify API
- Google Vision API (OCR)

**Database:**
- MongoDB

## Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB running on localhost:27017
- Twilio account (optional - mock OTP available)

### Backend Setup
```bash
cd /app/backend

# Install dependencies
pip install -r requirements.txt

# Configure environment (.env)
MONGO_URL="mongodb://localhost:27017"
DB_NAME="food_hub_db"
JWT_SECRET="your-secure-secret-key"
TWILIO_ACCOUNT_SID="your-twilio-sid"  # Optional
TWILIO_AUTH_TOKEN="your-twilio-token"  # Optional
TWILIO_VERIFY_SERVICE="your-verify-sid"  # Optional
EMERGENT_LLM_KEY="your-google-vision-key"

# Seed initial data
python seed_data.py

# Start server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup
```bash
cd /app/frontend

# Install dependencies
yarn install

# Start development server
yarn start
```

## Default Credentials

**Admin Login:**
- Username: `admin`
- Password: `admin@123`

**Test User (after registration):**
- Any phone number with mock OTP: `123456`

## API Endpoints

### Public Endpoints
- `GET /api/` - Health check
- `GET /api/menu` - Get menu items
- `GET /api/about` - Get about content
- `GET /api/shop/status` - Get shop open/closed status
- `GET /api/settings` - Get shop settings
- `POST /api/validate-location` - Check delivery availability
- `GET /api/coupons/validate/:code` - Validate coupon

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/register` - Register new user
- `POST /api/auth/upload-student-id` - Upload student ID for verification
- `GET /api/auth/me` - Get current user

### User Endpoints (Requires Auth)
- `POST /api/orders` - Place new order
- `GET /api/orders/my-orders` - Get user's orders
- `POST /api/loyalty/upload-bill` - Upload bill for points
- `GET /api/loyalty/points` - Get loyalty points
- `GET /api/loyalty/history` - Get bill history

### Admin Endpoints (Requires Admin Auth)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/verifications/pending` - Pending ID verifications
- `POST /api/admin/verifications/approve/:id` - Approve verification
- `POST /api/admin/verifications/reject/:id` - Reject verification
- `POST /api/admin/menu` - Create menu item
- `PUT /api/admin/menu/:id` - Update menu item
- `DELETE /api/admin/menu/:id` - Delete menu item
- `POST /api/admin/coupons` - Create coupon
- `PUT /api/admin/about` - Update about content
- `PUT /api/admin/settings` - Update shop settings
- `GET /api/admin/orders` - Get all orders

## Design System

### Colors
- **Primary (Zomato Red)**: #E23744
- **Accent (Green)**: #239D60
- **Background**: #FFFFFF, #F9FAFB
- **Text**: #1C1C1C, #696969

### Typography
- **Headings**: Manrope (bold, sans-serif)
- **Body**: Inter (regular, sans-serif)

### Components
- Card-based layout with shadows
- Rounded corners (12px)
- Bottom navigation for mobile
- Floating action buttons
- Toast notifications (Sonner)

## Project Structure

```
/app/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── seed_data.py       # Database seeding script
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
│
└── frontend/
    ├── src/
    │   ├── App.js            # Main app component
    │   ├── contexts/
    │   │   └── AuthContext.js # Authentication context
    │   ├── pages/
    │   │   ├── Home.js
    │   │   ├── About.js
    │   │   ├── Menu.js
    │   │   ├── AuthPage.js
    │   │   ├── UserDashboard.js
    │   │   ├── Checkout.js
    │   │   └── AdminDashboard.js
    │   ├── components/
    │   │   ├── BottomNav.js
    │   │   └── ui/          # Shadcn UI components
    │   └── lib/
    │       └── utils.js
    │
    ├── package.json
    └── .env

```

## Business Logic

### Order Flow
1. User browses menu
2. Adds items to cart
3. Provides delivery address
4. Location validated (2km radius)
5. Applies coupon (optional)
6. Places order (COD)
7. Admin receives order notification

### Loyalty Flow
1. User makes purchase
2. Uploads bill photo after payment
3. OCR extracts bill number & amount
4. System validates:
   - No duplicate bills (global check)
   - Only 1 bill per day per user
   - Amount meets minimum (₹100)
5. Points awarded automatically
6. Points reset if 3 open days missed

### Student Verification Flow
1. User registers with phone OTP
2. Uploads student ID photo
3. OCR extracts age from ID
4. Age validated (17-23 years)
5. Admin reviews OCR text
6. Admin approves/rejects
7. User gains full access

## Database Collections

- **users** - User profiles with verification status
- **menu_items** - Food items with pricing
- **orders** - Order history and status
- **loyalty_bills** - Bill uploads for points
- **coupons** - Discount coupons
- **student_id_verifications** - Pending verifications
- **otp_verifications** - OTP codes (when using mock)
- **about_content** - Admin-editable content
- **settings** - Shop configuration
- **closed_days** - Admin-added closed dates

## Security Features

- JWT-based authentication
- Role-based access control (User/Admin)
- Token expiration (30 days)
- Password-free authentication (OTP only)
- Student age verification
- Duplicate bill detection
- Location-based delivery restriction

## Scalability Considerations

- Async database operations (Motor)
- Indexed MongoDB queries
- Caching-ready architecture
- Stateless API design
- Mobile-first responsive UI

## Known Limitations

- Single shop only (not multi-tenant)
- Cash on Delivery only
- No real-time order tracking
- No payment gateway integration (MVP)
- OCR accuracy depends on image quality
- Requires manual admin approval for student IDs

## Future Enhancements

1. Payment gateway integration (Razorpay/Stripe)
2. Real-time order tracking with WebSockets
3. Push notifications
4. Multiple shop locations
5. Advanced analytics dashboard
6. Customer reviews & ratings
7. Automated student ID verification
8. SMS/Email notifications
9. Referral program
10. Multi-language support

## Support

For issues or questions, contact the development team or refer to the API documentation at `/docs` (FastAPI auto-generated).

---

**Built with ❤️ for college students**
