"""Shared constants — DEFAULT_ROLES, ALL_PERMISSIONS, and other app-wide values."""
from __future__ import annotations

# ── Default roles seeded at startup ───────────────────────────────────────────
DEFAULT_ROLES = [
    {
        "name": "admin",
        "display_name": "Administrator",
        "permissions": ["*"],
        "is_default": True,
        "is_super_admin": True,
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
            "customers:view", "customers:edit", "customers:create", "reports:view",
        ],
        "is_default": True,
        "is_super_admin": False,
    },
    {
        "name": "cashier",
        "display_name": "Cashier",
        "permissions": [
            "dashboard:view", "billing:create", "billing:view", "inventory:view",
            "sales_returns:create", "sales_returns:view", "customers:view",
            "customers:edit", "customers:create",
        ],
        "is_default": True,
        "is_super_admin": False,
    },
    {
        "name": "inventory_staff",
        "display_name": "Inventory Staff",
        "permissions": [
            "dashboard:view", "inventory:view", "inventory:edit", "inventory:create",
            "inventory:batches_view", "inventory:batches_create", "inventory:stock_adjust",
            "purchases:create", "purchases:view", "purchase_returns:create",
            "purchase_returns:view",
        ],
        "is_default": True,
        "is_super_admin": False,
    },
]

# ── All permission definitions (used by /permissions endpoint and UI) ─────────
ALL_PERMISSIONS = {
    "dashboard": {"display_name": "Dashboard", "permissions": [{"id": "dashboard:view", "name": "View Dashboard"}]},
    "billing": {"display_name": "Billing", "permissions": [
        {"id": "billing:create", "name": "Create Bills"}, {"id": "billing:view", "name": "View Bills"},
        {"id": "billing:edit", "name": "Edit Bills"}, {"id": "billing:delete", "name": "Delete Bills"},
    ]},
    "inventory": {"display_name": "Inventory", "permissions": [
        {"id": "inventory:view", "name": "View Inventory"}, {"id": "inventory:create", "name": "Add Products"},
        {"id": "inventory:edit", "name": "Edit Products"}, {"id": "inventory:delete", "name": "Delete Products"},
        {"id": "inventory:batches_view", "name": "View Batches"}, {"id": "inventory:batches_create", "name": "Add Batches"},
        {"id": "inventory:stock_adjust", "name": "Adjust Stock"},
    ]},
    "purchases": {"display_name": "Purchases", "permissions": [
        {"id": "purchases:create", "name": "Create Purchases"}, {"id": "purchases:view", "name": "View Purchases"},
        {"id": "purchases:edit", "name": "Edit Purchases"}, {"id": "purchases:delete", "name": "Delete Purchases"},
    ]},
    "purchase_returns": {"display_name": "Purchase Returns", "permissions": [
        {"id": "purchase_returns:create", "name": "Create Returns"}, {"id": "purchase_returns:view", "name": "View Returns"},
        {"id": "purchase_returns:confirm", "name": "Confirm Returns"},
    ]},
    "sales_returns": {"display_name": "Sales Returns", "permissions": [
        {"id": "sales_returns:create", "name": "Create Returns"}, {"id": "sales_returns:view", "name": "View Returns"},
        {"id": "sales_returns:process", "name": "Process Returns"},
    ]},
    "customers": {"display_name": "Customers", "permissions": [
        {"id": "customers:view", "name": "View Customers"}, {"id": "customers:create", "name": "Add Customers"},
        {"id": "customers:edit", "name": "Edit Customers"}, {"id": "customers:delete", "name": "Delete Customers"},
    ]},
    "reports": {"display_name": "Reports", "permissions": [
        {"id": "reports:view", "name": "View Reports"}, {"id": "reports:export", "name": "Export Reports"},
    ]},
    "settings": {"display_name": "Settings", "permissions": [
        {"id": "settings:view", "name": "View Settings"}, {"id": "settings:edit", "name": "Edit Settings"},
    ]},
    "users": {"display_name": "User Management", "permissions": [
        {"id": "users:view", "name": "View Users"}, {"id": "users:create", "name": "Create Users"},
        {"id": "users:edit", "name": "Edit Users"}, {"id": "users:delete", "name": "Deactivate Users"},
    ]},
    "roles": {"display_name": "Roles & Permissions", "permissions": [
        {"id": "roles:view", "name": "View Roles"}, {"id": "roles:create", "name": "Create Roles"},
        {"id": "roles:edit", "name": "Edit Roles"}, {"id": "roles:delete", "name": "Delete Roles"},
    ]},
    "suppliers": {"display_name": "Suppliers", "permissions": [
        {"id": "suppliers:view", "name": "View Suppliers"}, {"id": "suppliers:create", "name": "Create Suppliers"},
        {"id": "suppliers:edit", "name": "Edit Suppliers"}, {"id": "suppliers:deactivate", "name": "Deactivate Suppliers"},
    ]},
}
