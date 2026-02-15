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
    case 'inventory':
      return formatInventoryReport(reportData);
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
  return data.data.map((item) => ({
    'Product': item.name,
    'SKU': item.sku,
    'Current Stock': item.current_stock,
    'Reorder Level': item.reorder_level,
    'Shortage': item.shortage,
    'Status': item.status,
    'Category': item.category || '-',
  }));
};

const formatExpiryReport = (data) => {
  if (!data?.data) return [];
  return data.data.map((item) => ({
    'Product': item.product_name,
    'Batch': item.batch_no,
    'Stock': item.stock,
    'Expiry Date': item.expiry_date,
    'Days Left': item.days_left,
    'Value (₹)': item.value,
    'Status': item.status,
  }));
};

const formatInventoryReport = (data) => {
  if (!data?.data) return [];
  return data.data.map((item) => ({
    'Product': item.name,
    'SKU': item.sku,
    'Category': item.category || '-',
    'Brand': item.brand || '-',
    'Total Stock': item.total_stock,
    'Stock Value (₹)': item.stock_value,
    'Status': item.status,
  }));
};

/**
 * Export customers to Excel
 * @param {Array} customers - Customer data
 */
export const exportCustomersToExcel = (customers) => {
  const data = customers.map((c) => ({
    'Name': c.name,
    'Phone': c.phone,
    'Email': c.email || '-',
    'Type': c.customer_type || 'Regular',
    'Address': c.address || '-',
    'GSTIN': c.gstin || '-',
    'Credit Limit (₹)': c.credit_limit || 0,
  }));
  
  exportToExcel(data, 'customers', { sheetName: 'Customers' });
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
  exportBillsToExcel,
  exportInventoryToExcel,
};
