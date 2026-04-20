import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker, getFinancialYearRange } from '../DateRangePicker';

const noop = jest.fn();
const emptyRange = { start: null, end: null };

describe('getFinancialYearRange', () => {
  it('returns start in April and end in March', () => {
    const { start, end } = getFinancialYearRange();
    expect(start.getMonth()).toBe(3); // April = 3
    expect(end.getMonth()).toBe(2);   // March = 2
  });
});

describe('DateRangePicker', () => {
  it('renders trigger button', () => {
    render(<DateRangePicker dateRange={emptyRange} onDateRangeChange={noop} />);
    expect(screen.getByTestId('date-range-picker-trigger')).toBeInTheDocument();
  });

  it('shows formatted range when dates are set', () => {
    const range = { start: new Date(2025, 3, 1), end: new Date(2026, 2, 31) };
    render(<DateRangePicker dateRange={range} onDateRangeChange={noop} />);
    expect(screen.getByText(/01 Apr 2025/)).toBeInTheDocument();
  });

  it('opens popover on trigger click', () => {
    render(<DateRangePicker dateRange={emptyRange} onDateRangeChange={noop} />);
    fireEvent.click(screen.getByTestId('date-range-picker-trigger'));
    expect(screen.getByTestId('date-quick-today')).toBeInTheDocument();
  });

  it('calls onDateRangeChange and closes on quick Today click', () => {
    const onChange = jest.fn();
    render(<DateRangePicker dateRange={emptyRange} onDateRangeChange={onChange} />);
    fireEvent.click(screen.getByTestId('date-range-picker-trigger'));
    fireEvent.click(screen.getByTestId('date-quick-today'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(arg.start).toBeInstanceOf(Date);
    expect(arg.end).toBeInstanceOf(Date);
  });

  it('calls onDateRangeChange with nulls on All Time click', () => {
    const onChange = jest.fn();
    render(<DateRangePicker dateRange={emptyRange} onDateRangeChange={onChange} />);
    fireEvent.click(screen.getByTestId('date-range-picker-trigger'));
    fireEvent.click(screen.getByTestId('date-quick-all'));
    expect(onChange).toHaveBeenCalledWith({ start: null, end: null });
  });
});
