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

  it('applies the semantic active color when activeColor is set', () => {
    const options = [{ key: 'on', label: 'On', activeColor: 'green' as const }, { key: 'off', label: 'Off' }];
    render(<FilterPills options={options} active="on" onChange={jest.fn()} />);
    const onBtn = screen.getByText('On').closest('button');
    expect(onBtn).toHaveClass('bg-green-50', 'text-green-700');
    expect(onBtn).not.toHaveClass('bg-gray-900');
  });

  it('keeps the default dark pill when activeColor is omitted', () => {
    const options = [{ key: 'on', label: 'On', activeColor: 'green' as const }, { key: 'off', label: 'Off' }];
    render(<FilterPills options={options} active="off" onChange={jest.fn()} />);
    const offBtn = screen.getByText('Off').closest('button');
    expect(offBtn).toHaveClass('bg-gray-100', 'text-gray-600');
  });
});
