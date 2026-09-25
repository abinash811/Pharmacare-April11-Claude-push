import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import WhatsAppShareModal from '../WhatsAppShareModal';
import api from '@/lib/axios';

// UC — Billing's WhatsApp share used to error out with no way to send when
// a customer had no mobile number on file, and never offered the real
// invoice PDF at all (plain text only). Fixed Sep 25, 2026.

jest.mock('@/lib/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const BILL = { id: 'bill-1', bill_number: 'INV-000001', total_amount: 112, customer_mobile: '9876543210' };

describe('WhatsAppShareModal', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => openSpy.mockRestore());

  it('pre-fills the number on file and sends to it', async () => {
    render(<WhatsAppShareModal open bill={BILL} onClose={jest.fn()} />);
    expect(screen.getByTestId('whatsapp-number-input')).toHaveValue('9876543210');

    await userEvent.click(screen.getByTestId('whatsapp-send-btn'));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/919876543210?text='), '_blank',
    );
  });

  it('lets the user enter a custom number when none is on file, instead of erroring out', async () => {
    const onClose = jest.fn();
    render(<WhatsAppShareModal open bill={{ ...BILL, customer_mobile: '' }} onClose={onClose} />);

    expect(screen.getByText(/No number on file/)).toBeInTheDocument();
    expect(screen.getByTestId('whatsapp-number-input')).toHaveValue('');

    await userEvent.type(screen.getByTestId('whatsapp-number-input'), '9123456789');
    await userEvent.click(screen.getByTestId('whatsapp-send-btn'));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/919123456789?text='), '_blank',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects an invalid number instead of opening WhatsApp anyway', async () => {
    render(<WhatsAppShareModal open bill={{ ...BILL, customer_mobile: '' }} onClose={jest.fn()} />);
    await userEvent.type(screen.getByTestId('whatsapp-number-input'), '12345');
    await userEvent.click(screen.getByTestId('whatsapp-send-btn'));

    expect(toast.error).toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('downloads the real bill PDF to attach, instead of only sending plain text', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: 'pdf-bytes' });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<WhatsAppShareModal open bill={BILL} onClose={jest.fn()} />);
    await userEvent.click(screen.getByTestId('whatsapp-download-pdf'));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/pdf'), { responseType: 'blob' });
    });
    expect(clickSpy).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('attach it'));
    clickSpy.mockRestore();
  });

  it('renders nothing when there is no bill', () => {
    const { container } = render(<WhatsAppShareModal open={false} bill={null} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
