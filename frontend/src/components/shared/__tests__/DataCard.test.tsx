import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataCard } from '../DataCard';

describe('DataCard', () => {
  it('renders children', () => {
    render(<DataCard><span>Card content</span></DataCard>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('has no padding by default (noPadding defaults to true)', () => {
    render(<DataCard><span /></DataCard>);
    expect(screen.getByTestId('data-card').querySelector('.p-0')).toBeInTheDocument();
  });

  it('applies padding when noPadding is false', () => {
    render(<DataCard noPadding={false}><span /></DataCard>);
    expect(screen.getByTestId('data-card').querySelector('.p-4')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<DataCard className="mt-4"><span /></DataCard>);
    expect(container.firstChild).toHaveClass('mt-4');
  });
});
