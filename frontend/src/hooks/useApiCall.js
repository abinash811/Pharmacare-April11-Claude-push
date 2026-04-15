/**
 * PHARMACARE — useApiCall & useFetch
 *
 * Eliminates the copy-pasted loading/error/toast boilerplate repeated across
 * every page in the app:
 *
 *   BEFORE (current pattern in ~30 page components):
 *     const [loading, setLoading] = useState(false);
 *     const fetchData = async () => {
 *       setLoading(true);
 *       try {
 *         const res = await api.get(apiUrl.bills({ page: 1 }));
 *         setBills(res.data.data || res.data);
 *       } catch (error) {
 *         toast.error(error.response?.data?.detail || 'Failed to load bills');
 *       } finally {
 *         setLoading(false);
 *       }
 *     };
 *
 *   AFTER:
 *     const { loading, execute: fetchData } = useApiCall();
 *     const fetchData = async () => {
 *       const data = await execute(() => api.get(apiUrl.bills({ page: 1 })));
 *       if (data) setBills(data.data || data);
 *     };
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * useApiCall()
 *
 *   Generic imperative wrapper — call `execute(fn)` whenever you want.
 *   Returns { loading, error, execute }.
 *
 * useFetch(apiFn, deps, options)
 *
 *   Declarative — fires automatically on mount and whenever `deps` change.
 *   Returns { data, loading, error, refetch }.
 *   Handles the common fetchData-on-mount pattern with a single hook call.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';


// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract a user-friendly message from an axios error or plain Error.
 * Mirrors the normalisation in lib/axios.js response interceptor.
 */
const getErrorMessage = (error, fallback = 'Something went wrong') => {
  if (!error) return fallback;
  // lib/axios.js already normalises error.message for API errors
  if (error.message && error.message !== 'Something went wrong') {
    return error.message;
  }
  // Legacy: direct response access (for non-intercepted axios instances)
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg ?? d).join('; ');
  }
  if (detail) return detail;
  return error.message || fallback;
};


// ── useApiCall ────────────────────────────────────────────────────────────────

/**
 * Imperative API call wrapper.
 * Manages loading + error state and shows a toast on failure.
 *
 * @returns {{ loading: boolean, error: Error|null, execute: Function }}
 *
 * @example
 *   const { loading, execute } = useApiCall();
 *
 *   const handleSave = async () => {
 *     const data = await execute(
 *       () => api.post(apiUrl.bills(), payload),
 *       { successMsg: 'Bill saved', errorMsg: 'Failed to save bill' }
 *     );
 *     if (data) navigate(routeTo.bill(data.id));
 *   };
 *
 * Options:
 *   successMsg  {string}   — toast.success message (skip if omitted)
 *   errorMsg    {string}   — fallback error message for toast.error
 *   showToast   {boolean}  — set false to suppress toast entirely (default true)
 *   transform   {Function} — (response) => value  — extract .data automatically
 */
export const useApiCall = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (apiFn, options = {}) => {
    const {
      successMsg = '',
      errorMsg   = 'Something went wrong',
      showToast  = true,
      transform  = (res) => res.data,
    } = options;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await apiFn();
      const result   = transform(response);

      if (mountedRef.current) {
        setLoading(false);
        if (successMsg && showToast) toast.success(successMsg);
      }
      return result;

    } catch (err) {
      const message = getErrorMessage(err, errorMsg);

      if (mountedRef.current) {
        setLoading(false);
        setError(err);
        if (showToast) toast.error(message);
      }
      return null;   // caller can check for null to detect failure
    }
  }, []);

  return { loading, error, execute };
};


// ── useFetch ──────────────────────────────────────────────────────────────────

