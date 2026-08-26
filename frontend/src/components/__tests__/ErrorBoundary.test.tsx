import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>All good</div>;
};

// Suppress console.error for expected boundary triggers
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => (console.error as jest.Mock).mockRestore());

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><Bomb shouldThrow={false} /></ErrorBoundary>);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(<ErrorBoundary><Bomb shouldThrow /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Test explosion/)).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
  });

  it('resets and re-renders children after Try again click', () => {
    // A reset only helps if the underlying cause is gone by the time it fires —
    // clicking reset while the same throwing child is still mounted re-throws
    // immediately, per React's error boundary semantics. Flip the condition
    // first, the way a real transient error would clear before retrying.
    let shouldThrow = true;
    const FlakyBomb = () => {
      if (shouldThrow) throw new Error('Test explosion');
      return <div>All good</div>;
    };
    render(<ErrorBoundary><FlakyBomb /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
