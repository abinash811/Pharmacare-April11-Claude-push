import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge, PaymentStatusBadge, CustomerTypeBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders status label capitalised', () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('renders fallback when status is empty', () => {
    render(<StatusBadge status="" fallback="N/A" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders fallback when status is null', () => {
    render(<StatusBadge status={null} fallback="-" />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('uses custom label over auto-capitalise', () => {
    render(<StatusBadge status="paid" label="Settled" />);
    expect(screen.getByText('Settled')).toBeInTheDocument();
  });

  it('uses LABEL_MAPPINGS for snake_case keys', () => {
    render(<StatusBadge status="same_as_original" />);
    expect(screen.getByText('Same as Original')).toBeInTheDocument();
  });

  it('sets data-testid with normalised status', () => {
    render(<StatusBadge status="Paid" />);
    expect(screen.getByTestId('status-badge-paid')).toBeInTheDocument();
  });
});

describe('PaymentStatusBadge', () => {
  it('shows Due for due status', () => {
    render(<PaymentStatusBadge status="due" />);
    expect(screen.getByText('Due')).toBeInTheDocument();
  });

  it('shows UPI label when paid via upi', () => {
    render(<PaymentStatusBadge status="paid" paymentMethod="upi" />);
    expect(screen.getByText('UPI')).toBeInTheDocument();
  });

  it('shows Cash when paid with no method', () => {
    render(<PaymentStatusBadge status="paid" />);
    expect(screen.getByText('Cash')).toBeInTheDocument();
  });

  it('shows Parked for parked status', () => {
    render(<PaymentStatusBadge status="parked" />);
    expect(screen.getByText('Parked')).toBeInTheDocument();
  });
});

describe('CustomerTypeBadge', () => {
  it('shows Regular as fallback when type is empty', () => {
    render(<CustomerTypeBadge type="" />);
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  it('renders provided type', () => {
    render(<CustomerTypeBadge type="wholesale" />);
    expect(screen.getByText('Wholesale')).toBeInTheDocument();
  });
});
