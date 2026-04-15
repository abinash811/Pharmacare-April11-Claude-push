/**
 * PHARMACARE — useDebounce & useDebouncedCallback
 *
 * Replaces the manual searchTimeoutRef + clearTimeout + setTimeout(300)
 * pattern repeated across BillingOperations, PurchasesList, SalesReturnsList,
 * PurchaseReturnsList, and BillingWorkspace.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * useDebounce(value, delay)
 *
 *   Returns a debounced copy of `value` that only updates after `delay` ms
 *   of inactivity. Use this when you want to trigger an API call whenever
 *   a search input settles.
 *
 *   BEFORE (current pattern in every list page):
 *     const searchTimeoutRef = useRef(null);
 *     const [debouncedSearch, setDebouncedSearch] = useState('');
 *     const handleSearch = (value) => {
 *       if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
 *       searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
 *     };
 *     useEffect(() => { fetchData(); }, [debouncedSearch]);
 *
 *   AFTER:
 *     const debouncedSearch = useDebounce(searchQuery, 300);
 *     useEffect(() => { fetchData(); }, [debouncedSearch]);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * useDebouncedCallback(callback, delay)
 *
 *   Returns a stable debounced version of `callback`. Use this when you need
 *   to debounce an async function directly (e.g. BillingWorkspace product
 *   search that fires an API call on each keystroke).
 *
 *   BEFORE:
 *     searchTimeoutRef.current = setTimeout(async () => {
 *       const response = await axios.get(...);
 *       setSearchResults(response.data);
 *     }, 300);
 *
 *   AFTER:
 *     const searchProducts = useDebouncedCallback(async (query) => {
 *       const { data } = await api.get(apiUrl.productsSearchWithBatches(query));
 *       setSearchResults(data);
 *     }, 300);
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── useDebounce ───────────────────────────────────────────────────────────────

/**
 * Debounces a value — only updates the returned value after `delay` ms
 * of no further changes.
 *
 * @param {*}      value  The live value to debounce (string, number, object…)
 * @param {number} delay  Debounce delay in ms (default 300)
 * @returns {*}           The debounced value
 *
 * @example
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebounce(search, 300);
 *
 *   useEffect(() => {
 *     if (debouncedSearch) fetchResults(debouncedSearch);
 *   }, [debouncedSearch]);
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);   // clears on every value/delay change
  }, [value, delay]);

  return debouncedValue;
};


// ── useDebouncedCallback ──────────────────────────────────────────────────────

/**
 * Returns a stable debounced version of `callback`.
 * The returned function has the same signature as the original.
 * Automatically cancels any pending invocation on unmount.
 *
 * @param {Function} callback  The function to debounce
 * @param {number}   delay     Debounce delay in ms (default 300)
 * @returns {Function}         Debounced callback (stable reference)
 *
 * @example
 *   const searchProducts = useDebouncedCallback(async (query) => {
 *     if (query.length < 2) return;
 *     const { data } = await api.get(apiUrl.productsSearchWithBatches(query));
 *     setResults(data);
 *   }, 300);
 *
 *   // In JSX:
 *   <SearchInput onChange={searchProducts} />
 */
export const useDebouncedCallback = (callback, delay = 300) => {
  const timerRef    = useRef(null);
  const callbackRef = useRef(callback);

  // Keep the ref current without re-creating the debounced fn
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cancel on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);   // only re-creates if delay changes
};


// ── Default export (most common case) ────────────────────────────────────────

export default useDebounce;
