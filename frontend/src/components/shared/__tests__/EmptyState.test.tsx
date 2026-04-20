import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  EmptyState,
  BillingEmptyState,
  PurchasesEmptyState,
  InventoryEmptyState,
  SearchEmptyState,
  ErrorEmptyState,
  CustomersEmptyState,
  SuppliersEmptyState,
} from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Nothing here" description="Add some data" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add some data')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<EmptyState action={<button>Add Item</button>} />);
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('does not render action slot when absent', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('button')).not.toBeInTheDocument();
  });
});

describe('Module-specific empty states', () => {
  it('BillingEmptyState — shows "No bills yet" unfiltered', () => {
    render(<BillingEmptyState />);
    expect(screen.getByText('No bills yet')).toBeInTheDocument();
  });

  it('BillingEmptyState — shows filter copy when filtered', () => {
    render(<BillingEmptyState filtered />);
    expect(screen.getByText('No bills match your filters')).toBeInTheDocument();
  });

  it('PurchasesEmptyState — default copy', () => {
    render(<PurchasesEmptyState />);
    expect(screen.getByText('No purchases yet')).toBeInTheDocument();
  });

  it('InventoryEmptyState — default copy', () => {
    render(<InventoryEmptyState />);
    expect(screen.getByText('No inventory yet')).toBeInTheDocument();
  });

  it('CustomersEmptyState — filtered copy', () => {
    render(<CustomersEmptyState filtered />);
    expect(screen.getByText('No customers match your search')).toBeInTheDocument();
  });

  it('SuppliersEmptyState — default copy', () => {
    render(<SuppliersEmptyState />);
    expect(screen.getByText('No suppliers yet')).toBeInTheDocument();
  });

  it('SearchEmptyState — shows query in title', () => {
    render(<SearchEmptyState query="aspirin" />);
    expect(screen.getByText(/aspirin/)).toBeInTheDocument();
  });

  it('ErrorEmptyState — shows error copy', () => {
    render(<ErrorEmptyState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
