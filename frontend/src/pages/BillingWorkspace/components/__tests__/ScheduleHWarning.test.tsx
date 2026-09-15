import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ScheduleHWarning from '../ScheduleHWarning';

// Regression tests for the Sep 15, 2026 Schedule H1 patient-details fix:
// the register's Patient Address/Age columns were always blank because
// nothing ever collected them. Per Rule 65 (Drugs & Cosmetics Rules), the
// patient's name AND address must be recorded at the time of supply, same
// standing as the prescriber's own name/registration — so for an H1 item,
// this dialog must require both a doctor name and a patient address
// before Confirm is enabled, not just a checkbox-style confirmation.

const noop = () => {};

describe('ScheduleHWarning — plain Schedule H (confirm-only)', () => {
  it('shows the simple confirmation and allows confirming with no fields', () => {
    render(
      <ScheduleHWarning
        open requireAddress={false}
        doctorName="" onDoctorNameChange={noop}
        patientAddress="" onPatientAddressChange={noop}
        patientAge="" onPatientAgeChange={noop}
        onCancel={noop} onConfirm={noop}
      />,
    );
    expect(screen.getAllByText(/Schedule H medicines/i).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('schedule-h1-patient-address')).not.toBeInTheDocument();
    expect(screen.getByTestId('schedule-h-confirm')).not.toBeDisabled();
  });
});

describe('ScheduleHWarning — Schedule H1 (requires doctor + patient address)', () => {
  it('disables Confirm when doctor name and patient address are both empty', () => {
    render(
      <ScheduleHWarning
        open requireAddress
        doctorName="" onDoctorNameChange={noop}
        patientAddress="" onPatientAddressChange={noop}
        patientAge="" onPatientAgeChange={noop}
        onCancel={noop} onConfirm={noop}
      />,
    );
    expect(screen.getByTestId('schedule-h-confirm')).toBeDisabled();
  });

  it('disables Confirm when only doctor name is filled', () => {
    render(
      <ScheduleHWarning
        open requireAddress
        doctorName="Dr. Test" onDoctorNameChange={noop}
        patientAddress="" onPatientAddressChange={noop}
        patientAge="" onPatientAgeChange={noop}
        onCancel={noop} onConfirm={noop}
      />,
    );
    expect(screen.getByTestId('schedule-h-confirm')).toBeDisabled();
  });

  it('enables Confirm once both doctor name and patient address are filled — age stays optional', () => {
    render(
      <ScheduleHWarning
        open requireAddress
        doctorName="Dr. Test" onDoctorNameChange={noop}
        patientAddress="12 Test Lane" onPatientAddressChange={noop}
        patientAge="" onPatientAgeChange={noop}
        onCancel={noop} onConfirm={noop}
      />,
    );
    expect(screen.getByTestId('schedule-h-confirm')).not.toBeDisabled();
  });

  it('calls onPatientAddressChange as the user types', () => {
    const onPatientAddressChange = jest.fn();
    render(
      <ScheduleHWarning
        open requireAddress
        doctorName="Dr. Test" onDoctorNameChange={noop}
        patientAddress="" onPatientAddressChange={onPatientAddressChange}
        patientAge="" onPatientAgeChange={noop}
        onCancel={noop} onConfirm={noop}
      />,
    );
    fireEvent.change(screen.getByTestId('schedule-h1-patient-address'), { target: { value: '5 New Address' } });
    expect(onPatientAddressChange).toHaveBeenCalledWith('5 New Address');
  });
});
