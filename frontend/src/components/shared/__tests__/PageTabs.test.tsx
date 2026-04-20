import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageTabs } from '../PageTabs';

const TABS = [
  { key: 'bills', label: 'Bills' },
  { key: 'returns', label: 'Returns', count: 3 },
];

describe('PageTabs', () => {
  it('renders all tabs', () => {
    render(<PageTabs tabs={TABS} activeTab="bills" onChange={jest.fn()} />);
    expect(screen.getByText('Bills')).toBeInTheDocument();
    expect(screen.getByText('Returns')).toBeInTheDocument();
  });

  it('calls onChange with tab key on click', () => {
    const onChange = jest.fn();
    render(<PageTabs tabs={TABS} activeTab="bills" onChange={onChange} />);
    fireEvent.click(screen.getByText('Returns'));
    expect(onChange).toHaveBeenCalledWith('returns');
  });

  it('renders count badge when provided', () => {
    render(<PageTabs tabs={TABS} activeTab="bills" onChange={jest.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected', () => {
    render(<PageTabs tabs={TABS} activeTab="bills" onChange={jest.fn()} />);
    const billsTab = screen.getByRole('tab', { name: /bills/i });
    expect(billsTab).toHaveAttribute('aria-selected', 'true');
  });
});
