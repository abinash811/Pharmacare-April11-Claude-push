from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import httpx
from decimal import Decimal
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

# User Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str  # "admin" or "cashier"
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class SessionCreate(BaseModel):
    user_id: str
    session_token: str
    email: str
    name: str
    expires_at: datetime

# Product Models (Master Data)
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str  # Unique product code
    name: str
    brand: Optional[str] = None
    pack_size: Optional[str] = None  # e.g., "10 tablets", "100ml" - Display label
    units_per_pack: int = 1  # Numeric: how many units in one pack (e.g., 10 tablets per strip)
    category: Optional[str] = None
    default_mrp: float
    gst_percent: float = 5.0
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: int = 10  # Alert when stock falls below this (in packs)
    status: str = "active"  # active, inactive
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    sku: str
    name: str
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    units_per_pack: int = 1  # How many units (tablets) in one pack (strip)
    category: Optional[str] = None
    default_mrp: float
    gst_percent: float = 5.0
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: int = 10
    status: str = "active"

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    units_per_pack: Optional[int] = None
    pack_size: Optional[str] = None
    category: Optional[str] = None
    default_mrp: Optional[float] = None
    gst_percent: Optional[float] = None
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: Optional[int] = None
    status: Optional[str] = None

# Stock Batch Models (Inventory)
class StockBatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    batch_no: str
    expiry_date: datetime
    qty_on_hand: int  # Quantity in PACKS (strips). Total units = qty_on_hand × product.units_per_pack
    cost_price: float  # Purchase price per pack
    mrp: float  # MRP per pack
    supplier_name: Optional[str] = None
    location_id: Optional[str] = "default"  # For multi-location support
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockBatchCreate(BaseModel):
    product_id: str
    batch_no: str
    expiry_date: str
    qty_on_hand: int
    cost_price: float
    mrp: float
    supplier_name: Optional[str] = None
    location_id: Optional[str] = "default"

class StockBatchUpdate(BaseModel):
    qty_on_hand: Optional[int] = None
    cost_price: Optional[float] = None
    mrp: Optional[float] = None

# Legacy Medicine Models (for backward compatibility during migration)
class Medicine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    batch_number: str
    expiry_date: datetime
    mrp: float
    quantity: int
    supplier_name: str
    purchase_rate: float
    selling_price: float
    hsn_code: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MedicineCreate(BaseModel):
    name: str
    batch_number: str
    expiry_date: str
    mrp: float
    quantity: int
    supplier_name: str
    purchase_rate: float
    selling_price: float
    hsn_code: Optional[str] = None

class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    mrp: Optional[float] = None
    quantity: Optional[int] = None
    supplier_name: Optional[str] = None
    purchase_rate: Optional[float] = None
    selling_price: Optional[float] = None
    hsn_code: Optional[str] = None

# Bill Models
class BillItem(BaseModel):
    product_id: str  # Updated from medicine_id
    batch_id: str  # New field for batch tracking
    product_name: str  # Updated from medicine_name
    brand: Optional[str] = None
    batch_no: str  # Updated from batch_number
    expiry_date: str
    quantity: int
    unit_price: float  # The actual selling price
    mrp: float
    discount: float = 0
    gst_percent: float  # Updated from gst_rate
    line_total: float  # Updated from total

class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bill_number: str
    invoice_type: str = "SALE"  # SALE or SALES_RETURN
    ref_invoice_id: Optional[str] = None  # for returns
    status: str = "paid"  # draft, paid, due, refunded, cancelled
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    items: List[Dict[str, Any]]
    subtotal: float
    discount: float = 0
    tax_rate: float
    tax_amount: float
    total_amount: float
    paid_amount: float = 0  # Total amount paid so far
    due_amount: float = 0  # Remaining amount to be paid
    payment_method: Optional[str] = None  # Deprecated: use payments table instead
    cashier_id: str
    cashier_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BillCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    items: List[Dict[str, Any]]
    discount: float = 0
    tax_rate: float
    payments: Optional[List[Dict[str, Any]]] = None  # List of payment objects
    payment_method: Optional[str] = None  # Legacy support: single payment method
    status: str = "paid"  # draft or paid
    invoice_type: str = "SALE"
    ref_invoice_id: Optional[str] = None
    refund: Optional[Dict[str, Any]] = None  # For returns with refund

# Stock Movement Models (Enhanced Ledger)
class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    batch_id: str
    product_name: str
    batch_no: str
    quantity: int  # positive for IN (purchase, return), negative for OUT (sale)
    movement_type: str  # 'sale', 'sales_return', 'purchase', 'adjustment'
    ref_entity: str  # 'invoice', 'purchase', 'adjustment'
    ref_id: str  # bill_id or purchase_id
    location_id: Optional[str] = "default"
    reason: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockMovementCreate(BaseModel):
    product_id: str
    batch_id: str
    product_name: str
    batch_no: str
    quantity: int
    movement_type: str
    ref_entity: str
    ref_id: str
    location_id: Optional[str] = "default"
    reason: Optional[str] = None

# Payment Models (for multiple payment methods support)
class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_id: str
    amount: float
    payment_method: str  # cash, card, upi, credit
    reference_number: Optional[str] = None  # for card/UPI transactions
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None

