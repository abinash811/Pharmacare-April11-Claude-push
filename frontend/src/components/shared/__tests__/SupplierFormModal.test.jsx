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

  it('associates every label with its input via htmlFor/id (docs/17_ACCESSIBILITY.md)', () => {
    // Regression test for the Sep 19, 2026 docs review finding: labels here
    // used to be unconnected siblings of their inputs (no htmlFor/id), so a
    // screen reader announced nothing when an input received focus and
    // clicking a label didn't focus its input. getByLabelText only finds a
    // field through that real association, so this fails if it regresses.
    render(<SupplierFormModal {...baseProps} />);
    expect(screen.getByLabelText('Supplier Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact Person')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
    expect(screen.getByLabelText('Credit Days')).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('links an invalid field to its error message via aria-describedby and role=alert', async () => {
    render(<SupplierFormModal {...baseProps} />);
    fireEvent.click(screen.getByTestId('submit-supplier-btn'));
    const nameInput = screen.getByTestId('supplier-name-input');
    await waitFor(() => expect(nameInput).toHaveAttribute('aria-describedby', 'name-error'));
    const message = screen.getByText('Supplier name is required');
    expect(message).toHaveAttribute('id', 'name-error');
    expect(message).toHaveAttribute('role', 'alert');
  });

  it('marks the invalid field itself, not just the message below it', async () => {
    // Regression test for the component-state-matrix fix (Sep 11, 2026):
    // this form used to show a red error message with no visual change on
    // the input box it belonged to. aria-invalid is what the CSS
    // (aria-invalid:border-red-500) hooks into, so asserting the attribute
    // is the real check here, not just that some red text exists somewhere.
    render(<SupplierFormModal {...baseProps} />);
    const nameInput = screen.getByTestId('supplier-name-input');
    expect(nameInput).toHaveAttribute('aria-invalid', 'false');
    fireEvent.click(screen.getByTestId('submit-supplier-btn'));
    await waitFor(() => expect(nameInput).toHaveAttribute('aria-invalid', 'true'));
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
