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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    role: str  # "admin", "manager", "cashier", "inventory_staff"
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_active: bool = True
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

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

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str
    permissions: List[str]
    is_default: bool = False
    is_super_admin: bool = False
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class RoleCreate(BaseModel):
    name: str
    display_name: str
    permissions: List[str]

class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    permissions: Optional[List[str]] = None

# Granular Permission Structure
ALL_PERMISSIONS = {
    "dashboard": {
        "display_name": "Dashboard",
        "permissions": [
            {"id": "dashboard:view", "name": "View Dashboard"}
        ]
    },
    "billing": {
        "display_name": "Billing",
        "permissions": [
            {"id": "billing:create", "name": "Create Bills"},
            {"id": "billing:view", "name": "View Bills"},
            {"id": "billing:edit", "name": "Edit Bills"},
            {"id": "billing:delete", "name": "Delete Bills"}
        ]
    },
    "inventory": {
        "display_name": "Inventory",
        "permissions": [
            {"id": "inventory:view", "name": "View Inventory"},
            {"id": "inventory:create", "name": "Add Products"},
            {"id": "inventory:edit", "name": "Edit Products"},
            {"id": "inventory:delete", "name": "Delete Products"},
            {"id": "inventory:batches_view", "name": "View Batches"},
            {"id": "inventory:batches_create", "name": "Add Batches"},
            {"id": "inventory:stock_adjust", "name": "Adjust Stock"}
        ]
    },
    "purchases": {
        "display_name": "Purchases",
        "permissions": [
            {"id": "purchases:create", "name": "Create Purchases"},
            {"id": "purchases:view", "name": "View Purchases"},
            {"id": "purchases:edit", "name": "Edit Purchases"},
            {"id": "purchases:delete", "name": "Delete Purchases"}
        ]
    },
    "purchase_returns": {
        "display_name": "Purchase Returns",
        "permissions": [
            {"id": "purchase_returns:create", "name": "Create Returns"},
            {"id": "purchase_returns:view", "name": "View Returns"},
            {"id": "purchase_returns:confirm", "name": "Confirm Returns"}
        ]
    },
    "sales_returns": {
        "display_name": "Sales Returns",
        "permissions": [
            {"id": "sales_returns:create", "name": "Create Returns"},
            {"id": "sales_returns:view", "name": "View Returns"},
            {"id": "sales_returns:process", "name": "Process Returns"}
        ]
    },
    "customers": {
        "display_name": "Customers",
        "permissions": [
            {"id": "customers:view", "name": "View Customers"},
            {"id": "customers:create", "name": "Add Customers"},
            {"id": "customers:edit", "name": "Edit Customers"},
            {"id": "customers:delete", "name": "Delete Customers"}
        ]
    },
    "reports": {
        "display_name": "Reports",
        "permissions": [
            {"id": "reports:view", "name": "View Reports"},
            {"id": "reports:export", "name": "Export Reports"}
        ]
    },
    "settings": {
        "display_name": "Settings",
        "permissions": [
            {"id": "settings:view", "name": "View Settings"},
            {"id": "settings:edit", "name": "Edit Settings"}
        ]
    },
    "users": {
        "display_name": "User Management",
        "permissions": [
            {"id": "users:view", "name": "View Users"},
            {"id": "users:create", "name": "Create Users"},
            {"id": "users:edit", "name": "Edit Users"},
            {"id": "users:delete", "name": "Deactivate Users"}
        ]
    },
    "roles": {
        "display_name": "Roles & Permissions",
        "permissions": [
            {"id": "roles:view", "name": "View Roles"},
            {"id": "roles:create", "name": "Create Roles"},
            {"id": "roles:edit", "name": "Edit Roles"},
            {"id": "roles:delete", "name": "Delete Roles"}
        ]
    }
}

# Default Roles Configuration
DEFAULT_ROLES = [
    {
        "name": "admin",
        "display_name": "Administrator",
        "permissions": ["*"],
        "is_default": True,
        "is_super_admin": True
    },
    {
        "name": "manager",
        "display_name": "Manager",
        "permissions": [
            "dashboard:view", "billing:create", "billing:view", "billing:edit",
            "inventory:view", "inventory:edit", "inventory:create", "inventory:batches_view",
            "inventory:batches_create", "inventory:stock_adjust",
            "purchases:create", "purchases:view", "purchase_returns:create", 
            "purchase_returns:view", "sales_returns:create", "sales_returns:view",
            "customers:view", "customers:edit", "customers:create", "reports:view"
        ],
        "is_default": True,
        "is_super_admin": False
    },
    {
        "name": "cashier",
        "display_name": "Cashier",
        "permissions": [
            "dashboard:view", "billing:create", "billing:view", "inventory:view",
            "sales_returns:create", "sales_returns:view", "customers:view", 
            "customers:edit", "customers:create"
        ],
        "is_default": True,
        "is_super_admin": False
    },
    {
        "name": "inventory_staff",
        "display_name": "Inventory Staff",
        "permissions": [
            "dashboard:view", "inventory:view", "inventory:edit", "inventory:create",
            "inventory:batches_view", "inventory:batches_create", "inventory:stock_adjust",
            "purchases:create", "purchases:view", "purchase_returns:create", 
            "purchase_returns:view"
        ],
        "is_default": True,
        "is_super_admin": False
    }
]

async def has_permission(user_role: str, permission: str) -> bool:
    """Check if a user role has a specific permission"""
    # Fetch role from database
    role = await db.roles.find_one({"name": user_role}, {"_id": 0})
    
    if not role:
        return False
    
    user_permissions = role.get("permissions", [])
    
    # Super Admin or wildcard has all permissions
    if "*" in user_permissions or role.get("is_super_admin", False):
        return True
    
    return permission in user_permissions