# Refund Models (for sales returns)
class Refund(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    return_invoice_id: str  # ID of the return invoice
    original_invoice_id: Optional[str] = None  # Original sale invoice if linked
    amount: float
    refund_method: str  # cash, card, upi, credit_note
    reference_number: Optional[str] = None
    reason: Optional[str] = None  # damaged, expired, wrong_item, customer_request
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RefundCreate(BaseModel):
    return_invoice_id: str
    original_invoice_id: Optional[str] = None
    amount: float
    refund_method: str
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

# Audit Log Models (for compliance and tracking)
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str  # 'invoice', 'payment', 'refund', 'product', 'batch'
    entity_id: str
    action: str  # 'create', 'update', 'delete', 'status_change'
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    changes: Optional[dict] = None  # Specific fields that changed
    performed_by: str  # User ID
    performed_by_name: str  # User name for easy display
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLogCreate(BaseModel):
    entity_type: str
    entity_id: str
    action: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    changes: Optional[dict] = None
    reason: Optional[str] = None

# Purchase Models
class Purchase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    supplier_id: str
    supplier_name: str
    items: List[Dict[str, Any]]
    total_amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class PurchaseCreate(BaseModel):
    invoice_number: str
    supplier_id: str
    supplier_name: str
    items: List[Dict[str, Any]]
    total_amount: float

# Supplier Models
class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact: str
    gstin: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupplierCreate(BaseModel):
    name: str
    contact: str
    gstin: Optional[str] = None
    address: Optional[str] = None

# Customer Models
class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerCreate(BaseModel):
    name: str
    phone: str
    address: Optional[str] = None

# Doctor Models
class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact: Optional[str] = None
    specialization: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    specialization: Optional[str] = None

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request, session_token: Optional[str] = Cookie(None)):
    # Check cookie first
    token = session_token
    
    # Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check if it's a JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        # Check if it's an Emergent session token
        session = await db.sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=401, detail="Token expired")
        
        # Check if session expired
        expires_at = session['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"id": session['user_id']}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.InvalidTokenError:
        # Check if it's an Emergent session token
        session = await db.sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        expires_at = session['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"id": session['user_id']}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=hash_password(user_data.password)
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    # Create token
    token = create_access_token({"sub": user.id, "email": user.email})
    
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user_doc['id'], "email": user_doc['email']})
    
    return {
        "token": token,
        "user": {
            "id": user_doc['id'],
            "email": user_doc['email'],
            "name": user_doc['name'],
            "role": user_doc['role']
        }
    }

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Call Emergent auth service
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            auth_response.raise_for_status()
            session_data = auth_response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to validate session: {str(e)}")
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": session_data['email']}, {"_id": 0})
    
    if not user_doc:
        # Create new user with admin role for first user
        user_count = await db.users.count_documents({})
        role = "admin" if user_count == 0 else "cashier"
        
        user = User(
            email=session_data['email'],
            name=session_data['name'],
            role=role
        )
        doc = user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.users.insert_one(doc)
        user_id = user.id
    else:
        user_id = user_doc['id']
        user = User(**user_doc)
    
    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = SessionCreate(
        user_id=user_id,
        session_token=session_data['session_token'],
        email=session_data['email'],
        name=session_data['name'],
        expires_at=expires_at
    )
    
    session_doc = session.model_dump()
    session_doc['expires_at'] = session_doc['expires_at'].isoformat()
    await db.sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_data['session_token'],
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=60 * 60 * 24 * 7
    )
    
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    # Delete session from database
    await db.sessions.delete_many({"user_id": current_user.id})
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role
    }

# ==================== MEDICINE ROUTES ====================

@api_router.post("/medicines", response_model=Medicine)
async def create_medicine(medicine_data: MedicineCreate, current_user: User = Depends(get_current_user)):
    data = medicine_data.model_dump()
    data['expiry_date'] = datetime.fromisoformat(medicine_data.expiry_date)
    medicine = Medicine(**data)
    
    doc = medicine.model_dump()
    doc['expiry_date'] = doc['expiry_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.medicines.insert_one(doc)
    return medicine

@api_router.get("/medicines", response_model=List[Medicine])
async def get_medicines(current_user: User = Depends(get_current_user)):
    medicines = await db.medicines.find({}, {"_id": 0}).to_list(10000)
    for med in medicines:
        if isinstance(med['expiry_date'], str):
            med['expiry_date'] = datetime.fromisoformat(med['expiry_date'])
        if isinstance(med['created_at'], str):
            med['created_at'] = datetime.fromisoformat(med['created_at'])
        if isinstance(med['updated_at'], str):
            med['updated_at'] = datetime.fromisoformat(med['updated_at'])
    return medicines

@api_router.get("/medicines/search")
async def search_medicines(q: str, current_user: User = Depends(get_current_user)):
    medicines = await db.medicines.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"batch_number": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).to_list(100)
    
    for med in medicines:
        if isinstance(med['expiry_date'], str):
            med['expiry_date'] = datetime.fromisoformat(med['expiry_date'])
        if isinstance(med['created_at'], str):
            med['created_at'] = datetime.fromisoformat(med['created_at'])
        if isinstance(med['updated_at'], str):
            med['updated_at'] = datetime.fromisoformat(med['updated_at'])
    
    return medicines

@api_router.get("/medicines/{medicine_id}", response_model=Medicine)
async def get_medicine(medicine_id: str, current_user: User = Depends(get_current_user)):
    medicine = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    if isinstance(medicine['expiry_date'], str):
        medicine['expiry_date'] = datetime.fromisoformat(medicine['expiry_date'])
    if isinstance(medicine['created_at'], str):
        medicine['created_at'] = datetime.fromisoformat(medicine['created_at'])
    if isinstance(medicine['updated_at'], str):
        medicine['updated_at'] = datetime.fromisoformat(medicine['updated_at'])
    
    return Medicine(**medicine)

@api_router.put("/medicines/{medicine_id}")
async def update_medicine(
    medicine_id: str,
    medicine_data: MedicineUpdate,
    current_user: User = Depends(get_current_user)
):
    update_data = {k: v for k, v in medicine_data.model_dump().items() if v is not None}
    
    if 'expiry_date' in update_data:
        update_data['expiry_date'] = datetime.fromisoformat(update_data['expiry_date']).isoformat()
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    return {"message": "Medicine updated successfully"}

