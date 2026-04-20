import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDialog, DeleteConfirmDialog, DiscardConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    render(<ConfirmDialog open onClose={jest.fn()} onConfirm={jest.fn()} title="Delete?" description="Cannot undo." />);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Cannot undo.')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog open onClose={jest.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = jest.fn();
    render(<ConfirmDialog open onClose={onClose} onConfirm={jest.fn()} />);
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when isLoading', () => {
    render(<ConfirmDialog open onClose={jest.fn()} onConfirm={jest.fn()} isLoading />);
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled();
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeDisabled();
  });
});

describe('DeleteConfirmDialog', () => {
  it('includes itemName in description', () => {
    render(<DeleteConfirmDialog open onClose={jest.fn()} onConfirm={jest.fn()} itemName="Bill #123" />);
    expect(screen.getByText(/Bill #123/)).toBeInTheDocument();
  });
});

describe('DiscardConfirmDialog', () => {
  it('shows discard copy', () => {
    render(<DiscardConfirmDialog open onClose={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.getByText('Discard Changes?')).toBeInTheDocument();
  });
});
