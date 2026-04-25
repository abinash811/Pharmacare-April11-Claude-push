/**
 * DoctorDropdown
 *
 * Inline typeahead for doctor selection — identical interaction pattern
 * to PatientCombobox. Click the field → transforms to input → type → results.
 * No 2-step chip → separate input flow.
 *
 * Doctor name is freetext: user can type any name freely.
 * DB doctors are shown as suggestions only — not required.
 *
 * Props:
 *   value     {string}
 *   onChange  {(name: string) => void}
 *   readOnly  {boolean}
 */
import React, { useState, useEffect, useRef } from 'react';
import { Stethoscope } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export default function DoctorDropdown({ value = '', onChange, readOnly = false }) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const wrapperRef = useRef(null);
  const inputRef   = useRef(null);
  const debouncedQ = useDebounce(query, 250);

  // Search doctors from DB as suggestions
  useEffect(() => {
    if (!open || !debouncedQ.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    api.get(apiUrl.doctors({ search: debouncedQ, page_size: 8 }))
      .then(res => { if (!cancelled) setResults(res.data.data || res.data || []); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQ, open]);

  // Close on outside click — save whatever is typed
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        if (open) onChange(query); // save freetext on blur
        setOpen(false);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, query, onChange]);

  const openField = () => {
    if (readOnly) return;
    setQuery(value);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (doctor) => {
    onChange(doctor.name || '');
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') { onChange(query); setOpen(false); setResults([]); }
    if (e.key === 'Enter' && results.length === 0) { onChange(query); setOpen(false); }
  };

  // ── Read-only ────────────────────────────────────────────────────────────
  if (readOnly) {
    return (
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    );
  }

  // ── Editable ─────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="relative">

      {/* Trigger / inline input — same pattern as PatientCombobox */}
      {!open ? (
        <button
          onClick={openField}
          className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-brand transition-colors"
          data-testid="doctor-chip"
        >
          <span className={!value ? 'text-gray-400' : ''}>{value || 'Doctor'}</span>
          <svg className="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : (
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
          onKeyDown={handleKey}
          placeholder={value || 'Doctor name...'}
          className="w-36 text-sm font-medium text-gray-900 border-b border-brand outline-none bg-transparent pb-0.5 placeholder:text-gray-400"
          data-testid="doctor-search-input"
        />
      )}

      {/* Suggestions dropdown — only when there are DB matches */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
              <div className="w-3 h-3 border border-gray-300 border-t-brand rounded-full animate-spin" />
              Searching...
            </div>
          )}
          {results.map(doctor => (
            <button
              key={doctor.id}
              onClick={() => handleSelect(doctor)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-brand/5 transition-colors border-b border-gray-100 last:border-0"
              data-testid={`doctor-option-${doctor.id}`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-900">{doctor.name}</div>
                {(doctor.specialization || doctor.registration_number) && (
                  <div className="text-xs text-gray-400">
                    {doctor.specialization || doctor.registration_number}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
