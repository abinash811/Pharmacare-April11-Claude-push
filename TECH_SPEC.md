# PharmaCare - Technical Specification Document

## 1. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| React Router | 6.x | Client-side routing |
| Axios | 1.x | HTTP client |
| Tailwind CSS | 3.x | Styling |
| Shadcn/UI | - | Component library |
| Sonner | - | Toast notifications |
| Lucide React | - | Icons |
| Material Icons | - | Google Material icons |
| SheetJS (xlsx) | - | Excel export/import |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Runtime |
| FastAPI | 0.100+ | REST API framework |
| Motor | 3.x | Async MongoDB driver |
| Pydantic | 2.x | Data validation |
| Passlib + JWT | - | Authentication |
| Pandas | 2.x | Excel processing |
| OpenPyXL | 3.x | Excel file handling |

### Database
| Technology | Purpose |
|------------|---------|
| MongoDB | Primary database (NoSQL) |

### Infrastructure
| Component | Details |
|-----------|---------|
| Frontend Port | 3000 (hot reload enabled) |
| Backend Port | 8000 (uvicorn, PostgreSQL) · 8001 reserved for legacy server.py |
| API Prefix | `/api/*` routes to backend |
| Process Manager | Supervisor |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │Dashboard│  │ Billing │  │Inventory│  │Purchases│  ...       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       └────────────┴────────────┴────────────┘                  │
│                          │                                      │
│                    Axios HTTP Client                            │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTPS (JWT Auth)
┌──────────────────────────┼──────────────────────────────────────┐
│                    BACKEND (FastAPI)                            │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────┐              │
│  │              API Router (/api/*)              │              │
│  ├───────────┬───────────┬───────────┬───────────┤              │
│  │   Auth    │  Products │   Bills   │ Purchases │  ...        │
│  │  Routes   │  Routes   │  Routes   │  Routes   │              │
│  └─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┘              │
│        └───────────┴───────────┴───────────┘                    │
│                          │                                      │
│                    Motor (Async)                                │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     MongoDB Database                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  users  │ │products │ │  bills  │ │purchases│ │customers│   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │suppliers│ │ doctors │ │ batches │ │movements│  ...          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication Flow

```
1. Login Request
   POST /api/auth/login { email, password }
   
2. Server validates credentials (bcrypt hash comparison)
   
3. Server returns JWT token (24h expiry)
   { token: "eyJhbG...", user: {...} }
   
4. Frontend stores token in localStorage
   
5. All subsequent requests include:
   Header: Authorization: Bearer <token>
   
6. Backend middleware validates JWT on protected routes
```

---

## 4. Core Modules

### 4.1 Billing Module
**Pages:** `BillingOperations.js`, `BillingWorkspace.js`, `BillDetail.js`

| Feature | Endpoint | Method |
|---------|----------|--------|
| List bills | `/api/bills` | GET |
| Create bill | `/api/bills` | POST |
| View bill | `/api/bills/{id}` | GET |
| Search products | `/api/products/search-with-batches` | GET |

**Key Flow:**
```
Search Product → Select Batch (FEFO) → Add to Cart → Apply Discounts → Save Bill → Update Stock
```

### 4.2 Inventory Module
**Pages:** `InventoryV2.js`, `ExcelBulkUploadWizard.js`

| Feature | Endpoint | Method |
|---------|----------|--------|
| List inventory | `/api/inventory` | GET |
| Add product | `/api/products` | POST |
| Add batch | `/api/batches` | POST |
| Bulk upload | `/api/inventory/bulk-upload/*` | POST |
| Write-off | `/api/batches/{id}/writeoff-expiry` | POST |

**Stock Management:**
- Products have multiple batches
- Each batch tracks: quantity, expiry, MRP, cost price
- FEFO (First Expiry First Out) for billing
- Severity sorting: Critical (expired/out) → Warning (low/expiring) → Healthy

### 4.3 Purchases Module
**Pages:** `PurchasesList.js`, `PurchaseNew.js`, `PurchaseDetail.js`

| Feature | Endpoint | Method |
|---------|----------|--------|
| List purchases | `/api/purchases` | GET |
| Create purchase | `/api/purchases` | POST |
| Purchase returns | `/api/purchase-returns` | GET/POST |

### 4.4 Customer/Supplier Module
**Pages:** `Customers.js`, `Suppliers.js`

| Feature | Endpoint | Method |
|---------|----------|--------|
| List customers | `/api/customers` | GET |
| List doctors | `/api/doctors` | GET |
| List suppliers | `/api/suppliers` | GET |

---

## 5. Database Schema (MongoDB Collections)

### users
```javascript
{
  id: UUID,
  email: String (unique),
  password_hash: String,
  name: String,
  role: "admin" | "manager" | "cashier",
  is_active: Boolean,
  created_at: ISODate
}
```

### products
```javascript
{
  id: UUID,
  sku: String (unique),
  name: String,
  brand: String,
  category: String,
  default_mrp_per_unit: Number,
  gst_percent: Number,
  hsn_code: String,
  units_per_pack: Number,
  low_stock_threshold_units: Number,
  status: "active" | "inactive"
}
```

### stock_batches
```javascript
{
  id: UUID,
  product_sku: String (indexed),
  batch_no: String,
  expiry_date: ISODate (indexed),
  qty_on_hand: Number,
  cost_price_per_unit: Number,
  mrp_per_unit: Number,
  location: String
}
```

### bills
```javascript
{
  id: UUID,
  bill_number: String (unique),
  invoice_type: "SALE" | "SALES_RETURN",
  customer_name: String,
  customer_phone: String,
  doctor_name: String,
  items: Array[{
    product_sku, product_name, batch_no,
    quantity, unit_price, discount_percent,
    gst_percent, line_total
  }],
  subtotal: Number,
  total_discount: Number,
  total_gst: Number,
  grand_total: Number,
  payment_method: "cash" | "card" | "upi" | "credit",
  status: "paid" | "due" | "draft" | "cancelled",
  created_at: ISODate
}
```

### purchases
```javascript
{
  id: UUID,
  purchase_number: String,
  supplier_id: UUID,
  supplier_name: String,
  supplier_invoice_no: String,
  purchase_date: ISODate,
  items: Array[{...}],
  total_value: Number,
  status: "draft" | "confirmed" | "received"
}
```

---

## 6. API Design Patterns

### Pagination (All list endpoints)
```javascript
GET /api/bills?page=1&page_size=50&search=john&status=paid

Response:
{
  data: [...],
  pagination: {
    page: 1,
    page_size: 50,
    total: 234,
    total_pages: 5,
    has_next: true,
    has_prev: false
  }
}
```

### Search Debouncing (Frontend)
```javascript
// 300ms debounce on all search inputs
searchTimeoutRef = setTimeout(() => {
  fetchSearchResults(query);
}, 300);
```

### Field Selection
```javascript
GET /api/products?fields=sku,name,brand
// Returns only specified fields
```

---

## 7. Key Features Implementation

### Excel Bulk Upload (4-Step Wizard)
```
Step 1: Upload .xlsx/.xls file (max 5000 rows)
        POST /api/inventory/bulk-upload/parse
        
Step 2: Map columns (auto-detection + manual override)
        Returns: job_id, columns, auto_mappings
        
Step 3: Validate data
        POST /api/inventory/bulk-upload/validate
        Returns: valid_count, error_count, preview
        
Step 4: Import with progress tracking
        POST /api/inventory/bulk-upload/import
        GET /api/inventory/bulk-upload/progress/{job_id}
```

### Barcode Scanning
```javascript
// USB Scanner: Keyboard event listener
// Camera: html5-qrcode library
POST /api/products/barcode/{barcode}
// Returns product with available batches
```

### Reports
```javascript
GET /api/reports/low-stock      // Products below threshold
GET /api/reports/expiry?days=30 // Expiring within N days
GET /api/reports/sales-summary  // Sales analytics
```

---

## 8. File Structure

```
/app/
├── backend/
│   ├── server.py              # Main FastAPI application (monolithic)
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # MONGO_URL, DB_NAME
│   └── tests/
│       └── test_main.py
│
├── frontend/
│   ├── src/
│   │   ├── App.js             # Routes & Auth context
│   │   ├── App.css            # Global styles
│   │   ├── pages/
│   │   │   ├── AuthPage.js
│   │   │   ├── Dashboard.js
│   │   │   ├── BillingOperations.js
│   │   │   ├── BillingWorkspace.js
│   │   │   ├── InventoryV2.js
│   │   │   ├── PurchasesList.js
│   │   │   ├── Customers.js
│   │   │   ├── Suppliers.js
│   │   │   ├── Reports.js
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── Layout.js
│   │   │   ├── ExcelBulkUploadWizard.js
│   │   │   ├── BarcodeScannerModal.js
│   │   │   └── ui/            # Shadcn components
│   │   └── utils/
│   │       ├── cache.js       # Browser caching
│   │       └── excelExport.js # Excel export utility
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── .env                   # REACT_APP_BACKEND_URL
│
└── memory/
    └── PRD.md                 # Product requirements
```

---

## 9. Environment Variables

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-domain.com
```

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=pharmacare
JWT_SECRET=your-secret-key
```

---

## 10. Running the Application

```bash
# Backend
cd /app/backend
pip install -r requirements.txt
# Active PostgreSQL backend (port 8000)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Legacy MongoDB backup only — do not run in production
# uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd /app/frontend
yarn install
yarn start

# Using Supervisor (Production)
sudo supervisorctl start backend frontend
sudo supervisorctl status
```

---

## 11. Test Credentials
```
Email: testadmin@pharmacy.com
Password: admin123
Role: Admin
```

---

## 12. Design System

| Element | Value |
|---------|-------|
| Primary Color | `#13ecda` (Teal) |
| Font | Manrope |
| Border Radius | 0.5rem (lg), 0.75rem (xl) |
| Status: Paid | Green (`bg-emerald-100`) |
| Status: Due | Orange (`bg-orange-100`) |
| Status: Draft | Gray (`bg-slate-100`) |
| Status: Cancelled | Red (`bg-rose-100`) |

---

**Document Version:** 4.2.0  
**Last Updated:** February 2026
