import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoiceAttachmentUpload from '../InvoiceAttachmentUpload';

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
import { toast } from 'sonner';

const attach = async (file: File) => {
  const input = screen.getByTestId('invoice-attachment-input') as HTMLInputElement;
  await waitFor(() => fireEvent.change(input, { target: { files: [file] } }));
};

describe('InvoiceAttachmentUpload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the attach button with nothing attached', () => {
    render(<InvoiceAttachmentUpload value={null} onChange={jest.fn()} />);
    expect(screen.getByTestId('attach-invoice-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-attachment-preview')).not.toBeInTheDocument();
  });

  it('accepts a valid PDF and reports it via onChange', async () => {
    const onChange = jest.fn();
    render(<InvoiceAttachmentUpload value={null} onChange={onChange} />);
    const file = new File(['%PDF-1.4'], 'bill.pdf', { type: 'application/pdf' });
    await attach(file);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bill.pdf', data: expect.stringContaining('data:application/pdf') }),
    ));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rejects a disallowed file type and never calls onChange', async () => {
    const onChange = jest.fn();
    render(<InvoiceAttachmentUpload value={null} onChange={onChange} />);
    const file = new File(['hi'], 'bill.txt', { type: 'text/plain' });
    await attach(file);
    expect(toast.error).toHaveBeenCalledWith('Attach an image (JPG/PNG/WebP) or PDF');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a file over 5MB and never calls onChange', async () => {
    const onChange = jest.fn();
    render(<InvoiceAttachmentUpload value={null} onChange={onChange} />);
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'bill.png', { type: 'image/png' });
    await attach(big);
    expect(toast.error).toHaveBeenCalledWith('Invoice attachment must be under 5MB');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lets you preview the attached file before confirming the purchase', () => {
    render(<InvoiceAttachmentUpload value={{ data: 'data:application/pdf;base64,AAAA', name: 'bill.pdf' }} onChange={jest.fn()} />);
    const link = screen.getByTestId('preview-invoice-attachment-link');
    expect(link).toHaveAttribute('href', 'data:application/pdf;base64,AAAA');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('removing the attachment calls onChange(null)', () => {
    const onChange = jest.fn();
    render(<InvoiceAttachmentUpload value={{ data: 'data:application/pdf;base64,AAAA', name: 'bill.pdf' }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('remove-invoice-attachment-btn'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
