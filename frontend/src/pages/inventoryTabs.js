/**
 * Shared tab config for the 4 sibling Inventory pages (InventorySearch,
 * StockMovementLog, ReorderList, TransferHistory) — each is its own
 * top-level route/page, but they must all render the identical tab bar.
 * Extracted to one file instead of copy-pasted repeatedly: this app has
 * already paid for that exact kind of duplication drifting apart more
 * than once (role permissions in seed_admin.py vs constants.py; api.js vs
 * api.ts) — a copy of a tab list is the same risk at a smaller scale.
 */
export const INVENTORY_TABS = [
  { key: 'products',        label: 'Products'        },
  { key: 'stock-movements', label: 'Stock Movements' },
  { key: 'reorder-list',    label: 'Reorder List'     },
  { key: 'transfers',       label: 'Transfers'        },
];

const ROUTES = {
  'products':        '/inventory',
  'stock-movements': '/inventory/stock-movements',
  'reorder-list':    '/inventory/reorder',
  'transfers':        '/inventory/transfers',
};

export const inventoryTabRoute = (key) => ROUTES[key] || ROUTES.products;
