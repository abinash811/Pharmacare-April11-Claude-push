import { downloadBlob, extractBlobErrorMessage } from '../fileDownload';

describe('downloadBlob', () => {
  beforeEach(() => {
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  it('creates an object URL, clicks a download link, then revokes the URL', () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadBlob('pdf-bytes', 'INV-000001.pdf', 'application/pdf');
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    clickSpy.mockRestore();
  });
});

describe('extractBlobErrorMessage', () => {
  // The exact bug this exists for: a request with responseType: 'blob'
  // gets a Blob back for error.response.data too, so the axios
  // interceptor's `.detail` read is always undefined and falls back to a
  // generic "Request failed with status code 404" instead of the real
  // backend reason.
  it('reads the real detail out of a JSON error Blob', async () => {
    const blob = new Blob([JSON.stringify({ detail: 'Bill not found' })], { type: 'application/json' });
    const message = await extractBlobErrorMessage({ response: { data: blob }, message: 'Request failed with status code 404' }, 'fallback');
    expect(message).toBe('Bill not found');
  });

  it('falls back to err.message when the error blob is not valid JSON', async () => {
    const blob = new Blob(['not json'], { type: 'text/plain' });
    const message = await extractBlobErrorMessage({ response: { data: blob }, message: 'Request failed with status code 500' }, 'fallback');
    expect(message).toBe('Request failed with status code 500');
  });

  it('falls back to err.message when there is no blob at all (network error)', async () => {
    const message = await extractBlobErrorMessage({ message: 'Could not reach the server.' }, 'fallback');
    expect(message).toBe('Could not reach the server.');
  });

  it('uses the given fallback when neither a blob detail nor err.message exist', async () => {
    const message = await extractBlobErrorMessage({}, 'Failed to download PDF');
    expect(message).toBe('Failed to download PDF');
  });
});