def require_permission(permission: str):
    """Decorator to check if user has required permission"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get current_user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(status_code=401, detail="Not authenticated")
            
            if not has_permission(current_user.role, permission):
                raise HTTPException(
                    status_code=403, 
                    detail=f"Permission denied. Required permission: {permission}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Product Models (Master Data) - Phase 0
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str  # Unique product code (primary business identifier)
    name: str
    manufacturer: Optional[str] = None  # Phase 0: manufacturer field
    brand: Optional[str] = None
    pack_size: Optional[str] = None  # e.g., "Strip", "Box" - Display label
    units_per_pack: int = 1  # Numeric: how many units in one pack (e.g., 10 tablets per strip)
    uom: Optional[str] = "units"  # Unit of measure (units, ml, gm)
    category: Optional[str] = None
    # Backward compatibility: support both old and new field names
    default_mrp: Optional[float] = None  # Legacy field
    default_mrp_per_unit: float = 0  # Phase 0: MRP per unit (not per pack)
    default_ptr_per_unit: Optional[float] = None  # Phase 0: PTR (Price to Retailer) per unit
    gst_percent: float = 5.0
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: Optional[int] = None  # Legacy field
    low_stock_threshold_units: int = 10  # Phase 0: Alert threshold in units
    status: str = "active"  # active, inactive
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @classmethod
    def model_validate(cls, obj):
        # Backward compatibility: normalize old field names
        if isinstance(obj, dict):
            if 'default_mrp' in obj and 'default_mrp_per_unit' not in obj:
                obj['default_mrp_per_unit'] = obj['default_mrp']
            if 'low_stock_threshold' in obj and 'low_stock_threshold_units' not in obj:
                obj['low_stock_threshold_units'] = obj['low_stock_threshold']
        return super().model_validate(obj)

class ProductCreate(BaseModel):
    sku: str
    name: str
    manufacturer: Optional[str] = None
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    units_per_pack: int = 1  # How many units (tablets) in one pack (strip)
    uom: Optional[str] = "units"
    category: Optional[str] = None
    default_mrp_per_unit: Optional[float] = None  # Phase 0 field
    default_mrp: Optional[float] = None  # Legacy support
    default_ptr_per_unit: Optional[float] = None
    gst_percent: float = 5.0
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold_units: Optional[int] = 10
    low_stock_threshold: Optional[int] = None  # Legacy support
    status: str = "active"

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    brand: Optional[str] = None
    units_per_pack: Optional[int] = None
    pack_size: Optional[str] = None
    uom: Optional[str] = None
    category: Optional[str] = None
    default_mrp_per_unit: Optional[float] = None
    default_ptr_per_unit: Optional[float] = None
    gst_percent: Optional[float] = None
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold_units: Optional[int] = None
    status: Optional[str] = None

# Stock Batch Models (Inventory) - Phase 0
class StockBatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_sku: str  # Phase 0: FK to product SKU
    batch_no: str
    manufacture_date: Optional[datetime] = None  # Phase 0: manufacture date
    expiry_date: datetime
    qty_on_hand: int  # Quantity in PACKS (strips). Total units = qty_on_hand × product.units_per_pack
    cost_price_per_unit: float  # Phase 0: Cost price per individual unit
    mrp_per_unit: float  # Phase 0: MRP per individual unit
    supplier_name: Optional[str] = None
    supplier_invoice_no: Optional[str] = None  # Phase 0: supplier invoice number
    received_date: Optional[datetime] = None  # Phase 0: date received
    location: Optional[str] = "default"  # Phase 0: location field (not location_id)
    free_qty_units: Optional[int] = 0  # Phase 0: free quantity in units
    notes: Optional[str] = None  # Phase 0: notes field
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockBatchCreate(BaseModel):
    product_sku: str
    batch_no: str
    manufacture_date: Optional[str] = None
    expiry_date: str
    qty_on_hand: int  # In packs
    cost_price_per_unit: float
    mrp_per_unit: float
    supplier_name: Optional[str] = None
    supplier_invoice_no: Optional[str] = None
    received_date: Optional[str] = None
    location: Optional[str] = "default"
    free_qty_units: Optional[int] = 0
    notes: Optional[str] = None

class StockBatchUpdate(BaseModel):
    batch_no: Optional[str] = None
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None
    qty_on_hand: Optional[int] = None
    cost_price_per_unit: Optional[float] = None
    mrp_per_unit: Optional[float] = None
    supplier_name: Optional[str] = None
    supplier_invoice_no: Optional[str] = None
    received_date: Optional[str] = None
    location: Optional[str] = None
    free_qty_units: Optional[int] = None
    notes: Optional[str] = None

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
    product_id: Optional[str] = None  # Updated from medicine_id
    batch_id: Optional[str] = None  # New field for batch tracking
    product_name: Optional[str] = None  # Updated from medicine_name
    brand: Optional[str] = None
    batch_no: Optional[str] = None  # Updated from batch_number
    expiry_date: Optional[str] = None
    quantity: int
    unit_price: float  # The actual selling price
    mrp: float
    discount: float = 0
    gst_percent: float = 5  # Updated from gst_rate
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
    product_sku: str  # Phase 0: FK to product SKU
    batch_id: str
    product_name: str  # Denormalized for display
    batch_no: str  # Denormalized for display
    qty_delta_units: int  # Phase 0: positive for IN, negative for OUT (in units)
    movement_type: str  # Phase 0: 'opening_stock', 'adjustment', 'sale', 'sales_return', 'purchase', 'purchase_return'
    ref_type: str  # Phase 0: 'adjustment', 'opening', 'invoice', 'purchase'
    ref_id: str  # bill_id or purchase_id or adjustment_id
    location: Optional[str] = "default"
    reason: Optional[str] = None
    performed_by: str  # Phase 0: performed_by instead of created_by
    performed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # Phase 0: performed_at

class StockMovementCreate(BaseModel):
    product_sku: str
    batch_id: str
    product_name: str
    batch_no: str
    qty_delta_units: int
    movement_type: str
    ref_type: str
    ref_id: str
    location: Optional[str] = "default"
    reason: Optional[str] = None

# Stock Adjustment Model - Phase 0
class StockAdjustment(BaseModel):
    batch_id: str
    adjustment_type: str  # 'add' or 'remove'
    qty_units: int  # Quantity to add/remove in units
    reason: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None

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

# ==================== SUPPLIER MODELS ====================
class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_name: Optional[str] = None
    contact_person: Optional[str] = None  # Alias for frontend compatibility
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30  # Default 30 days credit
    credit_days: Optional[int] = None  # Alias for frontend compatibility
    notes: Optional[str] = None
    is_active: bool = True  # ADDED: For activate/deactivate functionality
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupplierCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_person: Optional[str] = None  # Alias for frontend
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30
    credit_days: Optional[int] = None  # Alias for frontend
    notes: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_person: Optional[str] = None  # Alias for frontend
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_days: Optional[int] = None  # Alias for frontend
    notes: Optional[str] = None
    is_active: Optional[bool] = None  # ADDED: For deactivation

# ==================== PURCHASE MODELS ====================
class PurchaseItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_sku: str
    product_name: str  # Denormalized for display
    batch_no: Optional[str] = None  # Optional: can be assigned during receive
    expiry_date: Optional[datetime] = None
    qty_packs: Optional[int] = None  # Input convenience
    qty_units: int  # Canonical quantity in units
    cost_price_per_unit: float
    mrp_per_unit: float
    gst_percent: float = 5.0
    line_total: float
    received_qty_units: int = 0  # Track how many units received so far

class Purchase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    purchase_number: str  # e.g., PUR-2024-0001
    supplier_id: str
    supplier_name: str  # Denormalized
    purchase_date: datetime
    supplier_invoice_no: Optional[str] = None
    supplier_invoice_date: Optional[datetime] = None
    status: str = "draft"  # draft, received, partially_received, closed, cancelled
    items: List[PurchaseItem] = []
    subtotal: float = 0
    tax_value: float = 0
    round_off: float = 0
    total_value: float = 0
    payment_terms_days: int = 30
    note: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PurchaseItemCreate(BaseModel):
    product_sku: str
    product_name: str
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None  # ISO string
    qty_packs: Optional[int] = None
    qty_units: int
    cost_price_per_unit: float
    mrp_per_unit: float
    gst_percent: float = 5.0

class PurchaseCreate(BaseModel):
    supplier_id: str
    purchase_date: str  # ISO date string
    supplier_invoice_no: Optional[str] = None
    supplier_invoice_date: Optional[str] = None
    items: List[PurchaseItemCreate]
    note: Optional[str] = None
    status: Optional[str] = "draft"  # draft or confirmed

class PurchaseUpdate(BaseModel):
    supplier_id: Optional[str] = None
    purchase_date: Optional[str] = None
    supplier_invoice_no: Optional[str] = None
    supplier_invoice_date: Optional[str] = None
    items: Optional[List[PurchaseItemCreate]] = None
    note: Optional[str] = None

# Customer Models
class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str

# ==================== GOODS RECEIPT MODELS ====================
class GoodsReceiptItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    purchase_item_id: str
    product_sku: str
    product_name: str
    batch_id: str  # Stock batch created/updated
    batch_no: str
    expiry_date: Optional[datetime] = None
    qty_units: int  # Quantity received in this receipt
    cost_price_per_unit: float
    mrp_per_unit: float

class GoodsReceipt(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    purchase_id: str
    purchase_number: str  # Denormalized
    receipt_date: datetime
    received_by: str
    received_by_name: str  # Denormalized
    supplier_invoice_no: Optional[str] = None
    note: Optional[str] = None
    items: List[GoodsReceiptItem] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReceiveItemInput(BaseModel):
    purchase_item_id: str
    batch_no: str
    expiry_date: Optional[str] = None  # ISO string
    qty_units: int  # Quantity to receive
    cost_price_per_unit: Optional[float] = None  # Override if different
    mrp_per_unit: Optional[float] = None  # Override if different

class ReceiveGoodsInput(BaseModel):
    receipt_date: str  # ISO date
    items: List[ReceiveItemInput]
    supplier_invoice_no: Optional[str] = None
    note: Optional[str] = None

# ==================== PURCHASE RETURN MODELS ====================
class PurchaseReturnItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_sku: str
    product_name: str
    batch_id: str
    batch_no: str
    qty_units: int  # Quantity being returned
    cost_price_per_unit: float
    reason: str  # Expired, Damaged, Overstock, Other
    line_total: float

class PurchaseReturn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    return_number: str  # e.g., PRET-2024-0001
    supplier_id: str
    supplier_name: str  # Denormalized
    purchase_id: Optional[str] = None  # Optional link to original purchase
    purchase_number: Optional[str] = None
    return_date: datetime
    status: str = "draft"  # draft, confirmed
    items: List[PurchaseReturnItem] = []
    total_value: float = 0
    note: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None

class PurchaseReturnItemCreate(BaseModel):
    product_sku: str
    product_name: str
    batch_id: Optional[str] = None
    batch_no: Optional[str] = None
    qty_units: Optional[int] = None
    return_qty_units: Optional[int] = None  # Alias for qty_units from frontend
    cost_price_per_unit: float
    reason: Optional[str] = None

class PurchaseReturnCreate(BaseModel):
    supplier_id: str
    purchase_id: Optional[str] = None
    return_date: str  # ISO date
    items: List[PurchaseReturnItemCreate]
    note: Optional[str] = None
    notes: Optional[str] = None  # Alias
    reason: Optional[str] = None

# ==================== SUPPLIER CREDIT MODELS ====================
class SupplierCredit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    supplier_name: str  # Denormalized
    credit_number: str  # e.g., SCRED-2024-0001
    amount: float
    reference: str  # Reference to purchase_return_id or other source
    reference_type: str  # purchase_return, adjustment
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str


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
        "role": current_user.role,
        "is_active": current_user.is_active
    }

# ==================== USER MANAGEMENT ROUTES ====================

@api_router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_user)):
    """Get all users - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    """Create new user - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate role
    if user_data.role not in ["admin", "manager", "cashier", "inventory_staff"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = pwd_context.hash(user_data.password)
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=password_hash,
        created_by=current_user.id,
        is_active=True
    )
    
    doc = user.model_dump()
    await db.users.insert_one(doc)
    
    # Return without password_hash
    user.password_hash = None
    return user

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user by ID - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@api_router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update user - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if user exists
    existing_user = await db.users.find_one({"id": user_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role if provided
    if user_update.role and user_update.role not in ["admin", "manager", "cashier", "inventory_staff"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Check if email is being changed and if it's already taken
    if user_update.email and user_update.email != existing_user.get("email"):
        email_exists = await db.users.find_one({"email": user_update.email})
        if email_exists:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    # Prepare update data
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = current_user.id
    
    # Update user
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Get updated user
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Deactivate user - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Cannot deactivate self
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    # Check if user exists
    existing_user = await db.users.find_one({"id": user_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Deactivate user
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_active": False,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user.id
        }}
    )
    
    # Delete all sessions for this user
    await db.sessions.delete_many({"user_id": user_id})
    
    return {"message": "User deactivated successfully"}

@api_router.put("/users/me/change-password")
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_user)
):
    """Change own password - All users"""
    # Get user with password hash
    user = await db.users.find_one({"id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not pwd_context.verify(password_data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_password_hash = pwd_context.hash(password_data.new_password)
    
    # Update password
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "password_hash": new_password_hash,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Password changed successfully"}

# ==================== SETTINGS ROUTES ====================

@api_router.get("/settings")
async def get_settings(current_user: User = Depends(get_current_user)):
    """Get application settings"""
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "inventory": {
                "near_expiry_days": 30,
                "block_expired_stock": True,
                "allow_near_expiry_sale": True,
                "low_stock_alert_enabled": True
            },
            "billing": {
                "enable_draft_bills": True,
                "auto_print_invoice": False
            },
            "returns": {
                "return_window_days": 7,
                "require_original_bill": False,
                "allow_partial_return": True
            },
            "general": {
                "pharmacy_name": "PharmaCare",
                "currency": "INR",
                "timezone": "Asia/Kolkata"
            }
        }
    return settings

@api_router.put("/settings")
async def update_settings(
    settings_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update application settings - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if settings exist
    existing = await db.settings.find_one({})
    
    if existing:
        # Update existing
        await db.settings.update_one(
            {},
            {
                "$set": {
                    **settings_data,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": current_user.id
                }
            }
        )
    else:
        # Create new
        settings_doc = {
            "id": str(uuid.uuid4()),
            **settings_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user.id
        }
        await db.settings.insert_one(settings_doc)
    
    return {"message": "Settings updated successfully"}

# ==================== ROLES & PERMISSIONS ROUTES ====================

@api_router.get("/permissions")
async def get_all_permissions(current_user: User = Depends(get_current_user)):
    """Get all available permissions - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return ALL_PERMISSIONS

