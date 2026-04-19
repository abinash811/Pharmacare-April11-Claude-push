import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterPills } from '../FilterPills';

const OPTIONS = [
  { key: 'all',  label: 'All'  },
  { key: 'paid', label: 'Paid' },
  { key: 'due',  label: 'Due'  },
];

describe('FilterPills', () => {
  it('renders all options', () => {
    render(<FilterPills options={OPTIONS} active="all" onChange={jest.fn()} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Due')).toBeInTheDocument();
  });

  it('marks active pill with dark bg class', () => {
    render(<FilterPills options={OPTIONS} active="paid" onChange={jest.fn()} />);
    const paidBtn = screen.getByText('Paid').closest('button');
    expect(paidBtn).toHaveClass('bg-gray-900');
  });

  it('calls onChange with clicked key', () => {
    const onChange = jest.fn();
    render(<FilterPills options={OPTIONS} active="all" onChange={onChange} />);
    fireEvent.click(screen.getByText('Due'));
    expect(onChange).toHaveBeenCalledWith('due');
  });
});
