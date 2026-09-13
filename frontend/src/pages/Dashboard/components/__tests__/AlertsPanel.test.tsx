import React from 'react';
import { render, screen } from '@testing-library/react';
import AlertsPanel from '../AlertsPanel';

// Regression test for the Sep 13, 2026 Inventory product-review finding:
// Settings' Low Stock/Near Expiry toggles previously did nothing anywhere —
// AlertsPanel always rendered both cards regardless of either flag.

describe('AlertsPanel', () => {
  const baseProps = {
    lowStock: [],
    expiringSoon: [],
    recentBills: [],
    quickStats: {},
    onNavigate: jest.fn(),
  };

  it('shows Low Stock and Expiring Soon cards by default', () => {
    render(<AlertsPanel {...baseProps} />);
    expect(screen.getByTestId('low-stock-alert')).toBeInTheDocument();
    expect(screen.getByTestId('expiring-soon-alert')).toBeInTheDocument();
    expect(screen.getByTestId('recent-bills-card')).toBeInTheDocument();
  });

  it('hides the Low Stock card when lowStockEnabled is false', () => {
    render(<AlertsPanel {...baseProps} lowStockEnabled={false} />);
    expect(screen.queryByTestId('low-stock-alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('expiring-soon-alert')).toBeInTheDocument();
  });

  it('hides the Expiring Soon card when nearExpiryEnabled is false', () => {
    render(<AlertsPanel {...baseProps} nearExpiryEnabled={false} />);
    expect(screen.queryByTestId('expiring-soon-alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('low-stock-alert')).toBeInTheDocument();
  });

  it('hides both alert cards when both are disabled, but always shows Recent Bills', () => {
    render(<AlertsPanel {...baseProps} lowStockEnabled={false} nearExpiryEnabled={false} />);
    expect(screen.queryByTestId('low-stock-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expiring-soon-alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('recent-bills-card')).toBeInTheDocument();
  });
});