@api_router.get("/roles", response_model=List[Role])
async def get_all_roles(current_user: User = Depends(get_current_user)):
    """Get all roles - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    roles = await db.roles.find({}, {"_id": 0}).to_list(1000)
    return roles

@api_router.post("/roles", response_model=Role)
async def create_role(role_data: RoleCreate, current_user: User = Depends(get_current_user)):
    """Create new custom role - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if role name already exists
    existing_role = await db.roles.find_one({"name": role_data.name})
    if existing_role:
        raise HTTPException(status_code=400, detail="Role name already exists")
    
    # Create role
    role = Role(
        name=role_data.name,
        display_name=role_data.display_name,
        permissions=role_data.permissions,
        is_default=False,
        is_super_admin=False,
        created_by=current_user.id
    )
    
    doc = role.model_dump()
    await db.roles.insert_one(doc)
    
    return role

@api_router.get("/roles/{role_id}", response_model=Role)
async def get_role(role_id: str, current_user: User = Depends(get_current_user)):
    """Get role by ID - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return role

@api_router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update role - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if role exists
    existing_role = await db.roles.find_one({"id": role_id})
    if not existing_role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Cannot edit default roles
    if existing_role.get("is_default", False):
        raise HTTPException(status_code=400, detail="Cannot edit default roles")
    
    # Prepare update data
    update_data = {k: v for k, v in role_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Update role
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    # Get updated role
    updated_role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    return updated_role

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: User = Depends(get_current_user)):
    """Delete custom role - Admin only"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if role exists
    existing_role = await db.roles.find_one({"id": role_id})
    if not existing_role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Cannot delete default roles
    if existing_role.get("is_default", False):
        raise HTTPException(status_code=400, detail="Cannot delete default roles")
    
    # Check if any users have this role
    users_with_role = await db.users.count_documents({"role": existing_role["name"]})
    if users_with_role > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete role. {users_with_role} user(s) are assigned this role"
        )
    
    # Delete role
    await db.roles.delete_one({"id": role_id})
    
    return {"message": "Role deleted successfully"}

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
    
    product = Product(**product_data.model_dump(), created_by=current_user.id, updated_by=current_user.id)
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
            {"brand": {"$regex": search, "$options": "i"}},
            {"manufacturer": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
        
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(10000)
    for prod in products:
        if isinstance(prod['created_at'], str):
            prod['created_at'] = datetime.fromisoformat(prod['created_at'])
        if isinstance(prod['updated_at'], str):
            prod['updated_at'] = datetime.fromisoformat(prod['updated_at'])
        
        # Backward compatibility: normalize old field names to new
        if 'default_mrp' in prod and 'default_mrp_per_unit' not in prod:
            prod['default_mrp_per_unit'] = prod['default_mrp']
        if 'low_stock_threshold' in prod and 'low_stock_threshold_units' not in prod:
            prod['low_stock_threshold_units'] = prod['low_stock_threshold']
        
        # Ensure required fields have defaults
        if 'default_mrp_per_unit' not in prod:
            prod['default_mrp_per_unit'] = prod.get('default_mrp', 0)
        if 'low_stock_threshold_units' not in prod:
            prod['low_stock_threshold_units'] = prod.get('low_stock_threshold', 10)
            
    return products

@api_router.get("/inventory")
async def get_inventory_with_health(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    brand_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get inventory with severity-based sorting and pagination
    Priority: 1) Expired/Out-of-stock 2) Near-expiry/Low-stock 3) Healthy
    Filters: status (out_of_stock, expired, near_expiry, low_stock, healthy), category, brand
    """
    # Get settings
    settings = await db.settings.find_one({}) or {}
    near_expiry_days = settings.get('near_expiry_days', 30)
    
    # Build query
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}}
        ]
    
    if category_filter:
        query["category"] = category_filter
    
    if brand_filter:
        query["brand"] = brand_filter
    
    # Get all products (for severity calculation)
    products = await db.products.find(query, {"_id": 0}).to_list(10000)
    
    # Calculate inventory health for each product
    inventory_items = []
    today = datetime.now(timezone.utc)
    near_expiry_threshold = today + timedelta(days=near_expiry_days)
    
    for product in products:
        # Get all batches for this product
        batches = await db.stock_batches.find(
            {"product_sku": product['sku']}, 
            {"_id": 0}
        ).to_list(1000)
        
        if not batches:
            # Out of stock
            inventory_items.append({
                'product': product,
                'total_qty_units': 0,
                'total_qty_packs': 0,
                'nearest_expiry': None,
                'severity': 1,  # Critical (out of stock)
                'status': 'out_of_stock',
                'batches_count': 0
            })
            continue
        
        # Calculate totals and find nearest expiry
        total_units = 0
        total_packs = 0
        nearest_expiry = None
        has_expired = False
        has_near_expiry = False
        
        for batch in batches:
            qty_packs = batch.get('qty_on_hand', 0)
            units_per_pack = product.get('units_per_pack', 1)
            qty_units = int(qty_packs * units_per_pack)
            
            total_packs += qty_packs
            total_units += qty_units
            
            # Check expiry
            if batch.get('expiry_date'):
                expiry_str = batch['expiry_date']
                try:
                    if isinstance(expiry_str, str):
                        expiry_date = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
                    else:
                        expiry_date = expiry_str
                    
                    if expiry_date < today:
                        has_expired = True
                    elif expiry_date < near_expiry_threshold:
                        has_near_expiry = True
                    
                    if nearest_expiry is None or expiry_date < nearest_expiry:
                        nearest_expiry = expiry_date
                except:
                    pass
        
        # Determine severity and status
        low_stock_threshold = product.get('low_stock_threshold_units', 10)
        
        if total_units == 0:
            severity = 1
            status = 'out_of_stock'
        elif has_expired:
            severity = 1
            status = 'expired'
        elif has_near_expiry:
            severity = 2
            status = 'near_expiry'
        elif total_units <= low_stock_threshold:
            severity = 2
            status = 'low_stock'
        else:
            severity = 3
            status = 'healthy'
        
        inventory_items.append({
            'product': product,
            'total_qty_units': total_units,
            'total_qty_packs': round(total_packs, 2),
            'nearest_expiry': nearest_expiry.isoformat() if nearest_expiry else None,
            'severity': severity,
            'status': status,
            'batches_count': len(batches)
        })
    
    # Apply status filter if provided
    if status_filter:
        inventory_items = [item for item in inventory_items if item['status'] == status_filter]
    
    # Sort by severity (1=critical, 2=warning, 3=healthy), then by expiry, then alphabetically
    inventory_items.sort(key=lambda x: (
        x['severity'],
        x['nearest_expiry'] if x['nearest_expiry'] else '9999-12-31',
        x['product']['name'].lower()
    ))
    
    # Pagination
    total_items = len(inventory_items)
    total_pages = (total_items + page_size - 1) // page_size
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = inventory_items[start_idx:end_idx]
    
    return {
        'items': page_items,
        'pagination': {
            'current_page': page,
            'page_size': page_size,
            'total_items': total_items,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        },
        'summary': {
            'critical_count': sum(1 for item in inventory_items if item['severity'] == 1),
            'warning_count': sum(1 for item in inventory_items if item['severity'] == 2),
            'healthy_count': sum(1 for item in inventory_items if item['severity'] == 3)
        }
    }

@api_router.get("/inventory/filters")
async def get_inventory_filters(current_user: User = Depends(get_current_user)):
    """Get unique categories and brands for filtering"""
    categories = await db.products.distinct("category")
    brands = await db.products.distinct("brand")
    
    # Filter out None/empty values
    categories = [c for c in categories if c]
    brands = [b for b in brands if b]
    
    return {
        "categories": sorted(categories),
        "brands": sorted(brands),
        "statuses": [
            {"value": "out_of_stock", "label": "Out of Stock"},
            {"value": "expired", "label": "Expired"},
            {"value": "near_expiry", "label": "Near Expiry"},
            {"value": "low_stock", "label": "Low Stock"},
            {"value": "healthy", "label": "Healthy"}
        ]
    }

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
        # Backward compatibility for field names
        if 'default_mrp' in product and 'default_mrp_per_unit' not in product:
            product['default_mrp_per_unit'] = product['default_mrp']
        
        # Get batches for this product (FEFO - earliest expiry first)
        batches = await db.stock_batches.find(
            {
                "product_sku": product['sku'],
                "location": location_id,
                "qty_on_hand": {"$gt": 0}
            },
            {"_id": 0}
        ).sort("expiry_date", 1).to_list(10)
        
        if batches:
            # Format batch info
            formatted_batches = []
            total_qty = 0
            
            for batch in batches:
                expiry = batch.get('expiry_date')
                if expiry:
                    if isinstance(expiry, str):
                        expiry = datetime.fromisoformat(expiry)
                    expiry_display = expiry.strftime('%d-%m-%Y')
                    expiry_iso = expiry.isoformat()
                else:
                    expiry_display = 'N/A'
                    expiry_iso = None
                
                units_per_pack = product.get('units_per_pack', 1)
                total_units_in_batch = batch['qty_on_hand'] * units_per_pack
                
                formatted_batches.append({
                    "batch_id": batch['id'],
                    "batch_no": batch['batch_no'],
                    "expiry_date": expiry_display,
                    "expiry_iso": expiry_iso,
                    "qty_on_hand": batch['qty_on_hand'],  # Packs/strips
                    "total_units": total_units_in_batch,  # Individual tablets
                    "mrp": batch['mrp_per_unit'] * units_per_pack,  # Per pack (calculated)
                    "mrp_per_unit": batch['mrp_per_unit'],
                    "cost_price": batch['cost_price_per_unit'] * units_per_pack
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
    update_dict['updated_by'] = current_user.id
    
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
    # Verify product exists by SKU
    product = await db.products.find_one({"sku": batch_data.product_sku}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if batch already exists
    existing = await db.stock_batches.find_one({
        "product_sku": batch_data.product_sku,
        "batch_no": batch_data.batch_no,
        "location": batch_data.location or "default"
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Batch with this number already exists for this product at this location")
    
    data = batch_data.model_dump()
    data['expiry_date'] = datetime.fromisoformat(batch_data.expiry_date)
    if batch_data.manufacture_date:
        data['manufacture_date'] = datetime.fromisoformat(batch_data.manufacture_date)
    if batch_data.received_date:
        data['received_date'] = datetime.fromisoformat(batch_data.received_date)
    
    batch = StockBatch(**data, created_by=current_user.id, updated_by=current_user.id)
    doc = batch.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    doc['expiry_date'] = doc['expiry_date'].isoformat()
    if doc.get('manufacture_date'):
        doc['manufacture_date'] = doc['manufacture_date'].isoformat()
    if doc.get('received_date'):
        doc['received_date'] = doc['received_date'].isoformat()
    await db.stock_batches.insert_one(doc)
    
    # Create opening stock movement (Phase 0 requirement)
    units_per_pack = product.get('units_per_pack', 1)
    qty_units = batch_data.qty_on_hand * units_per_pack
    
    movement = StockMovement(
        product_sku=batch_data.product_sku,
        batch_id=batch.id,
        product_name=product['name'],
        batch_no=batch_data.batch_no,
        qty_delta_units=qty_units,
        movement_type='opening_stock',
        ref_type='opening',
        ref_id=batch.id,
        location=batch_data.location or "default",
        reason="Initial stock entry",
        performed_by=current_user.id
    )
    movement_doc = movement.model_dump()
    movement_doc['performed_at'] = movement_doc['performed_at'].isoformat()
    await db.stock_movements.insert_one(movement_doc)
    
    return batch

@api_router.get("/stock/batches")
async def get_stock_batches(
    product_sku: Optional[str] = None,
    location: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if product_sku:
        query["product_sku"] = product_sku
    if location:
        query["location"] = location
    
    batches = await db.stock_batches.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(10000)
    
    # Enrich with product info and calculate units
    for batch in batches:
        if isinstance(batch.get('created_at'), str):
            batch['created_at'] = datetime.fromisoformat(batch['created_at'])
        if isinstance(batch.get('updated_at'), str):
            batch['updated_at'] = datetime.fromisoformat(batch['updated_at'])
        if isinstance(batch.get('expiry_date'), str):
            batch['expiry_date'] = datetime.fromisoformat(batch['expiry_date'])
        if isinstance(batch.get('manufacture_date'), str):
            batch['manufacture_date'] = datetime.fromisoformat(batch['manufacture_date'])
        if isinstance(batch.get('received_date'), str):
            batch['received_date'] = datetime.fromisoformat(batch['received_date'])
        
        # Add product info - handle legacy batches that may not have product_sku
        product_sku = batch.get('product_sku') or batch.get('product_id')
        if product_sku:
            product = await db.products.find_one({"sku": product_sku}, {"_id": 0, "name": 1, "brand": 1, "sku": 1, "units_per_pack": 1})
            if product:
                batch['product_name'] = product.get('name', '')
                batch['product_brand'] = product.get('brand', '')
                batch['product_sku'] = product.get('sku', '')
                units_per_pack = product.get('units_per_pack', 1)
                batch['total_units'] = batch.get('qty_on_hand', 0) * units_per_pack
            else:
                batch['product_name'] = ''
                batch['product_brand'] = ''
                batch['total_units'] = batch.get('qty_on_hand', 0)
        else:
            batch['product_name'] = ''
            batch['product_brand'] = ''
            batch['total_units'] = batch.get('qty_on_hand', 0)
    
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

@api_router.post("/batches/{batch_id}/adjust")
async def adjust_stock(
    batch_id: str,
    adjustment: StockAdjustment,
    current_user: User = Depends(get_current_user)
):
    """
    Adjust stock for a batch - Phase 0 requirement
    Supports adding or removing units with reason tracking
    """
    # Get batch
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Get product for units_per_pack
    product = await db.products.find_one({"sku": batch['product_sku']}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    units_per_pack = product.get('units_per_pack', 1)
    
    # Calculate pack change from unit change
    qty_delta_units = adjustment.qty_units if adjustment.adjustment_type == 'add' else -adjustment.qty_units
    pack_delta = qty_delta_units / units_per_pack
    
    # Calculate new quantity
    new_qty = batch['qty_on_hand'] + pack_delta
    
    # Validation: cannot go negative
    if new_qty < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot remove {adjustment.qty_units} units. Only {int(batch['qty_on_hand'] * units_per_pack)} units available."
        )
    
    # Update batch
    result = await db.stock_batches.update_one(
        {"id": batch_id},
        {
            "$set": {
                "qty_on_hand": new_qty,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.id
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Create stock movement record
    movement = StockMovement(
        product_sku=batch['product_sku'],
        batch_id=batch_id,
        product_name=product['name'],
        batch_no=batch['batch_no'],
        qty_delta_units=qty_delta_units,
        movement_type='adjustment',
        ref_type='adjustment',
        ref_id=str(uuid.uuid4()),  # Generate adjustment ID
        location=batch.get('location', 'default'),
        reason=adjustment.reason,
        performed_by=current_user.id
    )
    
    movement_doc = movement.model_dump()
    movement_doc['performed_at'] = movement_doc['performed_at'].isoformat()
    movement_doc['reference_number'] = adjustment.reference_number
    movement_doc['notes'] = adjustment.notes
    await db.stock_movements.insert_one(movement_doc)
    
    return {
        "message": "Stock adjusted successfully",
        "new_qty_packs": new_qty,
        "new_qty_units": int(new_qty * units_per_pack),
        "adjustment_units": qty_delta_units
    }

@api_router.post("/batches/{batch_id}/writeoff-expiry")
async def writeoff_expired_batch(
    batch_id: str,
    writeoff_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Write off expired stock - removes expired inventory"""
    # Get batch
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Get product
    product = await db.products.find_one({"sku": batch['product_sku']}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Verify batch is expired
    expiry_str = batch.get('expiry_date')
    if expiry_str:
        try:
            if isinstance(expiry_str, str):
                expiry_date = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
            else:
                expiry_date = expiry_str
            
            if expiry_date >= datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Batch is not expired yet")
        except:
            pass
    
    # Get current quantity
    qty_on_hand = batch.get('qty_on_hand', 0)
    units_per_pack = product.get('units_per_pack', 1)
    qty_units = int(qty_on_hand * units_per_pack)
    
    if qty_units <= 0:
        raise HTTPException(status_code=400, detail="No stock to write off")
    
    # Set quantity to 0
    await db.stock_batches.update_one(
        {"id": batch_id},
        {
            "$set": {
                "qty_on_hand": 0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.id,
                "status": "written_off"
            }
        }
    )
    
    # Create stock movement for expiry write-off
    movement = StockMovement(
        product_sku=batch['product_sku'],
        batch_id=batch_id,
        product_name=product['name'],
        batch_no=batch['batch_no'],
        qty_delta_units=-qty_units,  # Negative for removal
        movement_type='expiry_writeoff',
        ref_type='writeoff',
        ref_id=str(uuid.uuid4()),
        location=batch.get('location', 'default'),
        reason=writeoff_data.get('reason', 'Expired stock write-off'),
        performed_by=current_user.id
    )
    
    movement_doc = movement.model_dump()
    movement_doc['performed_at'] = movement_doc['performed_at'].isoformat()
    await db.stock_movements.insert_one(movement_doc)
    
    return {
        "message": "Expired stock written off successfully",
        "qty_written_off_units": qty_units,
        "batch_id": batch_id
    }

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
    """Create a stock movement record - Phase 0"""
    movement = StockMovement(
        **movement_data.model_dump(),
        performed_by=current_user.id
    )
    
    movement_doc = movement.model_dump()
    movement_doc['performed_at'] = movement_doc['performed_at'].isoformat()
    await db.stock_movements.insert_one(movement_doc)
    
    return {"message": "Stock movement recorded", "id": movement.id}

@api_router.get("/stock-movements")
async def get_stock_movements(
    product_sku: Optional[str] = None,
    batch_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get stock movements with filters - Phase 0 Stock Ledger"""
    query = {}
    if product_sku:
        query["product_sku"] = product_sku
    if batch_id:
        query["batch_id"] = batch_id
    if movement_type:
        query["movement_type"] = movement_type
    
    movements = await db.stock_movements.find(query, {"_id": 0}).sort("performed_at", -1).limit(limit).to_list(limit)
    
    for movement in movements:
        if isinstance(movement.get('performed_at'), str):
            movement['performed_at'] = datetime.fromisoformat(movement['performed_at'])
    
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
                
                # Get product SKU for the batch
                product_sku = sku
                
                batch = StockBatch(
                    product_sku=product_sku,
                    batch_no=med.get('batch_number', 'BATCH-001'),
                    expiry_date=expiry,
                    qty_on_hand=med.get('quantity', 0),
                    cost_price_per_unit=med.get('purchase_rate', 0),
                    mrp_per_unit=med.get('mrp', 0),
                    supplier_name=med.get('supplier_name'),
                    location="default"
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
    # Note: line_total from frontend already includes per-item GST
    # So subtotal here is actually total with tax included
    subtotal = sum(item.get('line_total', item.get('total', 0)) for item in bill_data.items)
    
    # Calculate tax amount for records (approximate - items may have different rates)
    # This is informational only since line_total already has tax
    tax_amount = 0
    for item in bill_data.items:
        base_amt = item.get('unit_price', item.get('mrp', 0)) * item.get('quantity', 0) - item.get('discount', 0)
        gst_pct = item.get('gst_percent', bill_data.tax_rate or 5)
        tax_amount += base_amt * (gst_pct / 100)
    
    total_amount = subtotal - (bill_data.discount or 0)  # Don't add tax again, it's in line_total
    
    # Calculate paid and due amounts
    paid_amount = 0
    if bill_data.payments:
        # Multiple payments provided - handle both dict and object formats
        for p in bill_data.payments:
            if isinstance(p, dict):
                paid_amount += p.get('amount', 0)
            else:
                paid_amount += getattr(p, 'amount', 0)
    elif bill_data.refund and bill_data.invoice_type == "SALES_RETURN":
        # For returns, treat refund amount as "paid"
        if isinstance(bill_data.refund, dict):
            paid_amount = bill_data.refund.get('amount', total_amount)
        else:
            paid_amount = getattr(bill_data.refund, 'amount', total_amount)
    elif bill_data.payment_method:
        # Legacy: single payment method, assume full payment
        paid_amount = total_amount if bill_data.status == "paid" else 0
    
    due_amount = max(0, total_amount - paid_amount)
    
    # Determine status based on payments
    if bill_data.status == "draft":
        status = "draft"
    elif bill_data.invoice_type == "SALES_RETURN" and bill_data.refund:
        # For returns with refund data, mark as paid/refunded
        status = "paid"
    elif abs(due_amount) < 0.01:  # Allow for small rounding differences
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
            # Support both old (product_id) and new (product_sku) lookups
            product = await db.products.find_one({"id": product_id}, {"_id": 0})
            if not product:
                # Try finding by SKU if ID lookup failed
                batch_doc = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
                if batch_doc and 'product_sku' in batch_doc:
                    product = await db.products.find_one({"sku": batch_doc['product_sku']}, {"_id": 0})
            
            if not product:
                logger.error(f"Product {product_id} not found")
                continue
            
            units_per_pack = product.get('units_per_pack', 1)
            product_sku = product.get('sku')
            
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
            
            # Create stock movement record (Phase 0 compliant)
            batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
            
            # Convert pack change to units for stock movement
            qty_delta_units = int(pack_change * units_per_pack)
            
            movement = StockMovement(
                product_sku=product_sku,
                batch_id=batch_id,
                product_name=product['name'] if product else item.get('product_name', item.get('medicine_name', 'Unknown')),
                batch_no=batch['batch_no'] if batch else item.get('batch_no', item.get('batch_number', 'N/A')),
                qty_delta_units=qty_delta_units,  # Phase 0: quantity in units
                movement_type="sale" if bill_data.invoice_type == "SALE" else "sales_return",
                ref_type="invoice",  # Phase 0: ref_type instead of ref_entity
                ref_id=bill.id,
                location=batch.get('location', 'default') if batch else "default",
                performed_by=current_user.id
            )
            movement_doc = movement.model_dump()
            movement_doc['performed_at'] = movement_doc['performed_at'].isoformat()
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

@api_router.put("/bills/{bill_id}")
async def update_bill(
    bill_id: str,
    bill_data: BillCreate,
    current_user: User = Depends(get_current_user)
):
    """Update a draft bill - only drafts can be modified"""
    existing_bill = await db.bills.find_one({"id": bill_id})
    
    if not existing_bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if existing_bill.get('status') != 'draft':
        raise HTTPException(status_code=400, detail="Only draft bills can be edited")
    
    # Calculate totals
    items = []
    subtotal = 0
    total_discount = bill_data.discount or 0
    total_tax = 0
    
    for item_data in bill_data.items:
        item = BillItem(**item_data.dict() if hasattr(item_data, 'dict') else item_data)
        items.append(item)
        subtotal += item.mrp * item.quantity
        total_discount += item.discount
        total_tax += (item.mrp * item.quantity - item.discount) * (item.gst_percent or 5) / 100
    
    total_amount = subtotal - total_discount + total_tax
    
    # Update bill
    update_data = {
        "customer_name": bill_data.customer_name or "Counter Sale",
        "customer_mobile": bill_data.customer_mobile,
        "doctor_name": bill_data.doctor_name,
        "items": [item.model_dump() for item in items],
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "total_tax": round(total_tax, 2),
        "total_amount": round(total_amount, 2),
        "discount": bill_data.discount or 0,
        "status": bill_data.status or "draft",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id
    }
    
    # Handle status change to paid
    if bill_data.status == "paid" and existing_bill.get('status') == 'draft':
        # Process payments
        if bill_data.payments:
            paid_amount = sum(p.get('amount', 0) if isinstance(p, dict) else p.amount for p in bill_data.payments)
            update_data["paid_amount"] = round(paid_amount, 2)
            update_data["due_amount"] = round(max(0, total_amount - paid_amount), 2)
            
            # Save payment records
            for payment_data in bill_data.payments:
                payment = Payment(
                    invoice_id=bill_id,
                    amount=payment_data.get('amount', 0) if isinstance(payment_data, dict) else payment_data.amount,
                    payment_method=payment_data.get('method', 'cash') if isinstance(payment_data, dict) else payment_data.method,
                    reference_number=payment_data.get('reference') if isinstance(payment_data, dict) else payment_data.reference,
                    created_by=current_user.id
                )
                payment_doc = payment.model_dump()
                payment_doc['created_at'] = payment_doc['created_at'].isoformat()
                await db.payments.insert_one(payment_doc)
        
        # Deduct stock for SALE
        if existing_bill.get('invoice_type') == 'SALE':
            for item in items:
                batch_id = item.batch_id
                if batch_id:
                    batch = await db.stock_batches.find_one({"id": batch_id})
                    if batch:
                        new_qty = batch.get('qty_on_hand', 0) - item.quantity
                        await db.stock_batches.update_one(
                            {"id": batch_id},
                            {"$set": {"qty_on_hand": new_qty}}
                        )
                        
                        # Record stock movement
                        movement = StockMovement(
                            product_sku=batch.get('product_sku', ''),
                            batch_id=batch_id,
                            movement_type="sale",
                            qty_delta_units=-item.quantity,
                            reason=f"Bill {existing_bill.get('bill_number')}",
                            ref_id=bill_id,
                            performed_by=current_user.id
                        )
                        movement_doc = movement.model_dump()
                        movement_doc['performed_at'] = movement_doc['performed_at'].isoformat()
                        await db.stock_movements.insert_one(movement_doc)
    
    await db.bills.update_one({"id": bill_id}, {"$set": update_data})
    
    # Return updated bill
    updated_bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    return updated_bill

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


# ==================== PURCHASE ROUTES (MOVED TO END OF FILE) ====================

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

@api_router.get("/reports/gst")
async def get_gst_report(
    start_date: str,
    end_date: str,
    current_user: User = Depends(get_current_user)
):
    """Generate GST report for given date range"""
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    # Sales GST (Output Tax)
    bills = await db.bills.find({
        "status": "paid",
        "created_at": {
            "$gte": start.isoformat(),
            "$lte": end.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Group sales by GST rate
    sales_by_gst = {}
    for bill in bills:
        for item in bill.get('items', []):
            gst_rate = item.get('gst_percent', 0)
            qty = item.get('quantity', 0)
            mrp = item.get('mrp', 0)
            
            taxable_amount = qty * mrp / (1 + gst_rate/100)
            gst_amount = taxable_amount * (gst_rate/100)
            
            if gst_rate not in sales_by_gst:
                sales_by_gst[gst_rate] = {
                    'gst_rate': gst_rate,
                    'taxable_amount': 0,
                    'cgst': 0,
                    'sgst': 0,
                    'igst': 0,
                    'total_gst': 0
                }
            
            sales_by_gst[gst_rate]['taxable_amount'] += taxable_amount
            sales_by_gst[gst_rate]['cgst'] += gst_amount / 2
            sales_by_gst[gst_rate]['sgst'] += gst_amount / 2
            sales_by_gst[gst_rate]['total_gst'] += gst_amount
    
    # Purchases GST (Input Tax Credit)
    purchases = await db.purchases.find({
        "status": "confirmed",
        "purchase_date": {
            "$gte": start.isoformat(),
            "$lte": end.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Group purchases by GST rate
    purchases_by_gst = {}
    for purchase in purchases:
        for item in purchase.get('items', []):
            gst_rate = item.get('gst_percent', 0)
            qty = item.get('qty_units', 0)
            cost = item.get('cost_price_per_unit', 0)
            
            taxable_amount = qty * cost / (1 + gst_rate/100)
            gst_amount = taxable_amount * (gst_rate/100)
            
            if gst_rate not in purchases_by_gst:
                purchases_by_gst[gst_rate] = {
                    'gst_rate': gst_rate,
                    'taxable_amount': 0,
                    'cgst': 0,
                    'sgst': 0,
                    'igst': 0,
                    'total_gst': 0
                }
            
            purchases_by_gst[gst_rate]['taxable_amount'] += taxable_amount
            purchases_by_gst[gst_rate]['cgst'] += gst_amount / 2
            purchases_by_gst[gst_rate]['sgst'] += gst_amount / 2
            purchases_by_gst[gst_rate]['total_gst'] += gst_amount
    
    # Calculate summaries
    sales_summary = {
        'total_taxable': sum(v['taxable_amount'] for v in sales_by_gst.values()),
        'total_cgst': sum(v['cgst'] for v in sales_by_gst.values()),
        'total_sgst': sum(v['sgst'] for v in sales_by_gst.values()),
        'total_igst': sum(v['igst'] for v in sales_by_gst.values()),
        'total_gst': sum(v['total_gst'] for v in sales_by_gst.values())
    }
    
    purchases_summary = {
        'total_taxable': sum(v['taxable_amount'] for v in purchases_by_gst.values()),
        'total_cgst': sum(v['cgst'] for v in purchases_by_gst.values()),
        'total_sgst': sum(v['sgst'] for v in purchases_by_gst.values()),
        'total_igst': sum(v['igst'] for v in purchases_by_gst.values()),
        'total_gst': sum(v['total_gst'] for v in purchases_by_gst.values())
    }
    
    net_liability = sales_summary['total_gst'] - purchases_summary['total_gst']
    
    return {
        "sales": list(sales_by_gst.values()),
        "purchases": list(purchases_by_gst.values()),
        "sales_summary": sales_summary,
        "purchases_summary": purchases_summary,
        "net_liability": round(net_liability, 2),
        "period": {
            "start_date": start_date,
            "end_date": end_date
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

@api_router.get("/analytics/dashboard")
async def get_dashboard_analytics(current_user: User = Depends(get_current_user)):
    """Comprehensive dashboard analytics endpoint"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = today_start.replace(day=1)
        yesterday_start = today_start - timedelta(days=1)
        last_week_start = week_start - timedelta(days=7)
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        
        # Fetch all data in parallel
        all_bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
        all_products = await db.products.find({}, {"_id": 0}).to_list(10000)
        all_batches = await db.stock_batches.find({}, {"_id": 0}).to_list(10000)
        all_customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
        
        # Initialize metrics
        today_sales = 0
        yesterday_sales = 0
        week_sales = 0
        last_week_sales = 0
        month_sales = 0
        last_month_sales = 0
        total_sales = 0
        pending_payments = 0
        draft_bills = 0
        month_returns = 0
        
        # Sales by category and product
        category_sales = {}
        product_sales = {}
        customer_sales = {}
        
        # Daily trend (last 30 days)
        daily_sales = {}
        for i in range(30):
            date_key = (today_start - timedelta(days=i)).strftime('%Y-%m-%d')
            daily_sales[date_key] = {'sales': 0, 'returns': 0, 'bills': 0}
        
        # Recent bills
        recent_bills = []
        
        for bill in all_bills:
            try:
                created_at = bill.get('created_at')
                if not created_at:
                    continue
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                invoice_type = bill.get('invoice_type', 'SALE')
                status = bill.get('status', 'paid')
                amount = bill.get('total_amount', 0) or 0
                
                # Count drafts and pending
                if status == 'draft':
                    draft_bills += 1
                    continue
                elif status == 'due':
                    pending_payments += amount
                
                # Process sales
                if invoice_type == 'SALE' and status in ['paid', 'due']:
                    total_sales += amount
                    
                    # Time-based sales
                    if created_at >= today_start:
                        today_sales += amount
                    if created_at >= yesterday_start and created_at < today_start:
                        yesterday_sales += amount
                    if created_at >= week_start:
                        week_sales += amount
                    if created_at >= last_week_start and created_at < week_start:
                        last_week_sales += amount
                    if created_at >= month_start:
                        month_sales += amount
                    if created_at >= last_month_start and created_at < month_start:
                        last_month_sales += amount
                    
                    # Daily trend
                    date_key = created_at.strftime('%Y-%m-%d')
                    if date_key in daily_sales:
                        daily_sales[date_key]['sales'] += amount
                        daily_sales[date_key]['bills'] += 1
                    
                    # Product and category sales
                    for item in bill.get('items', []):
                        product_sku = item.get('product_sku') or item.get('product_id', '')
                        product_name = item.get('product_name', 'Unknown')
                        line_total = item.get('line_total') or item.get('total', 0) or 0
                        
                        if product_sku not in product_sales:
                            product_sales[product_sku] = {'name': product_name, 'revenue': 0, 'qty': 0}
                        product_sales[product_sku]['revenue'] += line_total
                        product_sales[product_sku]['qty'] += item.get('quantity', 0)
                    
                    # Customer sales
                    customer_name = bill.get('customer_name', 'Walk-in')
                    if customer_name:
                        if customer_name not in customer_sales:
                            customer_sales[customer_name] = {'revenue': 0, 'bills': 0}
                        customer_sales[customer_name]['revenue'] += amount
                        customer_sales[customer_name]['bills'] += 1
                    
                    # Recent bills (last 10)
                    if len(recent_bills) < 10:
                        recent_bills.append({
                            'id': bill.get('id'),
                            'bill_number': bill.get('bill_number'),
                            'customer_name': bill.get('customer_name', 'Walk-in'),
                            'amount': amount,
                            'status': status,
                            'created_at': created_at.isoformat()
                        })
                
                # Process returns
                elif invoice_type == 'SALES_RETURN' and status in ['paid', 'refunded']:
                    if created_at >= month_start:
                        month_returns += amount
                    
                    date_key = created_at.strftime('%Y-%m-%d')
                    if date_key in daily_sales:
                        daily_sales[date_key]['returns'] += amount
                        
            except Exception as e:
                logger.warning(f"Dashboard analytics bill error: {e}")
                continue
        
        # Sort recent bills by date (newest first)
        recent_bills.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Calculate percentage changes
        def calc_change(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round((current - previous) / previous * 100, 1)
        
        today_change = calc_change(today_sales, yesterday_sales)
        week_change = calc_change(week_sales, last_week_sales)
        month_change = calc_change(month_sales, last_month_sales)
        
        # Top 5 products
        top_products = sorted(product_sales.items(), key=lambda x: x[1]['revenue'], reverse=True)[:5]
        top_products_list = [
            {'sku': sku, 'name': data['name'], 'revenue': round(data['revenue'], 2), 'qty': data['qty']}
            for sku, data in top_products
        ]
        
        # Top 5 customers
        top_customers = sorted(customer_sales.items(), key=lambda x: x[1]['revenue'], reverse=True)[:5]
        top_customers_list = [
            {'name': name, 'revenue': round(data['revenue'], 2), 'bills': data['bills']}
            for name, data in top_customers
        ]
        
        # Category-wise sales (from products)
        for product in all_products:
            category = product.get('category', 'Uncategorized') or 'Uncategorized'
            sku = product.get('sku', '')
            if sku in product_sales:
                if category not in category_sales:
                    category_sales[category] = 0
                category_sales[category] += product_sales[sku]['revenue']
        
        category_sales_list = [
            {'category': cat, 'revenue': round(rev, 2)}
            for cat, rev in sorted(category_sales.items(), key=lambda x: x[1], reverse=True)[:6]
        ]
        
        # Daily trend (sorted by date)
        daily_trend = [
            {'date': date, 'sales': round(data['sales'], 2), 'returns': round(data['returns'], 2), 'bills': data['bills']}
            for date, data in sorted(daily_sales.items())
        ]
        
        # Inventory stats
        total_products = len(all_products)
        total_stock_value = 0
        low_stock_items = []
        expiring_items = []
        thirty_days = now + timedelta(days=30)
        
        # Build product lookup
        product_lookup = {p['sku']: p for p in all_products}
        
        for batch in all_batches:
            try:
                qty = batch.get('qty_on_hand', 0)
                cost = batch.get('cost_price_per_unit', 0)
                total_stock_value += qty * cost
                
                product_sku = batch.get('product_sku', '')
                product = product_lookup.get(product_sku, {})
                product_name = product.get('name', batch.get('product_name', 'Unknown'))
                
                # Low stock (less than 10 units)
                if qty > 0 and qty < 10:
                    low_stock_items.append({
                        'product_name': product_name,
                        'batch_no': batch.get('batch_no', 'N/A'),
                        'qty': qty
                    })
                
                # Expiring soon
                expiry = batch.get('expiry_date')
                if expiry and qty > 0:
                    if isinstance(expiry, str):
                        expiry = datetime.fromisoformat(expiry)
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    
                    if expiry <= thirty_days:
                        expiring_items.append({
                            'product_name': product_name,
                            'batch_no': batch.get('batch_no', 'N/A'),
                            'expiry_date': expiry.strftime('%Y-%m-%d'),
                            'qty': qty
                        })
            except Exception as e:
                logger.warning(f"Dashboard batch error: {e}")
                continue
        
        # Sort alerts
        low_stock_items.sort(key=lambda x: x['qty'])
        expiring_items.sort(key=lambda x: x['expiry_date'])
        
        return {
            # Key metrics
            "metrics": {
                "today_sales": round(today_sales, 2),
                "today_change": today_change,
                "week_sales": round(week_sales, 2),
                "week_change": week_change,
                "month_sales": round(month_sales, 2),
                "month_change": month_change,
                "total_sales": round(total_sales, 2)
            },
            # Charts data
            "daily_trend": daily_trend[-14:],  # Last 14 days
            "category_sales": category_sales_list,
            # Business insights
            "top_products": top_products_list,
            "top_customers": top_customers_list,
            # Alerts
            "low_stock": low_stock_items[:5],
            "expiring_soon": expiring_items[:5],
            "recent_bills": recent_bills[:5],
            # Quick stats
            "quick_stats": {
                "pending_payments": round(pending_payments, 2),
                "draft_bills": draft_bills,
                "month_returns": round(month_returns, 2),
                "total_products": total_products,
                "stock_value": round(total_stock_value, 2),
                "low_stock_count": len(low_stock_items),
                "expiring_count": len(expiring_items)
            }
        }
    except Exception as e:
        logger.error(f"Dashboard analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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


# ==================== SUPPLIER ROUTES ====================

@api_router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all suppliers with optional search"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"contact_name": {"$regex": search, "$options": "i"}},
            {"gstin": {"$regex": search, "$options": "i"}}
        ]
    
    suppliers = await db.suppliers.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    for supplier in suppliers:
        if isinstance(supplier.get('created_at'), str):
            supplier['created_at'] = datetime.fromisoformat(supplier['created_at'])
        if isinstance(supplier.get('updated_at'), str):
            supplier['updated_at'] = datetime.fromisoformat(supplier['updated_at'])
    return suppliers

@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(
    supplier_data: SupplierCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new supplier"""
    # Check if supplier with same name exists
    existing = await db.suppliers.find_one({"name": supplier_data.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")
    
    supplier = Supplier(**supplier_data.model_dump())
    doc = supplier.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.suppliers.insert_one(doc)
    
    return supplier

@api_router.get("/suppliers/{supplier_id}", response_model=Supplier)
async def get_supplier(
    supplier_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get supplier by ID"""
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    if isinstance(supplier['created_at'], str):
        supplier['created_at'] = datetime.fromisoformat(supplier['created_at'])
    if isinstance(supplier['updated_at'], str):
        supplier['updated_at'] = datetime.fromisoformat(supplier['updated_at'])
    
    return supplier

@api_router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    supplier_data: SupplierUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update supplier"""
    update_dict = {k: v for k, v in supplier_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.suppliers.update_one(
        {"id": supplier_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    return {"message": "Supplier updated successfully"}



# ==================== PURCHASE ROUTES ====================

async def generate_purchase_number():
    """Generate unique purchase number: PUR-2024-0001"""
    current_year = datetime.now(timezone.utc).year
    prefix = f"PUR-{current_year}-"
    
    # Find the last purchase number for this year
    last_purchase = await db.purchases.find_one(
        {"purchase_number": {"$regex": f"^{prefix}"}},
        {"_id": 0, "purchase_number": 1},
        sort=[("purchase_number", -1)]
    )
    
    if last_purchase:
        last_num = int(last_purchase['purchase_number'].split('-')[-1])
        new_num = last_num + 1
    else:
        new_num = 1
    
    return f"{prefix}{new_num:04d}"

@api_router.get("/purchases")
async def get_purchases(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    supplier_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get purchases with filters"""
    query = {}
    
    if from_date:
        query["purchase_date"] = {"$gte": from_date}
    if to_date:
        if "purchase_date" in query:
            query["purchase_date"]["$lte"] = to_date
        else:
            query["purchase_date"] = {"$lte": to_date}
    
    if supplier_id:
        query["supplier_id"] = supplier_id
    
    if status:
        query["status"] = status
    
    if search:
        query["$or"] = [
            {"purchase_number": {"$regex": search, "$options": "i"}},
            {"supplier_name": {"$regex": search, "$options": "i"}},
            {"supplier_invoice_no": {"$regex": search, "$options": "i"}}
        ]
    
    purchases = await db.purchases.find(query, {"_id": 0}).sort("purchase_date", -1).to_list(1000)
    
    # Return as-is without date conversion (dates are stored as ISO strings)
    return purchases

@api_router.post("/purchases")
async def create_purchase(
    purchase_data: PurchaseCreate,
    current_user: User = Depends(get_current_user)
):
    """Create new purchase draft"""
    # Get supplier
    supplier = await db.suppliers.find_one({"id": purchase_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Generate purchase number
    purchase_number = await generate_purchase_number()
    
    # Process items and calculate totals
    items = []
    subtotal = 0
    tax_value = 0
    
    for item_data in purchase_data.items:
        # Get product to check units_per_pack
        product = await db.products.find_one({"sku": item_data.product_sku}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_sku} not found")
        
        # Calculate line total
        line_total = item_data.qty_units * item_data.cost_price_per_unit
        tax_amount = line_total * (item_data.gst_percent / 100)
        
        item_dict = {
            "id": str(uuid.uuid4()),
            "product_sku": item_data.product_sku,
            "product_name": item_data.product_name,
            "batch_no": item_data.batch_no,
            "expiry_date": item_data.expiry_date,  # Keep as string
            "qty_packs": item_data.qty_packs,
            "qty_units": item_data.qty_units,
            "cost_price_per_unit": item_data.cost_price_per_unit,
            "mrp_per_unit": item_data.mrp_per_unit,
            "gst_percent": item_data.gst_percent,
            "line_total": line_total + tax_amount,
            "received_qty_units": 0
        }
        
        items.append(item_dict)
        subtotal += line_total
        tax_value += tax_amount
    
    total_value = subtotal + tax_value
    round_off = round(total_value) - total_value
    total_value = round(total_value)
    
    # Determine status
    status = purchase_data.status if purchase_data.status else "draft"
    
    # Create purchase document directly
    purchase_doc = {
        "id": str(uuid.uuid4()),
        "purchase_number": purchase_number,
        "supplier_id": purchase_data.supplier_id,
        "supplier_name": supplier['name'],
        "purchase_date": purchase_data.purchase_date,
        "supplier_invoice_no": purchase_data.supplier_invoice_no,
        "supplier_invoice_date": purchase_data.supplier_invoice_date,
        "status": status,
        "items": items,
        "subtotal": subtotal,
        "tax_value": tax_value,
        "round_off": round_off,
        "total_value": total_value,
        "payment_terms_days": supplier.get('payment_terms_days', 30),
        "note": purchase_data.note,
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.purchases.insert_one(purchase_doc)
    
    # If status is confirmed, create stock batches
    if status == 'confirmed':
        for item in items:
            # Create stock batch
            batch_doc = {
                "id": str(uuid.uuid4()),
                "product_sku": item['product_sku'],
                "batch_no": item['batch_no'] or f"PUR-{purchase_number[:8]}",
                "expiry_date": item['expiry_date'],
                "qty_on_hand": item['qty_units'],
                "cost_price_per_unit": item['cost_price_per_unit'],
                "mrp_per_unit": item['mrp_per_unit'],
                "location": "default",
                "purchase_id": purchase_doc['id'],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.stock_batches.insert_one(batch_doc)
            
            # Record stock movement
            movement_doc = {
                "id": str(uuid.uuid4()),
                "product_sku": item['product_sku'],
                "batch_id": batch_doc['id'],
                "movement_type": "purchase",
                "qty_delta_units": item['qty_units'],
                "reason": f"Purchase {purchase_number}",
                "ref_id": purchase_doc['id'],
                "performed_by": current_user.id,
                "performed_at": datetime.now(timezone.utc).isoformat()
            }
            await db.stock_movements.insert_one(movement_doc)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "purchase",
        "entity_id": purchase_doc['id'],
        "action": "create",
        "new_value": {"purchase_number": purchase_number, "status": status, "total_value": total_value},
        "performed_by": current_user.id,
        "performed_by_name": current_user.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Return without _id
    purchase_doc.pop('_id', None)
    return purchase_doc

@api_router.put("/purchases/{purchase_id}")
async def update_purchase(
    purchase_id: str,
    purchase_data: PurchaseCreate,
    current_user: User = Depends(get_current_user)
):
    """Update a draft purchase - only drafts can be modified"""
    existing = await db.purchases.find_one({"id": purchase_id})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    if existing.get('status') != 'draft':
        raise HTTPException(status_code=400, detail="Only draft purchases can be edited")
    
    # Get supplier
    supplier = await db.suppliers.find_one({"id": purchase_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Process items and calculate totals
    items = []
    subtotal = 0
    tax_value = 0
    
    for item_data in purchase_data.items:
        product = await db.products.find_one({"sku": item_data.product_sku}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_sku} not found")
        
        line_total = item_data.qty_units * item_data.cost_price_per_unit
        tax_amount = line_total * (item_data.gst_percent / 100)
        
        item = PurchaseItem(
            **item_data.model_dump(),
            line_total=line_total + tax_amount
        )
        
        if item_data.expiry_date:
            item.expiry_date = datetime.fromisoformat(item_data.expiry_date)
        
        items.append(item)
        subtotal += line_total
        tax_value += tax_amount
    
    total_value = subtotal + tax_value
    round_off = round(total_value) - total_value
    total_value = round(total_value)
    
    # Determine status
    status = purchase_data.status if purchase_data.status else "draft"
    
    # Update purchase
    update_data = {
        "supplier_id": purchase_data.supplier_id,
        "supplier_name": supplier['name'],
        "purchase_date": datetime.fromisoformat(purchase_data.purchase_date).isoformat(),
        "supplier_invoice_no": purchase_data.supplier_invoice_no,
        "supplier_invoice_date": datetime.fromisoformat(purchase_data.supplier_invoice_date).isoformat() if purchase_data.supplier_invoice_date else None,
        "items": [item.model_dump() for item in items],
        "subtotal": subtotal,
        "tax_value": tax_value,
        "round_off": round_off,
        "total_value": total_value,
        "status": status,
        "note": purchase_data.note,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id
    }
    
    # Convert item expiry dates
    for item in update_data['items']:
        if item.get('expiry_date'):
            item['expiry_date'] = item['expiry_date'].isoformat() if isinstance(item['expiry_date'], datetime) else item['expiry_date']
    
    await db.purchases.update_one({"id": purchase_id}, {"$set": update_data})
    
    # If status changed to confirmed, create stock batches
    if status == 'confirmed' and existing.get('status') == 'draft':
        for item in items:
            # Create stock batch
            batch = StockBatch(
                product_sku=item.product_sku,
                batch_no=item.batch_no or f"PUR-{existing.get('purchase_number', purchase_id)[:8]}",
                expiry_date=item.expiry_date.isoformat() if item.expiry_date else None,
                qty_on_hand=item.qty_units,
                cost_price_per_unit=item.cost_price_per_unit,
                mrp_per_unit=item.mrp_per_unit,
                location="default",
                purchase_id=purchase_id
            )
            batch_doc = batch.model_dump()
            await db.stock_batches.insert_one(batch_doc)
            
            # Record stock movement
            movement = StockMovement(
                product_sku=item.product_sku,
                batch_id=batch.id,
                movement_type="purchase",
                qty_delta_units=item.qty_units,
                reason=f"Purchase {existing.get('purchase_number', '')}",
                ref_id=purchase_id,
                performed_by=current_user.id
            )
            movement_doc = movement.model_dump()
            movement_doc['performed_at'] = movement_doc['performed_at'].isoformat()
            await db.stock_movements.insert_one(movement_doc)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "purchase",
        "entity_id": purchase_id,
        "action": "update",
        "new_value": {"status": status, "total_value": total_value},
        "performed_by": current_user.id,
        "performed_by_name": current_user.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    updated = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    return updated

@api_router.get("/purchases/{purchase_id}")
async def get_purchase(
    purchase_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get purchase by ID"""
    purchase = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    # Return as-is without date conversion (dates are stored as ISO strings)
    return purchase

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


@app.on_event("startup")
async def startup_db():
    """Initialize database with default roles"""
    # Check if roles collection is empty
    roles_count = await db.roles.count_documents({})
    
    if roles_count == 0:
        # Insert default roles
        for role_data in DEFAULT_ROLES:
            role = Role(**role_data)
            doc = role.model_dump()
            await db.roles.insert_one(doc)
        print("✅ Default roles initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==================== PURCHASE RETURN ROUTES ====================

async def generate_return_number():
    """Generate unique return number: PRET-2024-0001"""
    current_year = datetime.now(timezone.utc).year
    prefix = f"PRET-{current_year}-"
    
    last_return = await db.purchase_returns.find_one(
        {"return_number": {"$regex": f"^{prefix}"}},
        {"_id": 0, "return_number": 1},
        sort=[("return_number", -1)]
    )
    
    if last_return:
        last_num = int(last_return['return_number'].split('-')[-1])
        new_num = last_num + 1
    else:
        new_num = 1
    
    return f"{prefix}{new_num:04d}"

async def generate_credit_number():
    """Generate unique credit number: SCRED-2024-0001"""
    current_year = datetime.now(timezone.utc).year
    prefix = f"SCRED-{current_year}-"
    
    last_credit = await db.supplier_credits.find_one(
        {"credit_number": {"$regex": f"^{prefix}"}},
        {"_id": 0, "credit_number": 1},
        sort=[("credit_number", -1)]
    )
    
    if last_credit:
        last_num = int(last_credit['credit_number'].split('-')[-1])
        new_num = last_num + 1
    else:
        new_num = 1
    
    return f"{prefix}{new_num:04d}"

@api_router.post("/purchase-returns")
async def create_purchase_return(
    return_data: PurchaseReturnCreate,
    current_user: User = Depends(get_current_user)
):
    """Create purchase return"""
    supplier = await db.suppliers.find_one({"id": return_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    purchase_number = None
    original_purchase = None
    if return_data.purchase_id:
        original_purchase = await db.purchases.find_one({"id": return_data.purchase_id}, {"_id": 0})
        if original_purchase:
            purchase_number = original_purchase['purchase_number']
    
    return_number = await generate_return_number()
    
    items = []
    total_value = 0
    
    for item_data in return_data.items:
        # Get qty - handle both qty_units and return_qty_units
        qty_units = item_data.return_qty_units or item_data.qty_units
        
        # Calculate line total
        line_total = qty_units * item_data.cost_price_per_unit
        
        item_doc = {
            "id": str(uuid.uuid4()),
            "product_sku": item_data.product_sku,
            "product_name": item_data.product_name,
            "batch_id": item_data.batch_id,
            "batch_no": item_data.batch_no,
            "qty_units": qty_units,
            "cost_price_per_unit": item_data.cost_price_per_unit,
            "reason": item_data.reason or return_data.reason or "return",
            "line_total": line_total
        }
        
        items.append(item_doc)
        total_value += line_total
    
    # Create return document
    return_doc = {
        "id": str(uuid.uuid4()),
        "return_number": return_number,
        "supplier_id": return_data.supplier_id,
        "supplier_name": supplier['name'],
        "purchase_id": return_data.purchase_id,
        "purchase_number": purchase_number,
        "return_date": return_data.return_date,
        "status": "pending",
        "items": items,
        "total_value": total_value,
        "note": return_data.note or return_data.notes,
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.purchase_returns.insert_one(return_doc)
    
    # Remove _id before returning
    return_doc.pop('_id', None)
    return return_doc

@api_router.get("/purchase-returns")
async def get_purchase_returns(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    supplier_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get purchase returns with filters"""
    query = {}
    
    if from_date:
        query["return_date"] = {"$gte": from_date}
    if to_date:
        if "return_date" in query:
            query["return_date"]["$lte"] = to_date
        else:
            query["return_date"] = {"$lte": to_date}
    
    if supplier_id:
        query["supplier_id"] = supplier_id
    
    if status:
        query["status"] = status
    
    returns = await db.purchase_returns.find(query, {"_id": 0}).sort("return_date", -1).to_list(1000)
    
    # Return as-is without date conversion
    return returns

@api_router.get("/purchase-returns/{return_id}")
async def get_purchase_return(
    return_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get single purchase return by ID"""
    purchase_return = await db.purchase_returns.find_one({"id": return_id}, {"_id": 0})
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")
    
    # Return as-is without date conversion
    return purchase_return

@api_router.post("/purchase-returns/{return_id}/confirm")
async def confirm_purchase_return(
    return_id: str,
    current_user: User = Depends(get_current_user)
):
    """Confirm purchase return: deduct stock, create movements, create supplier credit"""
    purchase_return = await db.purchase_returns.find_one({"id": return_id}, {"_id": 0})
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")
    
    # Allow confirming from both 'draft' and 'pending' status
    if purchase_return['status'] == 'confirmed':
        raise HTTPException(status_code=400, detail="Return is already confirmed")
    
    stock_movements = []
    
    for item in purchase_return['items']:
        qty_units = item.get('qty_units') or item.get('return_qty_units', 0)
        
        # Try to find batch by batch_id or by batch_no and product
        batch = None
        if item.get('batch_id'):
            batch = await db.stock_batches.find_one({"id": item['batch_id']}, {"_id": 0})
        elif item.get('batch_no'):
            batch = await db.stock_batches.find_one({
                "product_sku": item['product_sku'],
                "batch_no": item['batch_no']
            }, {"_id": 0})
        
        if not batch:
            # Find any batch for this product
            batch = await db.stock_batches.find_one({"product_sku": item['product_sku']}, {"_id": 0})
        
        if batch:
            product = await db.products.find_one({"sku": item['product_sku']}, {"_id": 0})
            units_per_pack = product.get('units_per_pack', 1) if product else 1
            qty_packs = qty_units / units_per_pack
            
            if batch['qty_on_hand'] >= qty_packs:
                new_qty = batch['qty_on_hand'] - qty_packs
                
                await db.stock_batches.update_one(
                    {"id": batch['id']},
                    {"$set": {"qty_on_hand": new_qty, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id}}
                )
                
                movement = {
                    "id": str(uuid.uuid4()),
                    "product_sku": item['product_sku'],
                    "batch_id": batch['id'],
                    "product_name": item['product_name'],
                    "batch_no": item.get('batch_no') or batch['batch_no'],
                    "qty_delta_units": -qty_units,
                    "movement_type": "purchase_return",
                    "ref_type": "purchase_return",
                    "ref_id": return_id,
                    "location": "default",
                    "reason": f"Purchase return - {item.get('reason', 'return')}",
                    "performed_by": current_user.id,
                    "performed_at": datetime.now(timezone.utc).isoformat()
                }
                
                await db.stock_movements.insert_one(movement)
                stock_movements.append(movement)
            else:
                logger.warning(f"Insufficient stock for return: {item['product_sku']}")
        else:
            logger.warning(f"No batch found for product: {item['product_sku']}")
    
    # Create supplier credit
    credit_number = await generate_credit_number()
    
    credit_doc = {
        "id": str(uuid.uuid4()),
        "supplier_id": purchase_return['supplier_id'],
        "supplier_name": purchase_return['supplier_name'],
        "credit_number": credit_number,
        "amount": purchase_return['total_value'],
        "reference": return_id,
        "reference_type": "purchase_return",
        "status": "active",
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.supplier_credits.insert_one(credit_doc)
    
    await db.purchase_returns.update_one(
        {"id": return_id},
        {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc).isoformat(), "confirmed_by": current_user.id}}
    )
    
    return {
        "message": "Purchase return confirmed successfully",
        "credit_number": credit_number,
        "credit_amount": purchase_return['total_value'],
        "stock_movements_created": len(stock_movements)
    }

@api_router.get("/analytics/purchases")
async def get_purchase_analytics(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get purchase analytics"""
    query = {}
    if from_date:
        query["purchase_date"] = {"$gte": from_date}
    if to_date:
        if "purchase_date" in query:
            query["purchase_date"]["$lte"] = to_date
        else:
            query["purchase_date"] = {"$lte": to_date}
    
    query["status"] = {"$nin": ["cancelled", "draft"]}
    purchases = await db.purchases.find(query, {"_id": 0}).to_list(10000)
    total_purchases_value = sum(p.get('total_value', 0) for p in purchases)
    
    return_query = {}
    if from_date:
        return_query["return_date"] = {"$gte": from_date}
    if to_date:
        if "return_date" in return_query:
            return_query["return_date"]["$lte"] = to_date
        else:
            return_query["return_date"] = {"$lte": to_date}
    
    return_query["status"] = "confirmed"
    purchase_returns = await db.purchase_returns.find(return_query, {"_id": 0}).to_list(10000)
    total_purchase_returns_value = sum(r.get('total_value', 0) for r in purchase_returns)
    
    net_purchases = total_purchases_value - total_purchase_returns_value
    
    return {
        "total_purchases_value": total_purchases_value,
        "total_purchase_returns_value": total_purchase_returns_value,
        "net_purchases": net_purchases,
        "total_purchases_count": len(purchases),
        "total_returns_count": len(purchase_returns)
    }

# Include the API router in the app (must be after all routes are defined)
app.include_router(api_router)