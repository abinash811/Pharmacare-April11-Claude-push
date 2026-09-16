import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import ResetPassword from '../ResetPassword';
import api from '@/lib/axios';

// Regression tests for the Sep 16, 2026 self-service "Forgot password"
// flow, step 2 (docs/15_ROADMAP.md Auth Overhaul #6).

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><ResetPassword /></MemoryRouter>,
);

describe('ResetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a missing-token message and no form when the URL has no token', () => {
    renderAt('/reset-password');
    expect(screen.getByTestId('reset-password-missing-token')).toBeInTheDocument();
    expect(screen.queryByTestId('reset-password-submit-btn')).not.toBeInTheDocument();
  });

  it('blocks submitting when the two password fields do not match', async () => {
    renderAt('/reset-password?token=abc123');
    await userEvent.type(screen.getByTestId('reset-password-new-input'), 'NewPass123');
    await userEvent.type(screen.getByTestId('reset-password-confirm-input'), 'Different456');
    await userEvent.click(screen.getByTestId('reset-password-submit-btn'));

    expect(toast.error).toHaveBeenCalledWith('Passwords do not match.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits the token and new password, then redirects to login', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { message: 'ok' } });
    renderAt('/reset-password?token=abc123');
    await userEvent.type(screen.getByTestId('reset-password-new-input'), 'NewPass123');
    await userEvent.type(screen.getByTestId('reset-password-confirm-input'), 'NewPass123');
    await userEvent.click(screen.getByTestId('reset-password-submit-btn'));

    expect(api.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'abc123', new_password: 'NewPass123',
    });
    expect(toast.success).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows the real error reason for an expired or invalid token', async () => {
    (api.post as jest.Mock).mockRejectedValue({ message: 'This reset link is invalid or has expired.' });
    renderAt('/reset-password?token=expiredtoken');
    await userEvent.type(screen.getByTestId('reset-password-new-input'), 'NewPass123');
    await userEvent.type(screen.getByTestId('reset-password-confirm-input'), 'NewPass123');
    await userEvent.click(screen.getByTestId('reset-password-submit-btn'));

    expect(toast.error).toHaveBeenCalledWith('This reset link is invalid or has expired.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
