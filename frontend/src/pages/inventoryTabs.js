/**
 * Shared tab config for the 3 sibling Inventory pages (InventorySearch,
 * StockMovementLog, ReorderList) — each is its own top-level route/page,
 * but they must all render the identical tab bar. Extracted to one file
 * instead of copy-pasted 3 times: this app has already paid for that
 * exact kind of duplication drifting apart more than once (role
 * permissions in seed_admin.py vs constants.py; api.js vs api.ts) — a
 * 3-way copy of a tab list is the same risk at a smaller scale.
 */
export const INVENTORY_TABS = [
  { key: 'products',        label: 'Products'        },
  { key: 'stock-movements', label: 'Stock Movements' },
  { key: 'reorder-list',    label: 'Reorder List'     },
];

const ROUTES = {
  'products':        '/inventory',
  'stock-movements': '/inventory/stock-movements',
  'reorder-list':    '/inventory/reorder',
};

export const inventoryTabRoute = (key) => ROUTES[key] || ROUTES.products;
