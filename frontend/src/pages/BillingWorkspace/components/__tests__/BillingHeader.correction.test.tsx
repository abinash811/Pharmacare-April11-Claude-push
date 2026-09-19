import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BillingHeader from '../BillingHeader';

// Regression tests for the Sep 18, 2026 same-day bill-edit feature
// (docs/15_ROADMAP.md's Billing table): editing an already-finalized
// (paid/due) bill reuses BillingHeader's edit mode, but isn't a real
// "finalize a draft" or "park it" action — isCorrection relabels/hides
// accordingly.

function renderHeader(props = {}) {
  return render(
    <MemoryRouter>
      <BillingHeader
        viewMode="edit"
        loadedBill={{ bill_number: 'INV-000001' }}
        draftNumber={null}
        isSaving={false}
        onBack={jest.fn()}
        onParkBill={jest.fn()}
        onSavePrint={jest.fn()}
        onFinalise={jest.fn()}
        onPrintFormatChange={jest.fn()}
        onPrint={jest.fn()}
        onReturn={jest.fn()}
        onHistory={jest.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('BillingHeader — isCorrection (same-day edit of a finalized bill)', () => {
  it('shows Park Bill and "Finalise Bill" for a normal draft edit', () => {
    renderHeader({ isCorrection: false });
    expect(screen.getByTestId('park-bill-btn')).toBeInTheDocument();
    expect(screen.getByTestId('finalise-btn')).toHaveTextContent('Finalise Bill');
  });

  it('hides Park Bill and relabels to "Save Changes" when correcting a finalized bill', () => {
    renderHeader({ isCorrection: true });
    expect(screen.queryByTestId('park-bill-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('finalise-btn')).toHaveTextContent('Save Changes');
  });

  it('titles the page with the real invoice number, not "Continue Bill", when correcting', () => {
    renderHeader({ isCorrection: true });
    expect(screen.getByText('Edit #INV-000001')).toBeInTheDocument();
  });
});