@api_router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete medicines")
    
    result = await db.medicines.delete_one({"id": medicine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    return {"message": "Medicine deleted successfully"}

@api_router.get("/medicines/alerts/low-stock")
async def get_low_stock_alerts(current_user: User = Depends(get_current_user)):
    medicines = await db.medicines.find({"quantity": {"$lt": 10}}, {"_id": 0}).to_list(1000)
    for med in medicines:
        if isinstance(med['expiry_date'], str):
            med['expiry_date'] = datetime.fromisoformat(med['expiry_date'])
    return medicines

@api_router.get("/medicines/alerts/expiring-soon")
async def get_expiring_medicines(current_user: User = Depends(get_current_user)):
    try:
        thirty_days_later = datetime.now(timezone.utc) + timedelta(days=30)
        medicines = await db.medicines.find({}, {"_id": 0}).to_list(10000)
        
        expiring_medicines = []
        for med in medicines:
            try:
                expiry = med.get('expiry_date')
                if not expiry:
                    continue
                    
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry)
                
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                
                if expiry <= thirty_days_later:
                    med['expiry_date'] = expiry
                    expiring_medicines.append(med)
            except Exception as e:
                logger.warning(f"Error processing medicine expiry: {e}")
                continue
        
        return expiring_medicines
    except Exception as e:
        logger.error(f"Expiring medicines error: {e}")
        return []


# ==================== AUDIT LOG HELPER ====================

async def create_audit_log(
    entity_type: str,
    entity_id: str,
    action: str,
    user: User,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    reason: Optional[str] = None
):
    """Helper function to create audit log entries"""
    
    # Calculate changes if both old and new values provided
    changes = None
    if old_value and new_value:
        changes = {}
        for key in new_value:
            if key not in old_value or old_value[key] != new_value[key]:
                changes[key] = {
                    'old': old_value.get(key),
                    'new': new_value[key]
                }
    
    audit_log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        changes=changes,
        performed_by=user.id,
        performed_by_name=user.name,
        reason=reason
    )
    
    audit_doc = audit_log.model_dump()
    audit_doc['created_at'] = audit_doc['created_at'].isoformat()
    
    try:
        await db.audit_logs.insert_one(audit_doc)
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
        # Don't fail the main operation if audit log fails
    
    return audit_log



