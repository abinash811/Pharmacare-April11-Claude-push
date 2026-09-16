import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import ForgotPassword from '../ForgotPassword';
import api from '@/lib/axios';

// Regression tests for the Sep 16, 2026 self-service "Forgot password"
// flow (docs/15_ROADMAP.md Auth Overhaul #6). No real email service is
// wired in yet, so the backend returns `dev_reset_link` directly — this
// page must show it clearly labeled as a dev-mode fallback, not a real
// email confirmation.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const renderPage = () => render(
  <MemoryRouter><ForgotPassword /></MemoryRouter>,
);

describe('ForgotPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits the email and shows the generic success message', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { message: 'If an account exists for that email, a password reset link has been sent.' },
    });
    renderPage();

    await userEvent.type(screen.getByTestId('forgot-password-email-input'), 'admin@pharmacy.com');
    await userEvent.click(screen.getByTestId('forgot-password-submit-btn'));

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'admin@pharmacy.com' });
    expect(await screen.findByTestId('forgot-password-success')).toBeInTheDocument();
    expect(screen.queryByTestId('dev-reset-link-box')).not.toBeInTheDocument();
  });

  it('shows the dev-mode reset link clearly labeled when no email service is configured', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { message: 'sent', dev_reset_link: '/reset-password?token=abc123' },
    });
    renderPage();

    await userEvent.type(screen.getByTestId('forgot-password-email-input'), 'admin@pharmacy.com');
    await userEvent.click(screen.getByTestId('forgot-password-submit-btn'));

    const box = await screen.findByTestId('dev-reset-link-box');
    expect(box).toHaveTextContent(/dev mode/i);
    expect(box).toHaveTextContent(/no email service configured/i);
    expect(screen.getByTestId('dev-reset-link')).toHaveAttribute('href', '/reset-password?token=abc123');
  });

  it('shows the real error reason when the request fails', async () => {
    (api.post as jest.Mock).mockRejectedValue({ message: 'Network error, please try again' });
    renderPage();

    await userEvent.type(screen.getByTestId('forgot-password-email-input'), 'admin@pharmacy.com');
    await userEvent.click(screen.getByTestId('forgot-password-submit-btn'));

    expect(toast.error).toHaveBeenCalledWith('Network error, please try again');
  });
});
