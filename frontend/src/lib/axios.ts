/**
 * PHARMACARE — Configured Axios Instance
 *
 * Single axios instance with:
 *   - baseURL set to REACT_APP_BACKEND_URL/api
 *   - Request interceptor: attaches Authorization header automatically
 *   - Response interceptor: redirects to login on 401, surfaces error detail
 *
 * Usage (replaces scattered `axios.get(\`\${API}/...\`, { headers: {...} })`):
 *
 *   import api from '@/lib/axios';
 *   import { apiUrl } from '@/constants/api';
 *
 *   const { data } = await api.get(apiUrl.bills({ page_size: 100 }));
 *   const { data } = await api.post(apiUrl.customers(), payload);
 *   const { data } = await api.put(apiUrl.customer(id), payload);
 *   await api.delete(apiUrl.customer(id));
 *
 * Error handling:
 *   The response interceptor re-throws with a normalised `.message` so
 *   callers can do: toast.error(error.message) without extra null-checks.
 */

import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// ── Instance ──────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  timeout: 30_000,                       // 30s — enough for report generation
  headers: { 'Content-Type': 'application/json' },
});


// ── Request Interceptor ───────────────────────────────────────────────────────
// Attaches the JWT token from localStorage on every outgoing request.
// Pages no longer need to manually pass { headers: { Authorization: ... } }.

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);


// ── Response Interceptor ──────────────────────────────────────────────────────

api.interceptors.response.use(
  // Success — pass through unchanged
  (response) => response,

  // Error — normalise and re-throw
  (error) => {
    const status  = error.response?.status;
    const detail  = error.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg ?? d).join('; ')   // FastAPI validation errors
      : detail || error.message || 'Something went wrong';

    // 401 — token expired or invalid → clear storage and redirect to login
    if (status === 401) {
      localStorage.removeItem('token');
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    // Attach a clean message so callers can do: toast.error(err.message)
    error.message = message;
    return Promise.reject(error);
  },
);


// ── Export ────────────────────────────────────────────────────────────────────

export default api;

/**
 * Convenience: build the full API base URL (useful for non-axios calls
 * like file downloads where you need the raw URL string).
 *
 *   const url = apiBase('/backup/export');
 *   window.open(url);
 */
export const apiBase = (path = ''): string =>
  `${process.env.REACT_APP_BACKEND_URL}/api${path.startsWith('/') ? path : `/${path}`}`;
