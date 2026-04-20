import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Billing" />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Billing" subtitle="Manage invoices" />);
    expect(screen.getByText('Manage invoices')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(<PageHeader title="Billing" actions={<button>New Bill</button>} />);
    expect(screen.getByRole('button', { name: 'New Bill' })).toBeInTheDocument();
  });

  it('renders breadcrumb above title when provided', () => {
    render(<PageHeader title="Bill Detail" breadcrumb={<nav aria-label="breadcrumb">Billing / #123</nav>} />);
    expect(screen.getByLabelText('breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('Bill Detail')).toBeInTheDocument();
  });

  it('does not render subtitle element when not provided', () => {
    const { container } = render(<PageHeader title="Billing" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });
});
