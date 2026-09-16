import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '../AuthPage';

// Regression test for the Sep 16, 2026 self-service "Forgot password" link
// added to the login form (docs/15_ROADMAP.md Auth Overhaul #6).

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

jest.mock('@/App', () => {
  const ReactActual = require('react');
  return { AuthContext: ReactActual.createContext({ login: jest.fn() }) };
});

describe('AuthPage — Forgot password link', () => {
  it('links to /forgot-password from the login form', () => {
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    const link = screen.getByTestId('forgot-password-link');
    expect(link).toHaveAttribute('href', '/forgot-password');
  });
});
