import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageBreadcrumb } from '../PageBreadcrumb';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PageBreadcrumb', () => {
  it('renders nothing when crumbs is empty', () => {
    const { container } = wrap(<PageBreadcrumb crumbs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all crumb labels', () => {
    wrap(<PageBreadcrumb crumbs={[{ label: 'Billing', to: '/billing' }, { label: '#INV-001' }]} />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('#INV-001')).toBeInTheDocument();
  });

  it('renders intermediate crumbs as links', () => {
    wrap(<PageBreadcrumb crumbs={[{ label: 'Billing', to: '/billing' }, { label: '#INV-001' }]} />);
    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('href', '/billing');
  });

  it('does not render last crumb as a link', () => {
    wrap(<PageBreadcrumb crumbs={[{ label: 'Billing', to: '/billing' }, { label: '#INV-001' }]} />);
    expect(screen.queryByRole('link', { name: '#INV-001' })).not.toBeInTheDocument();
  });

  it('renders single crumb as page (not link)', () => {
    wrap(<PageBreadcrumb crumbs={[{ label: 'Billing' }]} />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
