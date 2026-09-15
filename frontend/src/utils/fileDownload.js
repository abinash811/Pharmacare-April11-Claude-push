/**
 * fileDownload — shared helpers for triggering a browser download from a
 * binary axios response (responseType: 'blob').
 *
 * Why extractBlobErrorMessage exists: lib/axios.js's response interceptor
 * reads error.response.data.detail assuming a parsed JSON body — but when
 * the request used responseType: 'blob', an ERROR response's data is also
 * a Blob (axios applies responseType uniformly to success and failure), so
 * .detail is always undefined and the interceptor falls back to a generic
 * "Request failed with status code 404" instead of the real backend reason.
 * Found Sep 15, 2026 while wiring the first blob download in the app
 * (bill PDF) — the exact class of bug design-guard's Rule 14 checks for.
 */

// Blob.prototype.text() isn't universally available (older Safari, jsdom's
// test environment) — FileReader is the older, more broadly supported way
// to read a Blob's contents and works everywhere text() does.
function readBlobAsText(blob) {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

export async function extractBlobErrorMessage(err, fallback) {
  if (err.response?.data instanceof Blob) {
    try {
      const text = await readBlobAsText(err.response.data);
      const parsed = JSON.parse(text);
      if (parsed?.detail) return parsed.detail;
    } catch {
      // Not JSON (e.g. a plain-text 500) — fall through to the default below.
    }
  }
  return err.message || fallback;
}

export function downloadBlob(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
