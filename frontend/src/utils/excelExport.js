/**
 * Excel Export Utility for PharmaCare
 * Uses SheetJS (xlsx) for generating Excel files
 */

import * as XLSX from 'xlsx';

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 * @param {Object} options - Export options
 */
export const exportToExcel = (data, filename, options = {}) => {
  const {
    sheetName = 'Sheet1',
    columnWidths = {},
    headerStyle = true,
    dateFormat = 'dd/mm/yyyy',
  } = options;

  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Convert data to worksheet
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const cols = Object.keys(data[0]).map((key) => ({
    wch: columnWidths[key] || Math.max(key.length, 15),
  }));
  ws['!cols'] = cols;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate file and trigger download
  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
};

/**
 * Export multiple sheets to a single Excel file
 * @param {Object} sheets - Object with sheet names as keys and data arrays as values
 * @param {string} filename - Name of the file (without extension)
 */
export const exportMultiSheetExcel = (sheets, filename) => {
  const wb = XLSX.utils.book_new();

  Object.entries(sheets).forEach(([sheetName, data]) => {
    if (data && data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Auto-size columns
      const cols = Object.keys(data[0]).map((key) => ({
        wch: Math.max(key.length, 15),
      }));
      ws['!cols'] = cols;
      
      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel sheet name limit
    }
  });

  const timestamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
};

/**
 * Format report data for Excel export
 * @param {string} reportType - Type of report
 * @param {Object} reportData - Raw report data
 * @returns {Array} Formatted data for Excel
 */
export const formatReportForExcel = (reportType, reportData) => {
  switch (reportType) {
    case 'sales':
      return formatSalesReport(reportData);
    case 'low-stock':
      return formatLowStockReport(reportData);
    case 'expiry':
      return formatExpiryReport(reportData);
    case 'margin':
      return formatMarginReport(reportData);
    case 'sales-returns':
      return formatSalesReturnsReport(reportData);
    case 'purchase-returns':
      return formatPurchaseReturnsReport(reportData);
    case 'price-variation':
      return formatPriceVariationReport(reportData);
    default:
      return reportData.data || reportData;
  }
};

const formatSalesReport = (data) => {
  if (!data?.data) return [];
  return data.data.map((item) => ({
    'Bill #': item.bill_number,
    'Date': item.date,
    'Customer': item.customer_name || 'Walk-in',
    'Items': item.items_count,
    'Payment': item.payment_method || '-',
    'Amount (₹)': item.total_amount,
  }));
};

const formatLowStockReport = (data) => {
  if (!data?.data) return [];
  // Field names and the derived Status label match GET /reports/low-stock's
  // real response and ReportTables.jsx's own on-screen badge exactly — the
  // backend has no `name`/`status`/`category` fields on this row at all
  // (found Sep 12, 2026: every column here was silently blank before).
  return data.data.map((item) => ({
    'Product': item.product_name,
    'SKU': item.sku,
    'Current Stock': item.current_stock,
    'Reorder Level': item.reorder_level,
    'Shortage': item.shortage,
    'Status': item.current_stock === 0 ? 'Out of Stock' : 'Low Stock',
  }));
};

const formatExpiryReport = (data) => {
  if (!data?.data) return [];
  // Field names and the derived Status label match GET /reports/expiry's
  // real response and ReportTables.jsx's own ExpiryDaysBadge exactly (found
  // Sep 12, 2026: `stock`/`days_left`/`value`/`status` don't exist on the
  // real row — real fields are `qty`/`days_to_expiry`/`stock_value`).
  return data.data.map((item) => ({
    'Product': item.product_name,
    'Batch': item.batch_no,
    'Stock': item.qty,
    'Expiry Date': item.expiry_date,
    'Days Left': item.days_to_expiry,
    'Value (₹)': item.stock_value,
    'Status': item.days_to_expiry < 0 ? 'Expired' : `${item.days_to_expiry} days left`,
  }));
};

const formatMarginReport = (data) => {
  if (!data?.data) return [];
  // Field names match GET /reports/margin's real response exactly.
  return data.data.map((item) => ({
    'Product': item.product_name,
    'SKU': item.sku,
    'Category': item.category,
    'Qty Sold': item.qty_sold,
    'Revenue (₹)': item.revenue,
    'Cost (₹)': item.cost,
    'Margin (₹)': item.margin,
    'Margin %': item.margin_percent,
  }));
};

const formatSalesReturnsReport = (data) => {
  if (!data?.data) return [];
  // Field names match GET /reports/sales-returns's real response exactly.
  return data.data.map((item) => ({
    'Credit Note #': item.return_number,
    'Date': item.return_date,
    'Bill #': item.original_bill_number,
    'Customer': item.customer_name,
    'Reason': item.reason,
    'Refund Method': item.refund_method,
    'Amount (₹)': item.total_value,
  }));
};

