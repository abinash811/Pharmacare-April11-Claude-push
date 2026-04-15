/**
 * PHARMACARE — TypeScript Entity Interfaces
 *
 * Single source of truth for all API response shapes.
 * Mirrors the Pydantic models in backend/server.py and backend/routers/*.
 *
 * Naming convention:
 *   - Read models (what the API returns): plain name, e.g. `Bill`, `Product`
 *   - Create/Update payloads:             `BillCreate`, `ProductUpdate`, etc.
 *   - Pagination envelope:                `Paginated<T>`
 *   - API response wrapper:               `ApiResponse<T>`
 *
 * Usage:
 *   import type { Bill, Product, PaginatedResponse } from '@/types';
 */


// ── Shared / Primitives ───────────────────────────────────────────────────────

/** ISO 8601 datetime string — e.g. "2026-04-15T10:30:00Z" */
export type ISODateTime = string;

/** ISO 8601 date-only string — e.g. "2026-04-15" */
export type ISODate = string;

/** UUID string — e.g. "550e8400-e29b-41d4-a716-446655440000" */
export type UUID = string;

/** FastAPI pagination envelope — returned by list endpoints */
export interface PaginatedResponse<T> {
  data:         T[];
  total:        number;
  page:         number;
  page_size:    number;
  total_pages:  number;
  total_items:  number;
}

/** Generic API success/error wrapper (some endpoints return this) */
export interface ApiResponse<T = unknown> {
  success:  boolean;
  message?: string;
  data?:    T;
}


// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type:   string;
  user: {
    id:       UUID;
    email:    string;
    name:     string;
    role:     string;
    pharmacy_id?: UUID;
  };
}


// ── Users & Roles ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'cashier' | 'inventory_staff';

export interface User {
  id:           UUID;
  email:        string;
  name:         string;
  role:         UserRole | string;
  is_active:    boolean;
  created_at:   ISODateTime;
  updated_at?:  ISODateTime | null;
  created_by?:  UUID | null;
  updated_by?:  UUID | null;
}

export interface UserCreate {
  email:    string;
  name:     string;
  password: string;
  role:     UserRole | string;
}

export interface UserUpdate {
  name?:      string;
  email?:     string;
  role?:      UserRole | string;
  is_active?: boolean;
}

export interface Role {
  id:            UUID;
  name:          string;
  display_name:  string;
  permissions:   string[];
  is_default:    boolean;
  is_super_admin:boolean;
  created_at:    ISODateTime;
  updated_at?:   ISODateTime | null;
}

export interface RoleCreate {
  name:          string;
  display_name:  string;
  permissions:   string[];
}


// ── Products & Inventory ──────────────────────────────────────────────────────

export type DrugSchedule = 'OTC' | 'H' | 'H1' | 'X';
export type ProductStatus = 'active' | 'inactive';

export interface Product {
  id:                      UUID;
  sku:                     string;
  name:                    string;
  manufacturer?:           string | null;
  brand?:                  string | null;
  pack_size?:              string | null;   // e.g. "Strip", "Box"
  units_per_pack:          number;
  uom?:                    string | null;   // "units", "ml", "gm"
  category?:               string | null;
  barcode?:                string | null;
  default_mrp_per_unit:    number;
  default_ptr_per_unit?:   number | null;
  landing_price_per_unit?: number | null;
  gst_percent:             number;
  hsn_code?:               string | null;
  description?:            string | null;
  low_stock_threshold_units: number;
  schedule:                DrugSchedule | string;
  status:                  ProductStatus;
  created_at:              ISODateTime;
  updated_at:              ISODateTime;
  created_by?:             UUID | null;
  updated_by?:             UUID | null;
}

export interface ProductCreate {
  sku:                       string;
  name:                      string;
  manufacturer?:             string;
  brand?:                    string;
  pack_size?:                string;
  units_per_pack?:           number;
  uom?:                      string;
  category?:                 string;
  default_mrp_per_unit?:     number;
  default_ptr_per_unit?:     number;
  gst_percent?:              number;
  hsn_code?:                 string;
  description?:              string;
  low_stock_threshold_units?: number;
  schedule?:                 DrugSchedule | string;
  status?:                   ProductStatus;
}

export type ProductUpdate = Partial<ProductCreate>;

export type BatchPriority = 'LIFA' | 'LILA';

export interface StockBatch {
  id:                UUID;
  product_sku:       string;
  product_name?:     string;
  batch_no:          string;
  manufacture_date?: ISODateTime | null;
  expiry_date?:      ISODateTime | null;
  qty_units:         number;             // current stock in units
  mrp_per_unit:      number;
  ptr_per_unit?:     number | null;
  cost_price_per_unit?: number | null;
  gst_percent:       number;
  batch_priority:    BatchPriority;
  is_active:         boolean;
  created_at:        ISODateTime;
}

export interface StockMovement {
  id:              UUID;
  product_sku:     string;
  batch_id?:       UUID | null;
  movement_type:   string;              // 'purchase_in', 'sale_out', 'return_in', etc.
  qty_units:       number;              // positive = in, negative = out
  reference_id?:   UUID | null;
  reference_type?: string | null;
  note?:           string | null;
  created_by?:     UUID | null;
  created_at:      ISODateTime;
}


