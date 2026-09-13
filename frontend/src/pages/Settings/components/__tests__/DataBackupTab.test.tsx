import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import DataBackupTab from '../DataBackupTab';
import api from '@/lib/axios';

// Regression test for the Sep 14, 2026 "Data Export & Backup" feature:
// GET /backup/export, the AuditLog model, and even the apiUrl.backupExport()
// constant all already existed, but no Settings screen ever called it —
// admins had no actual way to download a backup.

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe('DataBackupTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  it('downloads a JSON backup file and shows a success toast', async () => {
    const exportPayload = { export_date: '2026-09-14T00:00:00Z', medicines: [{ id: 'p1' }], bills: [] };
    (api.get as jest.Mock).mockResolvedValueOnce({ data: exportPayload });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<DataBackupTab />);
    await userEvent.click(screen.getByTestId('download-backup-btn'));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Backup downloaded');
    clickSpy.mockRestore();
  });

  it('shows the real error reason when the download fails, not a hardcoded message', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Only admins can export data' });

    render(<DataBackupTab />);
    await userEvent.click(screen.getByTestId('download-backup-btn'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only admins can export data'));
  });
});