const formatPurchaseReturnsReport = (data) => {
  if (!data?.data) return [];
  // Field names match GET /reports/purchase-returns's real response exactly.
  return data.data.map((item) => ({
    'Debit Note #': item.debit_note_number,
    'Date': item.return_date,
    'Purchase #': item.original_purchase_number,
    'Supplier': item.supplier_name,
    'Reason': item.reason,
    'Amount (₹)': item.total_value,
  }));
};

const formatPriceVariationReport = (data) => {
  if (!data?.data) return [];
  // Field names match GET /reports/price-variation's real response exactly.
  return data.data.map((item) => ({
    'Product': item.product_name,
    'SKU': item.sku,
    'First MRP (₹)': item.first_mrp,
    'Latest MRP (₹)': item.latest_mrp,
    'MRP Change (₹)': item.mrp_change,
    'MRP Change %': item.mrp_change_percent,
    'First Cost (₹)': item.first_cost_price,
    'Latest Cost (₹)': item.latest_cost_price,
    'Cost Change (₹)': item.cost_change,
    'Cost Change %': item.cost_change_percent,
  }));
};

/**
 * Export customers to Excel
 * @param {Array} customers - Customer data
 */
export const exportCustomersToExcel = (customers) => {
  // Outstanding/Notes added Sep 12, 2026 — the Customers v1 fixes made
  // both real (outstanding is computed fresh from real bills, notes is
  // an actual stored field), but this export — the one place Meena the
  // accountant would actually use them for reconciliation — was never
  // updated to include either. Found checking Customers' dependency
  // sections after the fix shipped, not before.
  const data = customers.map((c) => ({
    'Name': c.name,
    'Phone': c.phone,
    'Email': c.email || '-',
    'Type': c.customer_type || 'Regular',
    'Address': c.address || '-',
    'GSTIN': c.gstin || '-',
    'Credit Limit (₹)': c.credit_limit || 0,
    'Outstanding (₹)': c.outstanding || 0,
    'Notes': c.notes || '-',
  }));

  exportToExcel(data, 'customers', { sheetName: 'Customers' });
};

/**
 * Export suppliers to Excel
 * @param {Array} suppliers - Supplier data
 */
export const exportSuppliersToExcel = (suppliers) => {
  const data = suppliers.map((s) => ({
    'Name': s.name,
    'Contact Person': s.contact_person || '-',
    'Phone': s.phone || '-',
    'Email': s.email || '-',
    'GSTIN': s.gstin || '-',
    'Address': s.address || '-',
    'Credit Days': s.credit_days || 0,
    'Outstanding (₹)': s.outstanding || 0,
    'Status': s.is_active === false ? 'Inactive' : 'Active',
    'Notes': s.notes || '-',
  }));

  exportToExcel(data, 'suppliers', { sheetName: 'Suppliers' });
};

/**
 * Export bills/sales to Excel
 * @param {Array} bills - Bill data
 */
export const exportBillsToExcel = (bills) => {
  const data = bills.map((b) => ({
    'Bill #': b.bill_number,
    'Date': new Date(b.created_at).toLocaleDateString(),
    'Customer': b.customer_name || 'Walk-in',
    'Items': b.items?.length || 0,
    'Subtotal (₹)': b.subtotal || 0,
    'Discount (₹)': b.discount || 0,
    'Tax (₹)': b.tax_amount || 0,
    'Total (₹)': b.total_amount || 0,
    'Status': b.status,
    'Payment': b.payments?.[0]?.method || '-',
  }));
  
  exportToExcel(data, 'sales', { sheetName: 'Sales' });
};

/**
 * Export inventory to Excel
 * @param {Array} inventory - Inventory data
 */
export const exportInventoryToExcel = (inventory) => {
  const data = inventory.map((item) => ({
    'Product': item.name,
    'SKU': item.sku,
    'Category': item.category || '-',
    'Brand': item.brand || '-',
    'Total Stock': item.total_qty || 0,
    'Reorder Level': item.reorder_level || 10,
    'Status': item.severity || item.status,
    'MRP (₹)': item.default_mrp || 0,
  }));
  
  exportToExcel(data, 'inventory', { sheetName: 'Inventory' });
};

export default {
  exportToExcel,
  exportMultiSheetExcel,
  formatReportForExcel,
  exportCustomersToExcel,
  exportSuppliersToExcel,
  exportBillsToExcel,
  exportInventoryToExcel,
};
