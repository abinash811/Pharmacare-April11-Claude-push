/**
 * PHARMACARE — API Endpoint Constants
 *
 * Single source of truth for every backend URL.
 * Eliminates scattered `${API}/...` template literals across page files.
 *
 * Two layers:
 *   API_ENDPOINTS  — static path strings (no leading slash, no base URL)
 *   apiUrl.*()     — builder functions for dynamic paths (with params/query)
 *
 * Usage:
 *   import { API_ENDPOINTS, apiUrl } from '@/constants/api';
 *
 *   // Static
 *   axios.get(`${API}/${API_ENDPOINTS.BILLS.LIST}`)
 *
 *   // Dynamic (preferred with the axios instance from lib/axios.js)
 *   axios.get(apiUrl.bill(id))
 *   axios.get(apiUrl.stockBatches({ productSku: sku }))
 */

// ── Static Endpoint Paths ─────────────────────────────────────────────────────

export const API_ENDPOINTS = {

  // Auth
  AUTH: {
    LOGIN:    'auth/login',
    LOGOUT:   'auth/logout',
    ME:       'auth/me',
    REGISTER: 'auth/register',
    SESSION:  'auth/session',
  },

  // Products / Inventory
  PRODUCTS: {
    LIST:               'products',
    CREATE:             'products',
    DETAIL:             'products/:id',          // use apiUrl.product(id)
    UPDATE:             'products/:sku',          // use apiUrl.productBySku(sku)
    BULK_UPDATE:        'products/bulk-update',
    SEARCH_WITH_BATCHES:'products/search-with-batches',
    TRANSACTIONS:       'products/:sku/transactions',
    BARCODE:            'products/barcode/:barcode',
  },

  INVENTORY: {
    LIST:    'inventory',
    FILTERS: 'inventory/filters',
    SEARCH:  'inventory/search',
  },

  // Stock Batches & Movements
  STOCK: {
    BATCHES:          'stock/batches',
    BATCH_DETAIL:     'stock/batches/:id',
    BATCH_ADJUST:     'batches/:id/adjust',
    BATCH_WRITEOFF:   'batches/:id/writeoff-expiry',
    MOVEMENTS:        'stock-movements',
  },

  // Billing / Sales
  BILLS: {
    LIST:   'bills',
    CREATE: 'bills',
    DETAIL: 'bills/:id',
    PDF:    'bills/:id/pdf',
  },

  PAYMENTS: {
    CREATE: 'payments',
  },

  REFUNDS: {
    CREATE: 'refunds',
  },

  // Sales Returns
  SALES_RETURNS: {
    LIST:   'sales-returns',
    CREATE: 'sales-returns',
    DETAIL: 'sales-returns/:id',
  },

  // Purchases
  PURCHASES: {
    LIST:             'purchases',
    CREATE:           'purchases',
    DETAIL:           'purchases/:id',
    PAY:              'purchases/:id/pay',
    ITEMS_FOR_RETURN: 'purchases/:id/items-for-return',
  },

  // Purchase Returns
  PURCHASE_RETURNS: {
    LIST:    'purchase-returns',
    CREATE:  'purchase-returns',
    DETAIL:  'purchase-returns/:id',
    CONFIRM: 'purchase-returns/:id/confirm',
  },

  // Customers & Doctors
  CUSTOMERS: {
    LIST:   'customers',
    CREATE: 'customers',
    DETAIL: 'customers/:id',
    STATS:  'customers/:id/stats',
    SEARCH: 'customers/search',
  },

  DOCTORS: {
    LIST:   'doctors',
    CREATE: 'doctors',
    DETAIL: 'doctors/:id',
  },

  PATIENTS: {
    SEARCH: 'patients',
  },

  // Suppliers
  SUPPLIERS: {
    LIST:          'suppliers',
    CREATE:        'suppliers',
    DETAIL:        'suppliers/:id',
    SUMMARY:       'suppliers/:id/summary',
    PAYMENT:       'suppliers/:id/payment',
    TOGGLE_STATUS: 'suppliers/:id/toggle-status',
  },

  // Reports & Analytics
  REPORTS: {
    DASHBOARD:     'reports/dashboard',
    SALES:         'reports/sales',
    SALES_SUMMARY: 'reports/sales-summary',
    LOW_STOCK:     'reports/low-stock',
    EXPIRY:        'reports/expiry',
    GST:           'reports/gst',
  },

  ANALYTICS: {
    SUMMARY:   'analytics/summary',
    DASHBOARD: 'analytics/dashboard',
    DAILY:     'analytics/daily',
    PURCHASES: 'analytics/purchases',
  },

  COMPLIANCE: {
    SCHEDULE_H1: 'compliance/schedule-h1-register',
  },

  // Users, Roles & Settings
  USERS: {
    LIST:            'users',
    CREATE:          'users',
    DETAIL:          'users/:id',
    CHANGE_PASSWORD: 'users/me/change-password',
  },

  ROLES: {
    LIST:                'roles',
    CREATE:              'roles',
    DETAIL:              'roles/:id',
    RETURN_PERMISSIONS:  'roles/:id/permissions/returns',
  },

  PERMISSIONS: {
    LIST: 'permissions',
  },

  SETTINGS: {
    GET:               'settings',
    UPDATE:            'settings',
    BILL_SEQUENCE:     'settings/bill-sequence',
    BILL_SEQUENCES:    'settings/bill-sequences',
    ALL_BILL_SEQUENCES:'settings/bill-sequence/all',
  },

  // Backup
  BACKUP: {
    EXPORT: 'backup/export',
  },

  // Audit
  AUDIT_LOGS: {
    LIST:   'audit-logs',
    ENTITY: 'audit-logs/entity/:type/:id',
  },
};


