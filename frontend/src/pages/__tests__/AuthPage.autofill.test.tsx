import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '../AuthPage';

// Regression test for a real bug reported Sep 22, 2026: on the Register
// form's "Your pharmacy" step, the browser was autofilling "Pharmacy Name"
// with the signed-in user's own saved name and "Address" with their saved
// email — because none of AuthPage's inputs declared an `autoComplete`
// attribute at all, leaving Chrome's own (wrong) guess as the only signal.
// Every field now declares the correct token so the browser can't guess.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

jest.mock('@/App', () => {
  const ReactActual = require('react');
  return { AuthContext: ReactActual.createContext({ login: jest.fn() }) };
});

describe('AuthPage — autocomplete tokens prevent browser autofill mismatches', () => {
  it('login fields declare email / current-password', () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    expect(screen.getByTestId('login-email-input')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByTestId('login-password-input')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('register step 1 (account) fields declare their real identity tokens', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    await user.click(screen.getByTestId('register-tab'));

    expect(screen.getByTestId('register-name-input')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByTestId('register-email-input')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByTestId('register-password-input')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByTestId('register-phone-input')).toHaveAttribute('autocomplete', 'tel');
  });

  it('register step 2 (pharmacy) fields declare organization/address tokens, never name or email', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    await user.click(screen.getByTestId('register-tab'));
    await user.type(screen.getByTestId('register-name-input'), 'Abinash Haldorai');
    await user.type(screen.getByTestId('register-email-input'), 'abinashdev04@gmail.com');
    await user.type(screen.getByTestId('register-password-input'), 'Passw0rd123');
    await user.type(screen.getByTestId('register-phone-input'), '9876543210');
    await user.click(screen.getByTestId('register-next-btn'));

    const pharmacyName = screen.getByTestId('register-pharmacy-name-input');
    const address = screen.getByTestId('register-address-input');
    expect(pharmacyName).toHaveAttribute('autocomplete', 'organization');
    expect(address).toHaveAttribute('autocomplete', 'address-line1');
    // The exact bug: these must never be able to match a "name" or "email"
    // autofill profile field.
    expect(pharmacyName.getAttribute('autocomplete')).not.toMatch(/^(name|email)$/);
    expect(address.getAttribute('autocomplete')).not.toMatch(/^(name|email)$/);

    expect(screen.getByTestId('register-city-input')).toHaveAttribute('autocomplete', 'address-level2');
    expect(screen.getByTestId('register-state-input')).toHaveAttribute('autocomplete', 'address-level1');
    expect(screen.getByTestId('register-pincode-input')).toHaveAttribute('autocomplete', 'postal-code');
  });
});