// ── Customers & Doctors ───────────────────────────────────────────────────────

export type CustomerType = 'regular' | 'wholesale' | 'institution';

export interface Customer {
  id:            UUID;
  name:          string;
  phone:         string;
  email?:        string | null;
  address?:      string | null;
  customer_type: CustomerType;
  gstin?:        string | null;
  credit_limit:  number;
  notes?:        string | null;
  created_at:    ISODateTime;
}

export interface CustomerCreate {
  name:           string;
  phone:          string;
  email?:         string;
  address?:       string;
  customer_type?: CustomerType;
  gstin?:         string;
  credit_limit?:  number;
  notes?:         string;
}

export type CustomerUpdate = Partial<CustomerCreate>;

export interface Doctor {
  id:             UUID;
  name:           string;
  specialization?: string | null;
  phone?:         string | null;
  registration_no?: string | null;
  created_at:     ISODateTime;
}

export interface DoctorCreate {
  name:             string;
  specialization?:  string;
  phone?:           string;
  registration_no?: string;
}


// ── Suppliers ─────────────────────────────────────────────────────────────────

export interface SupplierPayment {
  amount:       number;
  paid_at:      ISODateTime;
  payment_mode: string;
  reference?:   string | null;
}

export interface Supplier {
  id:                  UUID;
  name:                string;
  contact_name?:       string | null;
  phone?:              string | null;
  email?:              string | null;
  gstin?:              string | null;
  address?:            string | null;
  payment_terms_days:  number;
  notes?:              string | null;
  is_active:           boolean;
  outstanding:         number;
  payment_history:     SupplierPayment[];
  created_at:          ISODateTime;
  updated_at:          ISODateTime;
}

export interface SupplierCreate {
  name:                string;
  contact_name?:       string;
  phone?:              string;
  email?:              string;
  gstin?:              string;
  address?:            string;
  payment_terms_days?: number;
  notes?:              string;
}

export type SupplierUpdate = Partial<SupplierCreate> & { is_active?: boolean };


// ── Bills (Sales) ─────────────────────────────────────────────────────────────

export type BillStatus    = 'draft' | 'paid' | 'due' | 'refunded' | 'cancelled';
export type InvoiceType   = 'SALE' | 'SALES_RETURN';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'credit' | 'cheque';

export interface BillItem {
  product_id?:   UUID | null;
  batch_id?:     UUID | null;
  product_name?: string | null;
  brand?:        string | null;
  batch_no?:     string | null;
  expiry_date?:  ISODate | null;
  quantity:      number;
  unit_price:    number;
  mrp:           number;
  discount:      number;
  gst_percent:   number;
  line_total:    number;
}

export interface Bill {
  id:               UUID;
  bill_number:      string;
  invoice_type:     InvoiceType;
  ref_invoice_id?:  UUID | null;
  status:           BillStatus;
  customer_id?:     UUID | null;
  customer_name?:   string | null;
  customer_mobile?: string | null;
  doctor_id?:       UUID | null;
  doctor_name?:     string | null;
  items:            BillItem[];
  subtotal:         number;
  discount:         number;
  tax_rate:         number;
  tax_amount:       number;
  total_amount:     number;
  paid_amount:      number;
  due_amount:       number;
  payment_method?:  PaymentMethod | string | null;
  cashier_id:       UUID;
  cashier_name:     string;
  created_at:       ISODateTime;
}

export interface BillPayment {
  method: PaymentMethod | string;
  amount: number;
}

export interface BillCreate {
  customer_id?:     UUID;
  customer_name?:   string;
  customer_mobile?: string;
  doctor_id?:       UUID;
  doctor_name?:     string;
  items:            Partial<BillItem>[];
  discount?:        number;
  tax_rate:         number;
  payments?:        BillPayment[];
  payment_method?:  PaymentMethod | string;
  status?:          BillStatus;
  invoice_type?:    InvoiceType;
  ref_invoice_id?:  UUID;
}


// ── Purchases ─────────────────────────────────────────────────────────────────

export type PurchaseStatus        = 'draft' | 'confirmed' | 'received' | 'partially_received' | 'closed' | 'cancelled';
export type PurchasePaymentStatus = 'unpaid' | 'partial' | 'paid';
export type PurchaseOrderType     = 'direct' | 'credit' | 'consignment';

export interface PurchaseItem {
  id:                   UUID;
  product_sku:          string;
  product_name:         string;
  batch_no?:            string | null;
  expiry_date?:         ISODateTime | null;
  qty_packs?:           number | null;
  qty_units:            number;
  free_qty_units:       number;
  cost_price_per_unit:  number;
  ptr_per_unit?:        number | null;
  mrp_per_unit:         number;
  gst_percent:          number;
  batch_priority:       BatchPriority;
  line_total:           number;
  received_qty_units:   number;
}

