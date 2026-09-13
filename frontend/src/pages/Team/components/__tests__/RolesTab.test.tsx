import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RolesTab from '../RolesTab';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

// Regression test for the Sep 13, 2026 "clone-a-role" feature: before this,
// building a new role always meant starting from zero permissions — cloning
// an existing role (including a protected default like Cashier) to tweak
// one or two permissions was not possible anywhere in the product.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const CUSTOM_ROLE = {
  id: 'r1', name: 'store_manager', display_name: 'Store Manager',
  permissions: ['billing:view', 'inventory:view'], is_default: false, is_super_admin: false, is_active: true,
};
const DEFAULT_ROLE = {
  id: 'r2', name: 'cashier', display_name: 'Cashier',
  permissions: ['billing:view', 'billing:create'], is_default: true, is_super_admin: false, is_active: true,
};

const PERMISSIONS = {
  billing: { display_name: 'Billing', permissions: [{ id: 'billing:view', name: 'View' }, { id: 'billing:create', name: 'Create' }] },
  inventory: { display_name: 'Inventory', permissions: [{ id: 'inventory:view', name: 'View' }] },
};

describe('RolesTab — clone a role', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) =>
      url.includes('permissions')
        ? Promise.resolve({ data: PERMISSIONS })
        : Promise.resolve({ data: [CUSTOM_ROLE, DEFAULT_ROLE] }));
  });

  it('offers Clone on a custom role and pre-fills the create form with its permissions', async () => {
    render(<RolesTab />);
    await userEvent.click(await screen.findByLabelText('Clone Store Manager'));

    expect(await screen.findByDisplayValue('store_manager_copy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Store Manager (Copy)')).toBeInTheDocument();
    expect(screen.getByText('(2 selected)')).toBeInTheDocument();
  });

  it('also offers Clone on a protected default role', async () => {
    render(<RolesTab />);
    await userEvent.click(await screen.findByLabelText('Clone Cashier'));

    expect(await screen.findByDisplayValue('cashier_copy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cashier (Copy)')).toBeInTheDocument();
    expect(screen.getByText('(2 selected)')).toBeInTheDocument();
  });

  it('submits the cloned role via the normal create-role endpoint', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'new-1' } });
    render(<RolesTab />);
    await userEvent.click(await screen.findByLabelText('Clone Store Manager'));
    await screen.findByDisplayValue('store_manager_copy');
    await userEvent.click(screen.getByRole('button', { name: 'Create Role' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(apiUrl.roles(), {
      name: 'store_manager_copy', display_name: 'Store Manager (Copy)',
      permissions: ['billing:view', 'inventory:view'],
    }));
  });
});
