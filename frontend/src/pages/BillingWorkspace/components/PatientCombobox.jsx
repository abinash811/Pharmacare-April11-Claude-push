/**
 * PatientCombobox — inline typeahead for patient selection in billing.
 *
 * Replaces the modal-based PatientSearchModal + chip button.
 * Behaviour:
 *   - Click field → opens dropdown, shows recent / walk-in option
 *   - Type → debounced search against /customers
 *   - Select existing → fills name + phone
 *   - "+ Add [name]" → compact mini-form (name + phone) → creates customer → selects
 *   - Walk-in → clears to counter sale
 *   - Click outside / Escape → closes
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserPlus, Search, User } from 'lucide-react';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

export default function PatientCombobox({ value, phone, onSelect, readOnly }) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '' });
  const [saving,  setSaving]  = useState(false);

  const wrapperRef = useRef(null);
  const inputRef   = useRef(null);
  const debouncedQ = useDebounce(query, 250);

  // Search patients when query changes
  useEffect(() => {
    if (!open) return;
    if (!debouncedQ.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    api.get(apiUrl.patients({ search: debouncedQ, page_size: 8 }))
      .then(res => { if (!cancelled) setResults(res.data.data || res.data || []); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQ, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setShowAdd(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openDropdown = () => {
    if (readOnly) return;
    setOpen(true);
    setQuery('');
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const select = useCallback((patient) => {
    if (patient === 'walkin') {
      onSelect({ name: 'Counter Sale', phone: '', id: null });
    } else {
      onSelect({ name: patient.name, phone: patient.phone || patient.mobile || '', id: patient.id });
    }
    setOpen(false);
    setQuery('');
    setShowAdd(false);
  }, [onSelect]);

  const handleKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); setShowAdd(false); setQuery(''); }
  };

  const handleAddSave = async () => {
    if (!addForm.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await api.post(apiUrl.customers(), {
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        customer_type: 'regular',
      });
      const created = res.data;
      toast.success(`${created.name} added`);
      select(created);
    } catch {
      toast.error('Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  const displayValue = value || 'Walk-in patient';
  const noResults    = !loading && query.trim().length > 0 && results.length === 0;

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      {!open ? (
        <button
          onClick={openDropdown}
          className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-brand transition-colors truncate max-w-full"
          data-testid="patient-chip"
        >
          <span className={`truncate ${!value ? 'text-gray-400' : ''}`}>{displayValue}</span>
          <svg className="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : (
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder={value || 'Search patient...'}
          className="w-44 text-sm font-medium text-gray-900 border-b border-brand outline-none bg-transparent pb-0.5 placeholder:text-gray-400"
          data-testid="patient-search-input"
        />
      )}

      {/* Dropdown */}
      {open && !showAdd && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">

          {/* Walk-in always first */}
          <button
            onClick={() => select('walkin')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 border-b border-gray-100"
          >
            <User className="w-3.5 h-3.5 text-gray-400" />
            Counter / Walk-in
          </button>

          {/* Loading */}
          {loading && (
            <div className="px-3 py-3 text-xs text-gray-400 flex items-center gap-2">
              <div className="w-3 h-3 border border-gray-300 border-t-brand rounded-full animate-spin" />
              Searching...
            </div>
          )}

          {/* Results */}
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => select(p)}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-brand/5 transition-colors"
              data-testid={`patient-result-${p.id}`}
            >
              <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                {p.phone && <div className="text-xs text-gray-500">{p.phone}</div>}
              </div>
            </button>
          ))}

          {/* Add new */}
          {(noResults || (query.trim() && results.length < 8)) && query.trim() && (
            <button
              onClick={() => { setShowAdd(true); setAddForm({ name: query.trim(), phone: '' }); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-brand font-medium hover:bg-brand/5 border-t border-gray-100 transition-colors"
              data-testid="patient-add-new"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add "{query.trim()}" as new customer
            </button>
          )}

          {/* Empty state */}
          {!loading && !query.trim() && (
            <div className="px-3 py-3 text-xs text-gray-400 flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              Type to search patients
            </div>
          )}
        </div>
      )}

      {/* Mini add form */}
      {open && showAdd && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">New Customer</p>
          <input
            autoFocus
            value={addForm.name}
            onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Full name *"
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <input
            value={addForm.phone}
            onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Phone (optional)"
            maxLength={10}
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 mb-3 focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 text-xs py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleAddSave}
              disabled={saving}
              className="flex-1 text-xs py-1.5 bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add & Select'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