export interface Purchase {
  id:                   UUID;
  purchase_number:      string;
  supplier_id:          UUID;
  supplier_name:        string;
  purchase_date:        ISODateTime;
  due_date?:            ISODateTime | null;
  supplier_invoice_no?: string | null;
  supplier_invoice_date?: ISODateTime | null;
  order_type:           PurchaseOrderType;
  with_gst:             boolean;
  purchase_on:          string;
  status:               PurchaseStatus;
  payment_status:       PurchasePaymentStatus;
  items:                PurchaseItem[];
  subtotal:             number;
  tax_value:            number;
  round_off:            number;
  total_value:          number;
  amount_paid:          number;
  payment_terms_days:   number;
  note?:                string | null;
  created_by:           UUID;
  created_at:           ISODateTime;
  updated_by?:          UUID | null;
  updated_at:           ISODateTime;
}


// ── Purchase Returns ──────────────────────────────────────────────────────────

export type PurchaseReturnStatus = 'draft' | 'confirmed';

export interface PurchaseReturnItem {
  id:                  UUID;
  product_sku:         string;
  product_name:        string;
  batch_id:            UUID;
  batch_no:            string;
  qty_units:           number;
  cost_price_per_unit: number;
  reason:              string;
  line_total:          number;
}

export interface PurchaseReturn {
  id:               UUID;
  return_number:    string;
  supplier_id:      UUID;
  supplier_name:    string;
  purchase_id?:     UUID | null;
  purchase_number?: string | null;
  return_date:      ISODateTime;
  status:           PurchaseReturnStatus;
  items:            PurchaseReturnItem[];
  total_value:      number;
  note?:            string | null;
  created_by:       UUID;
  created_at:       ISODateTime;
  confirmed_at?:    ISODateTime | null;
  confirmed_by?:    UUID | null;
}


// ── Sales Returns ─────────────────────────────────────────────────────────────

export type SalesReturnStatus = 'draft' | 'confirmed' | 'cancelled';

export interface SalesReturnItem {
  id?:            UUID;
  medicine_id?:   UUID | null;
  medicine_name:  string;
  product_sku?:   string | null;
  batch_id?:      UUID | null;
  batch_no:       string;
  expiry_date?:   ISODate | null;
  mrp:            number;
  qty:            number;
  original_qty:   number;
  disc_percent:   number;
  disc_price:     number;
  gst_percent:    number;
  amount:         number;
  is_damaged:     boolean;
}

export interface SalesReturn {
  id:                UUID;
  return_no:         string;
  original_bill_id?: UUID | null;
  original_bill_no?: string | null;
  return_date:       ISODateTime;
  entry_date:        ISODateTime;
  patient:           { id?: UUID; name?: string; phone?: string };
  billing_for:       string;
  status:            SalesReturnStatus;
  items:             SalesReturnItem[];
  total_amount:      number;
  refund_amount:     number;
  note?:             string | null;
  created_by?:       UUID | null;
  created_at:        ISODateTime;
}


// ── Payments & Refunds ────────────────────────────────────────────────────────

export interface Payment {
  id:             UUID;
  bill_id:        UUID;
  amount:         number;
  payment_method: PaymentMethod | string;
  reference_no?:  string | null;
  notes?:         string | null;
  created_by?:    UUID | null;
  created_at:     ISODateTime;
}

export interface Refund {
  id:              UUID;
  bill_id:         UUID;
  amount:          number;
  refund_method:   string;
  reason?:         string | null;
  reference_no?:   string | null;
  processed_by?:   UUID | null;
  created_at:      ISODateTime;
}


// ── Reports & Analytics ───────────────────────────────────────────────────────

export interface GSTReportLine {
  hsn_code?:      string;
  description?:   string;
  gst_rate:       number;
  taxable_value:  number;
  cgst:           number;
  sgst:           number;
  igst:           number;
  total_tax:      number;
}

export interface GSTReport {
  period_start:   ISODate;
  period_end:     ISODate;
  sales_lines:    GSTReportLine[];
  purchase_lines: GSTReportLine[];
  total_sales_gst:    number;
  total_purchase_gst: number;
  net_liability:      number;
}

export interface DashboardMetrics {
  today_sales:        number;
  today_bills:        number;
  month_sales:        number;
  month_bills:        number;
  low_stock_count:    number;
  expiring_soon_count:number;
  outstanding_dues:   number;
}


// ── Audit Logs ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id:           UUID;
  user_id:      UUID;
  user_name?:   string;
  action:       string;
  entity_type:  string;
  entity_id?:   UUID | null;
  details?:     Record<string, unknown> | null;
  ip_address?:  string | null;
  created_at:   ISODateTime;
}


// ── Settings ──────────────────────────────────────────────────────────────────

export interface BillSequenceSettings {
  prefix:             string;
  starting_number:    number;
  sequence_length:    number;
  allow_prefix_change:boolean;
}

export interface PharmacySettings {
  pharmacy_name?:    string;
  address?:          string;
  phone?:            string;
  gstin?:            string;
  license_number?:   string;
  dl_number?:        string;
  bill_sequence?:    BillSequenceSettings;
}


// ── Re-exports for convenience ────────────────────────────────────────────────

export type {
  PaginatedResponse as Paginated,
};
