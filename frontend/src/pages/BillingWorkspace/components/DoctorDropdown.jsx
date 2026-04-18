/**
 * DoctorDropdown
 *
 * Chip-button that opens a search dropdown for selecting a referring doctor.
 * Owns its own search/results/loading state — parent only tracks the chosen
 * doctor name string.
 *
 * In view mode renders a read-only chip with no interaction.
 *
 * Props:
 *   value     {string}              — current doctor name (controlled)
 *   onChange  {(name: string) => void} — called when doctor is selected or
 *                                        the user clears the field
 *   readOnly  {boolean}             — true in view mode
 */

import React, { useState, useRef, useEffect } from 'react';
import { Stethoscope, ChevronDown } from 'lucide-react';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export default function DoctorDropdown({ value = '', onChange, readOnly = false }) {
  const [isOpen,  setIsOpen]  = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const searchDoctors = useDebouncedCallback(async (q) => {
    if (q.length < 1) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await api.get(apiUrl.doctors({ search: q, page_size: 10 }));
      setResults(res.data.data || res.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, 300);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);          // keep parent in sync while typing
    searchDoctors(val);
  };

  const handleSelect = (doctor) => {
    onChange(doctor.name || '');
    setQuery(doctor.name || '');
    setIsOpen(false);
    setResults([]);
  };

  const handleOpen = () => {
    setQuery(value);        // pre-fill with current value
    setIsOpen(true);
  };

  // ── Read-only chip (view mode) ───────────────────────────────────────────
  if (readOnly) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
        <Stethoscope className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
      </div>
    );
  }

  // ── Editable chip + dropdown ─────────────────────────────────────────────
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-brand transition-colors"
        data-testid="doctor-chip"
      >
        <Stethoscope className="w-4 h-4 text-gray-400" />
        <span className={`text-sm font-medium truncate max-w-[100px] ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {value || 'Doctor'}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-64 max-h-56 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search doctor…"
              value={query}
              onChange={handleQueryChange}
              autoFocus
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              data-testid="doctor-search-input"
            />
          </div>

          {/* Results */}
          <div className="max-h-40 overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-sm text-gray-400">Searching…</div>
            )}

            {!loading && results.length > 0 && results.map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => handleSelect(doctor)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                data-testid={`doctor-option-${doctor.id}`}
              >
                <div className="text-sm font-medium text-gray-900">{doctor.name}</div>
                <div className="text-xs text-gray-400">
                  {doctor.registration_no || doctor.specialization || ''}
                </div>
              </button>
            ))}

            {!loading && results.length === 0 && query.length > 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No doctors found</div>
            )}

            {!loading && results.length === 0 && query.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">Type to search doctors</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
