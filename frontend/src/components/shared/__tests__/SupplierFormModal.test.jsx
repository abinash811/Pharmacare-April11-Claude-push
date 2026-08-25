import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupplierFormModal from '../SupplierFormModal';

const baseProps = {
  open: true,
  editingSupplier: null,
  onClose: jest.fn(),
  onSave: jest.fn().mockResolvedValue(true),
};

describe('SupplierFormModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders add form when editingSupplier is null', () => {
    render(<SupplierFormModal {...baseProps} />);
    expect(screen.getByText('Add New Supplier')).toBeInTheDocument();
  });

  it('renders edit form with existing data', () => {
    render(<SupplierFormModal {...baseProps} editingSupplier={{ id: '1', name: 'MedPharma', phone: '9876543210' }} />);
    expect(screen.getByText('Edit Supplier')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MedPharma')).toBeInTheDocument();
  });

  it('shows validation error when name is empty', async () => {
    render(<SupplierFormModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('submit-supplier-btn'));
    await waitFor(() => expect(screen.getByText('Supplier name is required')).toBeInTheDocument());
    expect(baseProps.onSave).not.toHaveBeenCalled();
  });

  it('shows GSTIN validation error for invalid format', async () => {
    render(<SupplierFormModal {...baseProps} />);
    await userEvent.type(screen.getByTestId('supplier-name-input'), 'MedPharma');
    const gstinInput = screen.getAllByRole('textbox').find(el => el.className.includes('font-mono'));
    await userEvent.type(gstinInput, 'INVALIDGSTIN');
    fireEvent.click(screen.getByTestId('submit-supplier-btn'));
    await waitFor(() => expect(screen.getByText(/valid GSTIN/i)).toBeInTheDocument());
  });

  it('calls onSave with form data on valid submit', async () => {
    render(<SupplierFormModal {...baseProps} />);
    await userEvent.type(screen.getByTestId('supplier-name-input'), 'MedPharma Ltd');
    fireEvent.click(screen.getByTestId('submit-supplier-btn'));
    await waitFor(() => expect(baseProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MedPharma Ltd' }),
      undefined
    ));
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<SupplierFormModal {...baseProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('prefills the name field from initialName on a fresh form', () => {
    render(<SupplierFormModal {...baseProps} initialName="Brand New Distributor Pvt Ltd" />);
    expect(screen.getByDisplayValue('Brand New Distributor Pvt Ltd')).toBeInTheDocument();
    expect(screen.getByText('Add New Supplier')).toBeInTheDocument();
  });

  it('ignores initialName when editing an existing supplier', () => {
    render(<SupplierFormModal {...baseProps} editingSupplier={{ id: '1', name: 'MedPharma' }} initialName="Should Not Appear" />);
    expect(screen.getByDisplayValue('MedPharma')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Should Not Appear')).not.toBeInTheDocument();
  });
});
