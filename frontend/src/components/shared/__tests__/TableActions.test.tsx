import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableActions } from '../TableActions';

describe('TableActions', () => {
  it('renders only provided actions', () => {
    render(<TableActions onView={jest.fn()} />);
    expect(screen.getByTestId('action-view')).toBeInTheDocument();
    expect(screen.queryByTestId('action-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-delete')).not.toBeInTheDocument();
  });

  it('renders all three when all handlers provided', () => {
    render(<TableActions onView={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByTestId('action-view')).toBeInTheDocument();
    expect(screen.getByTestId('action-edit')).toBeInTheDocument();
    expect(screen.getByTestId('action-delete')).toBeInTheDocument();
  });

  it('calls onView when view button clicked', () => {
    const onView = jest.fn();
    render(<TableActions onView={onView} />);
    fireEvent.click(screen.getByTestId('action-view'));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    render(<TableActions onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('action-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when no handlers provided', () => {
    const { container } = render(<TableActions />);
    expect(container.querySelector('[data-testid="action-view"]')).not.toBeInTheDocument();
  });
});
