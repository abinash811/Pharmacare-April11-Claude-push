import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerFormDialog from '../components/CustomerFormDialog';

const baseProps = {
  open: true,
  editingCustomer: null,
  onClose: jest.fn(),
  onSave: jest.fn().mockResolvedValue(true),
};

describe('CustomerFormDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders add form when editingCustomer is null', () => {
    render(<CustomerFormDialog {...baseProps} />);
    expect(screen.getByText('Add New Customer')).toBeInTheDocument();
  });

  it('renders edit form when editingCustomer is provided', () => {
    render(<CustomerFormDialog {...baseProps} editingCustomer={{ id: '1', name: 'Ramesh', phone: '9876543210', customer_type: 'regular' }} />);
    expect(screen.getByText('Edit Customer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ramesh')).toBeInTheDocument();
  });

  it('shows validation error when name is empty and form is submitted', async () => {
    render(<CustomerFormDialog {...baseProps} />);
    fireEvent.click(screen.getByText('Add Customer'));
    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument());
    expect(baseProps.onSave).not.toHaveBeenCalled();
  });

  it('shows phone validation error for invalid number', async () => {
    render(<CustomerFormDialog {...baseProps} />);
    await userEvent.type(screen.getByTestId('customer-name-input'), 'Ramesh');
    await userEvent.type(screen.getAllByRole('textbox')[1], '12345');
    fireEvent.click(screen.getByText('Add Customer'));
    await waitFor(() => expect(screen.getByText(/valid 10-digit/i)).toBeInTheDocument());
  });

  it('calls onSave with form data and closes on success', async () => {
    render(<CustomerFormDialog {...baseProps} />);
    await userEvent.type(screen.getByTestId('customer-name-input'), 'Ramesh Kumar');
    fireEvent.click(screen.getByText('Add Customer'));
    await waitFor(() => expect(baseProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ramesh Kumar' }),
      undefined
    ));
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled());
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<CustomerFormDialog {...baseProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('shows GSTIN field for wholesale customer type', async () => {
    render(<CustomerFormDialog {...baseProps} />);
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'wholesale');
    expect(screen.getByPlaceholderText('22AAAAA0000A1Z5')).toBeInTheDocument();
  });

  it('does not close when onSave returns false', async () => {
    const onSave = jest.fn().mockResolvedValue(false);
    render(<CustomerFormDialog {...baseProps} onSave={onSave} />);
    await userEvent.type(screen.getByTestId('customer-name-input'), 'Ramesh');
    fireEvent.click(screen.getByText('Add Customer'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });
});
