import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AppButton from '../AppButton';

describe('AppButton', () => {
  it('renders children', () => {
    render(<AppButton>Save Bill</AppButton>);
    expect(screen.getByRole('button', { name: /save bill/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<AppButton onClick={onClick}>Click me</AppButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<AppButton disabled>Save</AppButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled and shows spinner when loading', () => {
    render(<AppButton loading>Save</AppButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Spinner present (lucide Loader2 renders an svg)
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('renders icon before label', () => {
    const icon = <svg data-testid="test-icon" />;
    render(<AppButton icon={icon}>Print</AppButton>);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('hides label when iconOnly', () => {
    render(<AppButton iconOnly icon={<svg />} aria-label="Settings" />);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders variant="chip" with no chrome and the neutral tone by default', () => {
    render(<AppButton variant="chip">25 Aug 2026</AppButton>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('p-0', 'h-auto', 'text-gray-900');
    expect(btn).not.toHaveClass('bg-brand', 'bg-gray-100');
  });

  it('applies the warning tone on variant="chip"', () => {
    render(<AppButton variant="chip" tone="warning">24 Sep 2026</AppButton>);
    expect(screen.getByRole('button')).toHaveClass('text-amber-700');
  });
});
