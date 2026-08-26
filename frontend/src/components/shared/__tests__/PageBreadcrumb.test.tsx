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

  it('does not render last crumb as a real anchor', () => {
    // The current page uses role="link" aria-disabled="true" (WAI-ARIA
    // breadcrumb pattern, from the shared ui/breadcrumb primitive) so it's
    // announced as part of the trail — but it must not be a clickable <a>.
    wrap(<PageBreadcrumb crumbs={[{ label: 'Billing', to: '/billing' }, { label: '#INV-001' }]} />);
    expect(screen.getByText('#INV-001').closest('a')).not.toBeInTheDocument();
  });

  it('renders single crumb as page (not a real anchor)', () => {
    wrap(<PageBreadcrumb crumbs={[{ label: 'Billing' }]} />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Billing').closest('a')).not.toBeInTheDocument();
  });
});
