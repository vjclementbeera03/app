import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def seed_data():
    """Seed initial data for the application"""
    
    print("Seeding menu items...")
    menu_items = [
        {
            "id": "burger-classic",
            "name": "Classic Burger",
            "price": 120.0,
            "category": "Burgers",
            "veg": False,
            "prep_time": 15,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400&h=400&fit=crop"
        },
        {
            "id": "burger-veg",
            "name": "Veg Burger",
            "price": 90.0,
            "category": "Burgers",
            "veg": True,
            "prep_time": 12,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=400&fit=crop"
        },
        {
            "id": "pizza-margherita",
            "name": "Margherita Pizza",
            "price": 200.0,
            "category": "Pizza",
            "veg": True,
            "prep_time": 20,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&h=400&fit=crop"
        },
        {
            "id": "pizza-pepperoni",
            "name": "Pepperoni Pizza",
            "price": 250.0,
            "category": "Pizza",
            "veg": False,
            "prep_time": 20,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=400&fit=crop"
        },
        {
            "id": "biryani-chicken",
            "name": "Chicken Biryani",
            "price": 180.0,
            "category": "Biryani",
            "veg": False,
            "prep_time": 25,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1653543362907-b9e87d2be5db?w=400&h=400&fit=crop"
        },
        {
            "id": "biryani-veg",
            "name": "Veg Biryani",
            "price": 150.0,
            "category": "Biryani",
            "veg": True,
            "prep_time": 20,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1642821373181-696a54913e93?w=400&h=400&fit=crop"
        },
        {
            "id": "pasta-alfredo",
            "name": "Pasta Alfredo",
            "price": 170.0,
            "category": "Pasta",
            "veg": True,
            "prep_time": 18,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=400&fit=crop"
        },
        {
            "id": "sandwich-club",
            "name": "Club Sandwich",
            "price": 110.0,
            "category": "Sandwiches",
            "veg": False,
            "prep_time": 10,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=400&fit=crop"
        },
        {
            "id": "fries-regular",
            "name": "French Fries",
            "price": 60.0,
            "category": "Sides",
            "veg": True,
            "prep_time": 8,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop"
        },
        {
            "id": "shake-chocolate",
            "name": "Chocolate Shake",
            "price": 80.0,
            "category": "Beverages",
            "veg": True,
            "prep_time": 5,
            "available": True,
            "image_url": "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=400&fit=crop"
        }
    ]
    
    # Clear existing menu items
    await db.menu_items.delete_many({})
    
    # Insert menu items
    await db.menu_items.insert_many(menu_items)
    print(f"✓ Inserted {len(menu_items)} menu items")
    
    # Seed settings
    print("Seeding settings...")
    await db.settings.update_one(
        {},
        {"$set": {
            "delivery_charge": 50.0,
            "delivery_radius_km": 2.0,
            "shop_name": "Thu.Go.Zi – Food on Truck",
            "shop_tagline": "Fresh food delivered from our food truck",
            "shop_latitude": 28.6139,
            "shop_longitude": 77.2090,
            "shop_address": "Connaught Place, New Delhi, India",
            "payment_info": "Cash on Delivery only",
            "weekly_off_day": 1
        }},
        upsert=True
    )
    print("✓ Settings configured")
    
    # Seed about content
    print("Seeding about content...")
    await db.about_content.update_one(
        {},
        {"$set": {
            "title": "About Our Food Hub",
            "content": """Welcome to Local Food Hub - your trusted food partner!\n\nWe are a student-friendly food service dedicated to providing delicious, hygienic, and affordable meals to college students. Our journey started with a simple mission: to ensure every student gets quality food without breaking their budget.\n\nWhy Choose Us?\n• Fresh ingredients sourced daily\n• Strict hygiene standards\n• Student-exclusive loyalty program\n• Fast delivery within 2km\n• Special student discounts\n\nOur loyalty program rewards your regular visits with points that can be redeemed for discounts. Simply upload your bill and earn points!\n\nJoin our growing community of satisfied students today!"""
        }},
        upsert=True
    )
    print("✓ About content created")
    
    print("\n✅ Seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
