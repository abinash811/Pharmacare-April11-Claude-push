import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorState from '../ErrorState';

describe('ErrorState', () => {
  it('renders message and default title', () => {
    render(<ErrorState message="Failed to load data" onRetry={jest.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ErrorState title="Network error" message="Check connection" onRetry={jest.fn()} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('calls onRetry when Try again is clicked', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText(/try again/i));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides retry button when onRetry not provided', () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
  });
});
