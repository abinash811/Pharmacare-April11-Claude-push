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
});