/**
 * Declarative data-fetching hook — fires on mount and whenever deps change.
 * Handles abort on unmount / dep change to prevent stale state updates.
 *
 * @param {Function|null} apiFn   — () => api.get(...) — pass null to skip
 * @param {Array}         deps    — dependency array (like useEffect)
 * @param {object}        options — { errorMsg, initialData, transform, skip }
 * @returns {{ data, loading, error, refetch }}
 *
 * @example
 *   // Replace the entire manual fetchData pattern:
 *   const { data: bills, loading, refetch } = useFetch(
 *     () => api.get(apiUrl.bills({ page, search: debouncedSearch })),
 *     [page, debouncedSearch],
 *     { errorMsg: 'Failed to load bills', initialData: { data: [], total: 0 } }
 *   );
 *
 * Options:
 *   errorMsg    {string}   — fallback error toast message
 *   initialData {*}        — initial value of `data` before first fetch
 *   transform   {Function} — (response) => value  (default: res => res.data)
 *   skip        {boolean}  — set true to prevent fetch (e.g. when deps not ready)
 */
export const useFetch = (apiFn, deps = [], options = {}) => {
  const {
    errorMsg    = 'Failed to load data',
    initialData = null,
    transform   = (res) => res.data,
    skip        = false,
  } = options;

  const [data,    setData]    = useState(initialData);
  const [loading, setLoading] = useState(!skip);
  const [error,   setError]   = useState(null);

  // Stable ref for the latest apiFn — avoids re-triggering effect
  const apiFnRef = useRef(apiFn);
  useEffect(() => { apiFnRef.current = apiFn; });

  // Counter incremented by refetch() to manually trigger re-fetch
  const [refetchCount, setRefetchCount] = useState(0);
  const refetch = useCallback(() => setRefetchCount((n) => n + 1), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (skip || !apiFnRef.current) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await apiFnRef.current();
        if (!cancelled) {
          setData(transform(response));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setLoading(false);
          toast.error(getErrorMessage(err, errorMsg));
        }
      }
    })();

    return () => { cancelled = true; };

  // deps are spread-in; refetchCount allows manual re-trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchCount, skip]);

  return { data, loading, error, refetch };
};


// ── useParallelFetch ──────────────────────────────────────────────────────────

/**
 * Fetches multiple endpoints in parallel (Promise.all).
 * Replaces the Promise.all pattern in Customers.js and similar pages.
 *
 * @param {Array<Function>} apiFns   — array of () => api.get(...) functions
 * @param {Array}           deps     — dependency array
 * @param {object}          options  — { errorMsg, transforms, skip }
 * @returns {{ results, loading, error, refetch }}
 *
 * @example
 *   const { results: [customers, doctors], loading } = useParallelFetch(
 *     [
 *       () => api.get(apiUrl.customers()),
 *       () => api.get(apiUrl.doctors()),
 *     ],
 *     [],
 *     { errorMsg: 'Failed to load form data' }
 *   );
 *   const customerList = customers?.data ?? [];
 *   const doctorList   = doctors  ?? [];
 *
 * Options:
 *   errorMsg   {string}            — single toast on any failure
 *   transforms {Array<Function>}   — per-response transforms; default: res => res.data
 *   skip       {boolean}           — skip fetch when true
 */
export const useParallelFetch = (apiFns = [], deps = [], options = {}) => {
  const {
    errorMsg   = 'Failed to load data',
    transforms = [],
    skip       = false,
  } = options;

  const [results, setResults] = useState(() => apiFns.map(() => null));
  const [loading, setLoading] = useState(!skip);
  const [error,   setError]   = useState(null);

  const apiFnsRef = useRef(apiFns);
  useEffect(() => { apiFnsRef.current = apiFns; });

  const [refetchCount, setRefetchCount] = useState(0);
  const refetch = useCallback(() => setRefetchCount((n) => n + 1), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (skip || !apiFnsRef.current?.length) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const responses = await Promise.all(apiFnsRef.current.map((fn) => fn()));
        if (!cancelled) {
          const mapped = responses.map((res, i) => {
            const t = transforms[i] ?? ((r) => r.data);
            return t(res);
          });
          setResults(mapped);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setLoading(false);
          toast.error(getErrorMessage(err, errorMsg));
        }
      }
    })();

    return () => { cancelled = true; };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchCount, skip]);

  return { results, loading, error, refetch };
};


// ── Default export ────────────────────────────────────────────────────────────

export default useApiCall;
