"""
Seed script to add sample suppliers to the database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_URL)
db = client.pharmacy_db

async def seed_suppliers():
    """Add sample suppliers"""
    
    suppliers = [
        {
            "id": str(uuid.uuid4()),
            "name": "MedPlus Distributors",
            "contact_name": "Rajesh Kumar",
            "phone": "+91-9876543210",
            "email": "rajesh@medplus.com",
            "gstin": "29ABCDE1234F1Z5",
            "address": "123 Medical Street, Bangalore, Karnataka - 560001",
            "payment_terms_days": 30,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Apollo Pharma Supplies",
            "contact_name": "Priya Sharma",
            "phone": "+91-9876543211",
            "email": "priya@apollopharma.com",
            "gstin": "29FGHIJ5678K2Z6",
            "address": "456 Healthcare Avenue, Mumbai, Maharashtra - 400001",
            "payment_terms_days": 45,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sun Pharmaceutical Ltd",
            "contact_name": "Amit Patel",
            "phone": "+91-9876543212",
            "email": "amit@sunpharma.com",
            "gstin": "29LMNOP9012Q3Z7",
            "address": "789 Industrial Area, Ahmedabad, Gujarat - 380001",
            "payment_terms_days": 60,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Cipla Medical Distributors",
            "contact_name": "Sneha Reddy",
            "phone": "+91-9876543213",
            "email": "sneha@cipla.com",
            "gstin": "29RSTUV3456W4Z8",
            "address": "321 Pharma Hub, Hyderabad, Telangana - 500001",
            "payment_terms_days": 30,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Dr. Reddy's Laboratories",
            "contact_name": "Vikram Singh",
            "phone": "+91-9876543214",
            "email": "vikram@drreddys.com",
            "gstin": "29XYZAB7890C5Z9",
            "address": "654 Medical Complex, Chennai, Tamil Nadu - 600001",
            "payment_terms_days": 45,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Check if suppliers already exist
    existing_count = await db.suppliers.count_documents({})
    
    if existing_count > 0:
        print(f"⚠️  Database already has {existing_count} suppliers")
        response = input("Do you want to add more suppliers? (y/n): ")
        if response.lower() != 'y':
            print("Aborted.")
            return
    
    # Insert suppliers
    result = await db.suppliers.insert_many(suppliers)
    
    print(f"✅ Successfully added {len(result.inserted_ids)} suppliers:")
    for supplier in suppliers:
        print(f"   - {supplier['name']} (GSTIN: {supplier['gstin']})")
    
    # Display summary
    total_count = await db.suppliers.count_documents({})
    print(f"\n📊 Total suppliers in database: {total_count}")

async def main():
    print("=" * 60)
    print("  Supplier Seed Script - PharmaCare")
    print("=" * 60)
    print()
    
    try:
        await seed_suppliers()
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    finally:
        client.close()
        print("\n✅ Database connection closed")

if __name__ == "__main__":
    asyncio.run(main())