# ==================== PRODUCT ROUTES ====================

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    # Check if SKU already exists
    existing = await db.products.find_one({"sku": product_data.sku}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
    
    product = Product(**product_data.model_dump())
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.products.insert_one(doc)
    
    return product

@api_router.get("/products", response_model=List[Product])
async def get_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
        
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(10000)
    for prod in products:
        if isinstance(prod['created_at'], str):
            prod['created_at'] = datetime.fromisoformat(prod['created_at'])
        if isinstance(prod['updated_at'], str):
            prod['updated_at'] = datetime.fromisoformat(prod['updated_at'])
    return products

@api_router.get("/products/search-with-batches")
async def search_products_with_batches(
    q: str,
    location_id: Optional[str] = "default",
    current_user: User = Depends(get_current_user)
):
    """
    Search products and return with available batches (FEFO sorted)
    """
    if len(q) < 2:
        return []
    
    # Search products
    products = await db.products.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).to_list(50)
    
    results = []
    for product in products:
        # Get batches for this product (FEFO - earliest expiry first)
        batches = await db.stock_batches.find(
            {
                "product_id": product['id'],
                "location_id": location_id,
                "qty_on_hand": {"$gt": 0}
            },
            {"_id": 0}
        ).sort("expiry_date", 1).to_list(10)
        
        if batches:
            # Format batch info
            formatted_batches = []
            total_qty = 0
            
            for batch in batches:
                expiry = batch['expiry_date']
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry)
                
                units_per_pack = product.get('units_per_pack', 1)
                total_units_in_batch = batch['qty_on_hand'] * units_per_pack
                
                formatted_batches.append({
                    "batch_id": batch['id'],
                    "batch_no": batch['batch_no'],
                    "expiry_date": expiry.strftime('%d-%m-%Y'),
                    "expiry_iso": expiry.isoformat(),
                    "qty_on_hand": batch['qty_on_hand'],  # Packs/strips
                    "total_units": total_units_in_batch,  # Individual tablets
                    "mrp": batch['mrp'],  # Per pack
                    "mrp_per_unit": batch['mrp'] / units_per_pack if units_per_pack > 0 else batch['mrp'],
                    "cost_price": batch['cost_price']
                })
                total_qty += batch['qty_on_hand']
            
            units_per_pack = product.get('units_per_pack', 1)
            total_units = total_qty * units_per_pack
            
            results.append({
                "product_id": product['id'],
                "sku": product['sku'],
                "name": product['name'],
                "brand": product.get('brand', ''),
                "pack_size": product.get('pack_size', ''),
                "units_per_pack": units_per_pack,
                "default_mrp": product['default_mrp'],
                "gst_percent": product['gst_percent'],
                "total_qty": total_qty,  # Total packs
                "total_units": total_units,  # Total individual units
                "batches": formatted_batches,
                "suggested_batch": formatted_batches[0] if formatted_batches else None  # FEFO
            })
    
    return results

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if isinstance(product['created_at'], str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    if isinstance(product['updated_at'], str):
        product['updated_at'] = datetime.fromisoformat(product['updated_at'])
    
    return Product(**product)

@api_router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update products")
    
    update_dict = {k: v for k, v in product_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {"message": "Product updated successfully"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete products")
    
    # Check if product has batches
    batches = await db.stock_batches.count_documents({"product_id": product_id})
    if batches > 0:
        raise HTTPException(status_code=400, detail="Cannot delete product with existing batches")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {"message": "Product deleted successfully"}

# ==================== STOCK BATCH ROUTES ====================

@api_router.post("/stock/batches", response_model=StockBatch)
async def create_stock_batch(batch_data: StockBatchCreate, current_user: User = Depends(get_current_user)):
    # Verify product exists
    product = await db.products.find_one({"id": batch_data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if batch already exists
    existing = await db.stock_batches.find_one({
        "product_id": batch_data.product_id,
        "batch_no": batch_data.batch_no,
        "location_id": batch_data.location_id or "default"
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Batch with this number already exists for this product at this location")
    
    data = batch_data.model_dump()
    data['expiry_date'] = datetime.fromisoformat(batch_data.expiry_date)
    
    batch = StockBatch(**data)
    doc = batch.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['expiry_date'] = doc['expiry_date'].isoformat()
    await db.stock_batches.insert_one(doc)
    
    return batch

@api_router.get("/stock/batches")
async def get_stock_batches(
    product_id: Optional[str] = None,
    location_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if product_id:
        query["product_id"] = product_id
    if location_id:
        query["location_id"] = location_id
    
    batches = await db.stock_batches.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(10000)
    
    # Enrich with product info
    for batch in batches:
        if isinstance(batch['created_at'], str):
            batch['created_at'] = datetime.fromisoformat(batch['created_at'])
        if isinstance(batch['updated_at'], str):
            batch['updated_at'] = datetime.fromisoformat(batch['updated_at'])
        if isinstance(batch['expiry_date'], str):
            batch['expiry_date'] = datetime.fromisoformat(batch['expiry_date'])
        
        # Add product info
        product = await db.products.find_one({"id": batch['product_id']}, {"_id": 0, "name": 1, "brand": 1, "sku": 1})
        if product:
            batch['product_name'] = product.get('name', '')
            batch['product_brand'] = product.get('brand', '')
            batch['product_sku'] = product.get('sku', '')
    
    return batches

@api_router.get("/stock/batches/{batch_id}")
async def get_stock_batch(batch_id: str, current_user: User = Depends(get_current_user)):
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    if isinstance(batch['created_at'], str):
        batch['created_at'] = datetime.fromisoformat(batch['created_at'])
    if isinstance(batch['updated_at'], str):
        batch['updated_at'] = datetime.fromisoformat(batch['updated_at'])
    if isinstance(batch['expiry_date'], str):
        batch['expiry_date'] = datetime.fromisoformat(batch['expiry_date'])
    
    return batch

@api_router.put("/stock/batches/{batch_id}")
async def update_stock_batch(
    batch_id: str,
    batch_data: StockBatchUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update stock batches")
    
    update_dict = {k: v for k, v in batch_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.stock_batches.update_one(
        {"id": batch_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    return {"message": "Batch updated successfully"}

@api_router.get("/stock/summary")
async def get_stock_summary(
    product_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get stock summary by product (total qty across all batches)"""
    query = {}
    if product_id:
        query["product_id"] = product_id
    
    batches = await db.stock_batches.find(query, {"_id": 0}).to_list(10000)
    
    # Group by product
    summary = {}
    for batch in batches:
        pid = batch['product_id']
        if pid not in summary:
            product = await db.products.find_one({"id": pid}, {"_id": 0})
            summary[pid] = {
                "product_id": pid,
                "product_name": product['name'] if product else "Unknown",
                "product_sku": product['sku'] if product else "",
                "total_qty": 0,
                "batches_count": 0,
                "earliest_expiry": None
            }
        
        summary[pid]["total_qty"] += batch['qty_on_hand']
        summary[pid]["batches_count"] += 1
        
        expiry = batch['expiry_date']
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry)
        
        if summary[pid]["earliest_expiry"] is None or expiry < summary[pid]["earliest_expiry"]:
            summary[pid]["earliest_expiry"] = expiry


@api_router.delete("/stock/batches/{batch_id}")
async def delete_stock_batch(batch_id: str, current_user: User = Depends(get_current_user)):
    """Delete a stock batch (only if qty_on_hand = 0)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete stock batches")
    
    # Check if batch exists and has zero quantity
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    if batch.get('qty_on_hand', 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete batch with stock. Adjust quantity to 0 first.")
    
    result = await db.stock_batches.delete_one({"id": batch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    return {"message": "Batch deleted successfully"}

# ==================== STOCK MOVEMENT ROUTES ====================

@api_router.post("/stock-movements")
async def create_stock_movement(
    movement_data: StockMovementCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a stock movement record"""
    movement = StockMovement(
        **movement_data.model_dump(),
        created_by=current_user.id
    )
    
    movement_doc = movement.model_dump()
    movement_doc['created_at'] = movement_doc['created_at'].isoformat()
    await db.stock_movements.insert_one(movement_doc)
    
    return {"message": "Stock movement recorded", "id": movement.id}

@api_router.get("/stock-movements")
async def get_stock_movements(
    product_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get stock movements with filters"""
    query = {}
    if product_id:
        query["product_id"] = product_id
    if batch_id:
        query["batch_id"] = batch_id
    if movement_type:
        query["movement_type"] = movement_type
    
    movements = await db.stock_movements.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for movement in movements:
        if isinstance(movement['created_at'], str):
            movement['created_at'] = datetime.fromisoformat(movement['created_at'])
    
    return movements


    
    return list(summary.values())


# ==================== MIGRATION ROUTE ====================

@api_router.post("/migrate/medicines-to-products")
async def migrate_medicines_to_products(current_user: User = Depends(get_current_user)):
    """
    One-time migration: Convert old Medicine documents to Product + StockBatch model
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can run migrations")
    
    try:
        medicines = await db.medicines.find({}, {"_id": 0}).to_list(10000)
        
        if not medicines:
            return {
                "message": "No medicines to migrate",
                "products_created": 0,
                "batches_created": 0
            }
        
        products_created = 0
        batches_created = 0
        errors = []
        
        for med in medicines:
            try:
                # Generate SKU from name if not exists
                sku = med.get('hsn_code') or f"MED-{med['id'][:8]}"
                
                # Check if product already exists
                existing_product = await db.products.find_one({"sku": sku}, {"_id": 0})
                
                if not existing_product:
                    # Create Product
                    product = Product(
                        id=med['id'],  # Keep same ID for consistency
                        sku=sku,
                        name=med['name'],
                        brand=None,
                        pack_size=None,
                        category=None,
                        default_mrp=med.get('mrp', 0),
                        gst_percent=5.0,
                        hsn_code=med.get('hsn_code'),
                        description=None
                    )
                    
                    product_doc = product.model_dump()
                    product_doc['created_at'] = med.get('created_at', datetime.now(timezone.utc).isoformat())
                    if isinstance(product_doc['created_at'], datetime):
                        product_doc['created_at'] = product_doc['created_at'].isoformat()
                    product_doc['updated_at'] = med.get('updated_at', datetime.now(timezone.utc).isoformat())
                    if isinstance(product_doc['updated_at'], datetime):
                        product_doc['updated_at'] = product_doc['updated_at'].isoformat()
                    
                    await db.products.insert_one(product_doc)
                    products_created += 1
                    product_id = med['id']
                else:
                    product_id = existing_product['id']
                
                # Create StockBatch
                expiry = med.get('expiry_date')
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry)
                elif not isinstance(expiry, datetime):
                    expiry = datetime.now(timezone.utc) + timedelta(days=365)
                
                batch = StockBatch(
                    product_id=product_id,
                    batch_no=med.get('batch_number', 'BATCH-001'),
                    expiry_date=expiry,
                    qty_on_hand=med.get('quantity', 0),
                    cost_price=med.get('purchase_rate', 0),
                    mrp=med.get('mrp', 0),
                    supplier_name=med.get('supplier_name'),
                    location_id="default"
                )
                
                batch_doc = batch.model_dump()
                batch_doc['created_at'] = batch_doc['created_at'].isoformat()
                batch_doc['updated_at'] = batch_doc['updated_at'].isoformat()
                batch_doc['expiry_date'] = batch_doc['expiry_date'].isoformat()
                
                await db.stock_batches.insert_one(batch_doc)
                batches_created += 1
                
            except Exception as e:
                errors.append(f"Error migrating medicine {med.get('id', 'unknown')}: {str(e)}")
                logger.error(f"Migration error for medicine {med.get('id')}: {e}")
                continue
        
        return {
            "message": "Migration completed",
            "products_created": products_created,
            "batches_created": batches_created,
            "total_medicines_processed": len(medicines),
            "errors": errors
        }
    
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")

# ==================== BILLING ROUTES ====================

@api_router.post("/bills", response_model=Bill)
async def create_bill(bill_data: BillCreate, current_user: User = Depends(get_current_user)):
    # Generate bill number
    prefix = "RTN" if bill_data.invoice_type == "SALES_RETURN" else "INV"
    bill_count = await db.bills.count_documents({"invoice_type": bill_data.invoice_type})
    bill_number = f"{prefix}-{datetime.now().strftime('%Y%m%d')}-{bill_count + 1:04d}"
    
    # Calculate totals
    subtotal = sum(item.get('line_total', item.get('total', 0)) for item in bill_data.items)
    tax_amount = subtotal * (bill_data.tax_rate / 100)
    total_amount = subtotal + tax_amount - bill_data.discount
    
    # Calculate paid and due amounts
    paid_amount = 0
    if bill_data.payments:
        # Multiple payments provided
        paid_amount = sum(p.get('amount', 0) for p in bill_data.payments)
    elif bill_data.payment_method:
        # Legacy: single payment method, assume full payment
        paid_amount = total_amount if bill_data.status == "paid" else 0
    
    due_amount = total_amount - paid_amount
    
    # Determine status based on payments
    if bill_data.status == "draft":
        status = "draft"
    elif due_amount <= 0:
        status = "paid"
    elif paid_amount > 0:
        status = "due"  # Partially paid
    else:
        status = "due"  # Not paid at all but not draft
    
    bill = Bill(
        bill_number=bill_number,
        invoice_type=bill_data.invoice_type,
        ref_invoice_id=bill_data.ref_invoice_id,
        status=status,
        customer_id=bill_data.customer_id,
        customer_name=bill_data.customer_name,
        customer_mobile=bill_data.customer_mobile,
        doctor_id=bill_data.doctor_id,
        doctor_name=bill_data.doctor_name,
        items=bill_data.items,
        subtotal=subtotal,
        discount=bill_data.discount,
        tax_rate=bill_data.tax_rate,
        tax_amount=tax_amount,
        total_amount=total_amount,
        paid_amount=paid_amount,
        due_amount=due_amount,
        payment_method=bill_data.payment_method,  # Legacy field
        cashier_id=current_user.id,
        cashier_name=current_user.name
    )
    
    # Only update stock if status is 'paid' (not draft)
    if bill_data.status == "paid":
        for item in bill_data.items:
            # Support both old (medicine_id) and new (product_id/batch_id) format
            batch_id = item.get('batch_id')
            product_id = item.get('product_id') or item.get('medicine_id')
            
            if not batch_id and product_id:
                # Legacy support: if batch_id not provided, try to find a batch for this product
                batches = await db.stock_batches.find(
                    {"product_id": product_id, "qty_on_hand": {"$gt": 0}},
                    {"_id": 0}
                ).sort("expiry_date", 1).to_list(1)
                
                if batches:
                    batch_id = batches[0]['id']
                else:
                    # No batch found, skip stock update for this item
                    logger.warning(f"No batch found for product {product_id}")
                    continue
            
            if not batch_id:
                continue
            
            # Get product to determine units_per_pack for conversion
            product = await db.products.find_one({"id": product_id}, {"_id": 0})
            if not product:
                logger.error(f"Product {product_id} not found")
                continue
            
            units_per_pack = product.get('units_per_pack', 1)
            
            # item['quantity'] is in UNITS (tablets)
            # Convert to PACKS for stock deduction
            quantity_in_units = item['quantity']
            quantity_in_packs = quantity_in_units / units_per_pack
            
            # Determine quantity change based on invoice type (in packs)
            pack_change = -quantity_in_packs if bill_data.invoice_type == "SALE" else quantity_in_packs
            
            # Update batch stock (qty_on_hand is in packs)
            result = await db.stock_batches.update_one(
                {"id": batch_id},
                {"$inc": {"qty_on_hand": pack_change}}
            )
            
            if result.matched_count == 0:
                logger.error(f"Batch {batch_id} not found")
                continue
            
            # Create stock movement record
            batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
            product = await db.products.find_one({"id": product_id}, {"_id": 0})
            
            movement = StockMovement(
                product_id=product_id,
                batch_id=batch_id,
                product_name=product['name'] if product else item.get('product_name', item.get('medicine_name', 'Unknown')),
                batch_no=batch['batch_no'] if batch else item.get('batch_no', item.get('batch_number', 'N/A')),
                quantity=quantity_change,
                movement_type="sale" if bill_data.invoice_type == "SALE" else "sales_return",
                ref_entity="invoice",
                ref_id=bill.id,
                location_id="default",
                created_by=current_user.id
            )
            movement_doc = movement.model_dump()
            movement_doc['created_at'] = movement_doc['created_at'].isoformat()
            await db.stock_movements.insert_one(movement_doc)
    
    # Save bill first
    doc = bill.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.bills.insert_one(doc)
    
    # Create payment records if payments provided
    if bill_data.payments and len(bill_data.payments) > 0:
        for payment_data in bill_data.payments:
            payment = Payment(
                invoice_id=bill.id,
                amount=payment_data.get('amount', 0),
                payment_method=payment_data.get('method', 'cash'),
                reference_number=payment_data.get('reference', None),
                notes=payment_data.get('notes', None),
                created_by=current_user.id
            )
            payment_doc = payment.model_dump()
            payment_doc['created_at'] = payment_doc['created_at'].isoformat()
            await db.payments.insert_one(payment_doc)
    
    # Create refund record for sales returns if refund data provided
    if bill_data.invoice_type == "SALES_RETURN" and bill_data.refund:
        refund = Refund(
            return_invoice_id=bill.id,
            original_invoice_id=bill_data.ref_invoice_id,
            amount=bill_data.refund.get('amount', total_amount),
            refund_method=bill_data.refund.get('method', 'cash'),
            reference_number=bill_data.refund.get('reference', None),
            reason=bill_data.refund.get('reason', None),
            notes=bill_data.refund.get('notes', None),
            created_by=current_user.id
        )
        refund_doc = refund.model_dump()
        refund_doc['created_at'] = refund_doc['created_at'].isoformat()
        await db.refunds.insert_one(refund_doc)
        
        # Audit log for refund
        await create_audit_log(
            entity_type='refund',
            entity_id=refund.id,
            action='create',
            user=current_user,
            new_value=refund_doc,
            reason=bill_data.refund.get('reason')
        )
    
    # Audit log for invoice creation
    await create_audit_log(
        entity_type='invoice',
        entity_id=bill.id,
        action='create',
        user=current_user,
        new_value={
            'bill_number': bill.bill_number,
            'invoice_type': bill.invoice_type,
            'status': bill.status,
            'customer_name': bill.customer_name,
            'total_amount': bill.total_amount,
            'paid_amount': bill.paid_amount,
            'due_amount': bill.due_amount
        }
    )
    
    return bill

@api_router.get("/bills", response_model=List[Bill])
async def get_bills(
    invoice_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if invoice_type:
        query["invoice_type"] = invoice_type
    if status:
        query["status"] = status
        
    bills = await db.bills.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for bill in bills:
        if isinstance(bill['created_at'], str):
            bill['created_at'] = datetime.fromisoformat(bill['created_at'])
        # Set default values for new fields if not present
        if 'invoice_type' not in bill:
            bill['invoice_type'] = 'SALE'
        if 'status' not in bill:
            bill['status'] = 'paid'
    return bills

@api_router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str, current_user: User = Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if isinstance(bill['created_at'], str):
        bill['created_at'] = datetime.fromisoformat(bill['created_at'])
    
    return Bill(**bill)


# ==================== PAYMENT ROUTES ====================

@api_router.post("/payments", response_model=Payment)
async def create_payment(payment_data: PaymentCreate, current_user: User = Depends(get_current_user)):
    """Record a payment against an invoice"""
    # Verify invoice exists
    invoice = await db.bills.find_one({"id": payment_data.invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    payment = Payment(
        **payment_data.model_dump(),
        created_by=current_user.id
    )
    
    payment_doc = payment.model_dump()
    payment_doc['created_at'] = payment_doc['created_at'].isoformat()
    await db.payments.insert_one(payment_doc)
    
    # Update invoice paid_amount and due_amount
    total_paid = await db.payments.aggregate([
        {"$match": {"invoice_id": payment_data.invoice_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    new_paid_amount = total_paid[0]['total'] if total_paid else 0
    new_due_amount = invoice['total_amount'] - new_paid_amount
    new_status = "paid" if new_due_amount <= 0 else "due"
    
    await db.bills.update_one(
        {"id": payment_data.invoice_id},
        {"$set": {
            "paid_amount": new_paid_amount,
            "due_amount": new_due_amount,
            "status": new_status
        }}
    )
    
    # Audit log for payment
    await create_audit_log(
        entity_type='payment',
        entity_id=payment.id,
        action='create',
        user=current_user,
        new_value=payment_doc
    )
    
    # Audit log for invoice status change
    if invoice.get('status') != new_status:
        await create_audit_log(
            entity_type='invoice',
            entity_id=payment_data.invoice_id,
            action='status_change',
            user=current_user,
            old_value={'status': invoice.get('status'), 'due_amount': invoice.get('due_amount', 0)},
            new_value={'status': new_status, 'due_amount': new_due_amount}
        )
    
    return payment

@api_router.get("/payments")
async def get_payments(
    invoice_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get payments, optionally filtered by invoice"""
    query = {}
    if invoice_id:
        query["invoice_id"] = invoice_id
    
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for payment in payments:
        if isinstance(payment['created_at'], str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments



# ==================== PDF GENERATION ====================

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from io import BytesIO
from fastapi.responses import StreamingResponse

@api_router.get("/bills/{bill_id}/pdf")
async def generate_bill_pdf(bill_id: str, current_user: User = Depends(get_current_user)):
    """Generate PDF invoice"""
    # Fetch bill
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Create PDF in memory
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Title
    pdf.setFont("Helvetica-Bold", 24)
    pdf.drawString(50, height - 50, "PharmaCare")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, height - 70, "Pharmacy Management System")
    
    # Invoice Details
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, height - 110, bill['invoice_type'])
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, height - 130, f"Invoice No: {bill['bill_number']}")
    pdf.drawString(50, height - 145, f"Date: {bill.get('created_at', '')[:10]}")
    
    # Customer Details
    pdf.drawString(50, height - 175, f"Customer: {bill.get('customer_name', 'Counter Sale')}")
    if bill.get('customer_mobile'):
        pdf.drawString(50, height - 190, f"Mobile: {bill['customer_mobile']}")
    if bill.get('doctor_name'):
        pdf.drawString(50, height - 205, f"Doctor: {bill['doctor_name']}")
    
    # Items Table Header
    y = height - 250
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(50, y, "Item")
    pdf.drawString(250, y, "Batch")
    pdf.drawString(350, y, "Qty")
    pdf.drawString(400, y, "Price")
    pdf.drawString(480, y, "Total")
    
    # Items
    pdf.setFont("Helvetica", 9)
    y -= 20
    for item in bill['items']:
        name = item.get('product_name', item.get('medicine_name', 'Item'))[:25]
        batch = item.get('batch_no', item.get('batch_number', ''))[:15]
        qty = str(item['quantity'])
        price = f"₹{item.get('unit_price', item.get('mrp', 0))}"
        total = f"₹{item.get('line_total', item.get('total', 0)):.2f}"
        
        pdf.drawString(50, y, name)
        pdf.drawString(250, y, batch)
        pdf.drawString(350, y, qty)
        pdf.drawString(400, y, price)
        pdf.drawString(480, y, total)
        y -= 15
        
        if y < 100:  # New page if needed
            pdf.showPage()
            y = height - 50
    
    # Totals
    y -= 20
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(400, y, f"Subtotal: ₹{bill['subtotal']:.2f}")
    y -= 15
    pdf.drawString(400, y, f"Discount: -₹{bill['discount']:.2f}")
    y -= 15
    pdf.drawString(400, y, f"GST: ₹{bill['tax_amount']:.2f}")
    y -= 15
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(400, y, f"TOTAL: ₹{bill['total_amount']:.2f}")
    
    # Footer
    pdf.setFont("Helvetica", 8)
    pdf.drawString(50, 50, "Thank you for your business!")
    pdf.drawString(50, 35, f"Cashier: {bill.get('cashier_name', '')}")
    
    pdf.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={bill['bill_number']}.pdf"}
    )


# ==================== REFUND ROUTES ====================

@api_router.post("/refunds", response_model=Refund)
async def create_refund(refund_data: RefundCreate, current_user: User = Depends(get_current_user)):
    """Record a refund for a sales return"""
    # Verify return invoice exists
    return_invoice = await db.bills.find_one({"id": refund_data.return_invoice_id}, {"_id": 0})
    if not return_invoice:
        raise HTTPException(status_code=404, detail="Return invoice not found")
    
    if return_invoice.get('invoice_type') != 'SALES_RETURN':
        raise HTTPException(status_code=400, detail="Invoice is not a sales return")
    
    refund = Refund(
        **refund_data.model_dump(),
        created_by=current_user.id
    )
    
    refund_doc = refund.model_dump()
    refund_doc['created_at'] = refund_doc['created_at'].isoformat()
    await db.refunds.insert_one(refund_doc)
    
    # Update return invoice status to refunded


# ==================== AUDIT LOG ROUTES ====================

@api_router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get audit logs with optional filters"""
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for log in logs:
        if isinstance(log['created_at'], str):
            log['created_at'] = datetime.fromisoformat(log['created_at'])
    
    return logs

@api_router.get("/audit-logs/entity/{entity_type}/{entity_id}")
async def get_entity_audit_trail(
    entity_type: str,
    entity_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get complete audit trail for a specific entity"""
    logs = await db.audit_logs.find(
        {
            "entity_type": entity_type,
            "entity_id": entity_id
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    for log in logs:
        if isinstance(log['created_at'], str):
            log['created_at'] = datetime.fromisoformat(log['created_at'])
    
    return logs


    await db.bills.update_one(
        {"id": refund_data.return_invoice_id},
        {"$set": {"status": "refunded"}}
    )
    
    return refund

@api_router.get("/refunds")
async def get_refunds(
    return_invoice_id: Optional[str] = None,
    original_invoice_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get refunds, optionally filtered by invoice"""
    query = {}
    if return_invoice_id:
        query["return_invoice_id"] = return_invoice_id
    if original_invoice_id:
        query["original_invoice_id"] = original_invoice_id
    
    refunds = await db.refunds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for refund in refunds:
        if isinstance(refund['created_at'], str):
            refund['created_at'] = datetime.fromisoformat(refund['created_at'])
    return refunds


# ==================== PURCHASE ROUTES ====================

@api_router.post("/purchases", response_model=Purchase)
async def create_purchase(purchase_data: PurchaseCreate, current_user: User = Depends(get_current_user)):
    purchase = Purchase(
        **purchase_data.model_dump(),
        created_by=current_user.id
    )
    
    # Update stock
    for item in purchase_data.items:
        # Check if medicine exists
        existing = await db.medicines.find_one({"id": item['medicine_id']})
        if existing:
            await db.medicines.update_one(
                {"id": item['medicine_id']},
                {"$inc": {"quantity": item['quantity']}}
            )
    
    doc = purchase.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.purchases.insert_one(doc)
    
    return purchase

@api_router.get("/purchases", response_model=List[Purchase])
async def get_purchases(current_user: User = Depends(get_current_user)):
    purchases = await db.purchases.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for purchase in purchases:
        if isinstance(purchase['created_at'], str):
            purchase['created_at'] = datetime.fromisoformat(purchase['created_at'])
    return purchases

# ==================== SUPPLIER ROUTES ====================

@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    supplier = Supplier(**supplier_data.model_dump())
    
    doc = supplier.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.suppliers.insert_one(doc)
    
    return supplier

@api_router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    for supplier in suppliers:
        if isinstance(supplier['created_at'], str):
            supplier['created_at'] = datetime.fromisoformat(supplier['created_at'])
    return suppliers

# ==================== CUSTOMER ROUTES ====================

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    customer = Customer(**customer_data.model_dump())
    
    doc = customer.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.customers.insert_one(doc)
    
    return customer

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    for customer in customers:
        if isinstance(customer['created_at'], str):
            customer['created_at'] = datetime.fromisoformat(customer['created_at'])
    return customers

@api_router.get("/customers/search")
async def search_customers(q: str, current_user: User = Depends(get_current_user)):
    customers = await db.customers.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).to_list(100)
    return customers

# ==================== DOCTOR ROUTES ====================

@api_router.post("/doctors", response_model=Doctor)
async def create_doctor(doctor_data: DoctorCreate, current_user: User = Depends(get_current_user)):
    doctor = Doctor(**doctor_data.model_dump())
    
    doc = doctor.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.doctors.insert_one(doc)
    
    return doctor

@api_router.get("/doctors", response_model=List[Doctor])
async def get_doctors(current_user: User = Depends(get_current_user)):
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(1000)
    for doctor in doctors:
        if isinstance(doctor['created_at'], str):
            doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
    return doctors

# ==================== REPORTS ====================

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    try:
        # Get today's sales
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_bills = await db.bills.find(
            {},
            {"_id": 0}
        ).to_list(10000)
        
        today_sales = 0
        total_sales = 0
        for bill in today_bills:
            try:
                created_at = bill['created_at']
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                total_sales += bill.get('total_amount', 0)
                if created_at >= today_start:
                    today_sales += bill.get('total_amount', 0)
            except Exception as e:
                logger.warning(f"Error processing bill: {e}")
                continue
        
        # Get stock stats
        medicines = await db.medicines.find({}, {"_id": 0}).to_list(10000)
        total_medicines = len(medicines)
        low_stock_count = len([m for m in medicines if m.get('quantity', 0) < 10])
        
        thirty_days_later = datetime.now(timezone.utc) + timedelta(days=30)
        expiring_count = 0
        total_stock_value = 0
        
        for med in medicines:
            try:
                expiry = med.get('expiry_date')
                if expiry:
                    if isinstance(expiry, str):
                        expiry = datetime.fromisoformat(expiry)
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    
                    if expiry <= thirty_days_later:
                        expiring_count += 1
                
                total_stock_value += med.get('quantity', 0) * med.get('purchase_rate', 0)
            except Exception as e:
                logger.warning(f"Error processing medicine: {e}")
                continue
        
        return {
            "today_sales": round(today_sales, 2),
            "total_sales": round(total_sales, 2),
            "total_medicines": total_medicines,
            "low_stock_count": low_stock_count,
            "expiring_soon_count": expiring_count,
            "total_stock_value": round(total_stock_value, 2)
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return {
            "today_sales": 0,
            "total_sales": 0,
            "total_medicines": 0,
            "low_stock_count": 0,
            "expiring_soon_count": 0,
            "total_stock_value": 0
        }

@api_router.get("/reports/sales")
async def get_sales_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    bills = await db.bills.find(query, {"_id": 0}).to_list(10000)
    
    # Filter by date if provided
    if start_date:
        start = datetime.fromisoformat(start_date)
        bills = [b for b in bills if datetime.fromisoformat(b['created_at'] if isinstance(b['created_at'], str) else b['created_at'].isoformat()) >= start]
    
    if end_date:
        end = datetime.fromisoformat(end_date)
        bills = [b for b in bills if datetime.fromisoformat(b['created_at'] if isinstance(b['created_at'], str) else b['created_at'].isoformat()) <= end]
    
    total_sales = sum(b['total_amount'] for b in bills)
    total_tax = sum(b['tax_amount'] for b in bills)
    
    return {
        "bills": bills,
        "summary": {
            "total_bills": len(bills),
            "total_sales": round(total_sales, 2),
            "total_tax": round(total_tax, 2)
        }
    }

# ==================== ANALYTICS ====================

@api_router.get("/analytics/summary")
async def get_analytics_summary(current_user: User = Depends(get_current_user)):
    try:
        # Get all bills (sales and returns)
        all_bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
        
        gross_sales = 0
        returns = 0
        pending_amount = 0
        draft_count = 0
        today_sales = 0
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        for bill in all_bills:
            try:
                invoice_type = bill.get('invoice_type', 'SALE')
                status = bill.get('status', 'paid')
                amount = bill.get('total_amount', 0)
                
                created_at = bill['created_at']
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                if invoice_type == 'SALE':
                    if status in ['paid', 'due']:
                        gross_sales += amount
                        if created_at >= today_start and status == 'paid':
                            today_sales += amount
                    if status == 'due':
                        pending_amount += amount
                    elif status == 'draft':
                        draft_count += 1
                elif invoice_type == 'SALES_RETURN':
                    if status in ['paid', 'refunded']:
                        returns += amount
                        
            except Exception as e:
                logger.warning(f"Error processing bill for analytics: {e}")
                continue
        
        net_sales = gross_sales - returns
        return_percentage = (returns / gross_sales * 100) if gross_sales > 0 else 0
        
        return {
            "gross_sales": round(gross_sales, 2),
            "returns": round(returns, 2),
            "net_sales": round(net_sales, 2),
            "return_percentage": round(return_percentage, 2),
            "pending_amount": round(pending_amount, 2),
            "today_sales": round(today_sales, 2),
            "draft_count": draft_count
        }
    except Exception as e:
        logger.error(f"Analytics summary error: {e}")
        return {
            "gross_sales": 0,
            "returns": 0,
            "net_sales": 0,
            "return_percentage": 0,
            "pending_amount": 0,
            "today_sales": 0,
            "draft_count": 0
        }

@api_router.get("/analytics/daily")
async def get_daily_analytics(days: int = 7, current_user: User = Depends(get_current_user)):
    try:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        all_bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
        
        # Group by date
        daily_data = {}
        
        for bill in all_bills:
            try:
                created_at = bill['created_at']
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                if created_at < start_date:
                    continue
                
                date_key = created_at.strftime('%Y-%m-%d')
                if date_key not in daily_data:
                    daily_data[date_key] = {'sales': 0, 'returns': 0, 'net': 0}
                
                invoice_type = bill.get('invoice_type', 'SALE')
                amount = bill.get('total_amount', 0)
                
                if invoice_type == 'SALE' and bill.get('status') in ['paid', 'due']:
                    daily_data[date_key]['sales'] += amount
                elif invoice_type == 'SALES_RETURN' and bill.get('status') in ['paid', 'refunded']:
                    daily_data[date_key]['returns'] += amount
                
                daily_data[date_key]['net'] = daily_data[date_key]['sales'] - daily_data[date_key]['returns']
            except Exception as e:
                logger.warning(f"Error processing bill for daily analytics: {e}")
                continue
        
        # Convert to list
        result = []
        for date_str in sorted(daily_data.keys()):
            result.append({
                "date": date_str,
                "sales": round(daily_data[date_str]['sales'], 2),
                "returns": round(daily_data[date_str]['returns'], 2),
                "net": round(daily_data[date_str]['net'], 2)
            })
        
        return result
    except Exception as e:
        logger.error(f"Daily analytics error: {e}")
        return []

# ==================== USER MANAGEMENT ====================

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# ==================== BACKUP ====================

@api_router.get("/backup/export")
async def export_data(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can export data")
    
    medicines = await db.medicines.find({}, {"_id": 0}).to_list(10000)
    bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
    purchases = await db.purchases.find({}, {"_id": 0}).to_list(10000)
    customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(10000)
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(10000)
    
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "medicines": medicines,
        "bills": bills,
        "purchases": purchases,
        "customers": customers,
        "doctors": doctors,
        "suppliers": suppliers
    }

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
    client.close()
