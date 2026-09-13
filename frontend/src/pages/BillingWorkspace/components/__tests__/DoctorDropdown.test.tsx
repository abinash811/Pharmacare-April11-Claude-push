import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '@/lib/axios';
import DoctorDropdown from '../DoctorDropdown';

jest.mock('@/lib/axios', () => ({ get: jest.fn() }));

// Regression tests for the Sep 13, 2026 Billing product-review finding:
// BillingSubbar's toolbar row has `overflow-x-auto`, which per the CSS
// overflow spec forces `overflow-y` to also clip — silently hiding this
// dropdown's suggestions no matter their z-index. Fixed by rendering
// suggestions through the shared Radix Popover (portals to document.body),
// the same pattern the Date field's Calendar already used correctly.
//
// jsdom doesn't do real CSS layout/paint, so it can't reproduce the
// clipping bug itself — what these tests lock in is the real regression
// that fixing it introduced: since the portal moves suggestions outside
// wrapperRef's DOM subtree, the existing "outside click saves freetext"
// handler misfired on every suggestion click, saving the raw typed text
// instead of the selected doctor. Caught live while verifying the fix.
describe('DoctorDropdown', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows DB suggestions when typing a matching name', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { data: [{ id: 'd1', name: 'Dr Priya Sharma', specialization: 'General Physician' }] },
    });

    render(<DoctorDropdown value="" onChange={jest.fn()} />);
    await userEvent.click(screen.getByTestId('doctor-chip'));
    await userEvent.type(screen.getByTestId('doctor-search-input'), 'Pri');

    await waitFor(() => expect(screen.getByText('Dr Priya Sharma')).toBeInTheDocument());
  });

  it('selecting a suggestion commits the doctor name, not the raw typed query', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { data: [{ id: 'd1', name: 'Dr Priya Sharma', specialization: 'General Physician' }] },
    });
    const onChange = jest.fn();

    render(<DoctorDropdown value="" onChange={onChange} />);
    await userEvent.click(screen.getByTestId('doctor-chip'));
    await userEvent.type(screen.getByTestId('doctor-search-input'), 'Pri');
    await waitFor(() => expect(screen.getByTestId('doctor-option-d1')).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('doctor-option-d1'));

    // onChange also fires per-keystroke while typing ("P", "Pr", "Pri") —
    // what matters is the final call after selecting, not that "Pri" was
    // never passed at all.
    expect(onChange).toHaveBeenLastCalledWith('Dr Priya Sharma');
  });

  it('typing a name with no DB match and clicking away saves it as free text', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: [] } });
    const onChange = jest.fn();

    render(
      <div>
        <DoctorDropdown value="" onChange={onChange} />
        <div>outside</div>
      </div>
    );
    await userEvent.click(screen.getByTestId('doctor-chip'));
    await userEvent.type(screen.getByTestId('doctor-search-input'), 'Dr Brand New');
    await userEvent.click(screen.getByText('outside'));

    expect(onChange).toHaveBeenCalledWith('Dr Brand New');
  });
});
