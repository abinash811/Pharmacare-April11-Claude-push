import React from 'react';
import { render, screen } from '@testing-library/react';
import { TableSkeleton, PageSkeleton, InlineLoader, CardSkeleton } from '../TableSkeleton';

describe('TableSkeleton', () => {
  it('renders correct number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} columns={4} />);
    const rows = container.querySelectorAll('.flex.items-center.gap-4');
    expect(rows).toHaveLength(3);
  });

  it('renders correct number of cells per row', () => {
    const { container } = render(<TableSkeleton rows={1} columns={4} />);
    const row = container.querySelector('.flex.items-center.gap-4')!;
    expect(row.children).toHaveLength(4);
  });
});

describe('PageSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('InlineLoader', () => {
  it('shows default loading text', () => {
    render(<InlineLoader />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows custom text', () => {
    render(<InlineLoader text="Fetching bills..." />);
    expect(screen.getByText('Fetching bills...')).toBeInTheDocument();
  });

  it('renders spinner', () => {
    const { container } = render(<InlineLoader />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('CardSkeleton', () => {
  it('renders correct number of cards', () => {
    const { container } = render(<CardSkeleton count={4} />);
    const cards = container.querySelectorAll('.bg-white.rounded-xl');
    expect(cards).toHaveLength(4);
  });
});