// ── Dynamic URL Builders ──────────────────────────────────────────────────────
// Each function returns a full path string (no base URL — axios handles that).
// Query params are accepted as an optional plain object.

const qs = (params?: Record<string, string | number | boolean | null | undefined>): string => {
  if (!params) return '';
  const str = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string | number | boolean)}`)
    .join('&');
  return str ? `?${str}` : '';
};

export const apiUrl: Record<string, (...args: any[]) => string> = {

  // Auth
  authMe:           () => API_ENDPOINTS.AUTH.ME,
  authLogin:        () => API_ENDPOINTS.AUTH.LOGIN,
  authLogout:       () => API_ENDPOINTS.AUTH.LOGOUT,
  authRegister:     () => API_ENDPOINTS.AUTH.REGISTER,

  // Products
  products:         (params) => `products${qs(params)}`,
  product:          (id)     => `products/${id}`,
  productBySku:     (sku)    => `products/${sku}`,
  productTransactions:(sku)  => `products/${sku}/transactions`,
  productBarcode:   (barcode)=> `products/barcode/${barcode}`,
  productsBulkUpdate:()      => API_ENDPOINTS.PRODUCTS.BULK_UPDATE,
  productsSearchWithBatches: (q, params) =>
    `products/search-with-batches${qs({ q, ...params })}`,

  // Inventory
  inventory:        (params) => `inventory${qs(params)}`,
  inventoryFilters: ()       => API_ENDPOINTS.INVENTORY.FILTERS,
  inventorySearch:  (params) => `inventory/search${qs(params)}`,

  // Stock
  stockBatches:     (params) => `stock/batches${qs(params)}`,
  stockBatch:       (id)     => `stock/batches/${id}`,
  batchAdjust:      (id)     => `batches/${id}/adjust`,
  batchWriteoff:    (id)     => `batches/${id}/writeoff-expiry`,
  stockMovements:   (params) => `stock-movements${qs(params)}`,

  // Bills
  bills:            (params) => `bills${qs(params)}`,
  bill:             (id)     => `bills/${id}`,
  billPdf:          (id)     => `bills/${id}/pdf`,

  // Sales Returns
  salesReturns:     (params) => `sales-returns${qs(params)}`,
  salesReturn:      (id, params) => `sales-returns/${id}${qs(params)}`,

  // Purchases
  purchases:        (params) => `purchases${qs(params)}`,
  purchase:         (id)     => `purchases/${id}`,
  purchasePay:      (id)     => `purchases/${id}/pay`,
  purchaseItemsForReturn: (id) => `purchases/${id}/items-for-return`,

  // Purchase Returns
  purchaseReturns:  (params) => `purchase-returns${qs(params)}`,
  purchaseReturn:   (id)     => `purchase-returns/${id}`,
  purchaseReturnConfirm: (id) => `purchase-returns/${id}/confirm`,

  // Customers & Doctors
  customers:        (params) => `customers${qs(params)}`,
  customer:         (id)     => `customers/${id}`,
  customerStats:    (id)     => `customers/${id}/stats`,
  customerSearch:   (params) => `customers/search${qs(params)}`,
  doctors:          (params) => `doctors${qs(params)}`,
  doctor:           (id)     => `doctors/${id}`,
  patients:         (params) => `patients${qs(params)}`,

  // Suppliers
  suppliers:        (params) => `suppliers${qs(params)}`,
  supplier:         (id)     => `suppliers/${id}`,
  supplierSummary:  (id)     => `suppliers/${id}/summary`,
  supplierPayment:  (id)     => `suppliers/${id}/payment`,
  supplierToggle:   (id)     => `suppliers/${id}/toggle-status`,

  // Reports & Analytics
  reportDashboard:  () => API_ENDPOINTS.REPORTS.DASHBOARD,
  reportSales:      (params) => `reports/sales${qs(params)}`,
  reportLowStock:   (params) => `reports/low-stock${qs(params)}`,
  reportExpiry:     (params) => `reports/expiry${qs(params)}`,
  reportGst:        (params) => `reports/gst${qs(params)}`,
  analyticsSummary: (params) => `analytics/summary${qs(params)}`,
  analyticsDashboard:(params)=> `analytics/dashboard${qs(params)}`,
  analyticsDaily:   (params) => `analytics/daily${qs(params)}`,
  scheduleH1:       (params) => `compliance/schedule-h1-register${qs(params)}`,

  // Users & Roles
  users:            () => API_ENDPOINTS.USERS.LIST,
  user:             (id) => `users/${id}`,
  changePassword:   () => API_ENDPOINTS.USERS.CHANGE_PASSWORD,
  roles:            () => API_ENDPOINTS.ROLES.LIST,
  role:             (id) => `roles/${id}`,
  roleReturnPermissions: (roleId) => `roles/${roleId}/permissions/returns`,
  permissions:      () => API_ENDPOINTS.PERMISSIONS.LIST,

  // Settings
  settings:         () => API_ENDPOINTS.SETTINGS.GET,
  billSequence:     () => API_ENDPOINTS.SETTINGS.BILL_SEQUENCE,
  billSequences:    () => API_ENDPOINTS.SETTINGS.BILL_SEQUENCES,

  // Backup
  backupExport:     () => API_ENDPOINTS.BACKUP.EXPORT,

  // Audit
  auditLogs:        (params) => `audit-logs${qs(params)}`,
  auditLogEntity:   (type, id) => `audit-logs/entity/${type}/${id}`,
};
