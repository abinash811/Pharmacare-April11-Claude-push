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
import { Stethoscope, UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { AppButton } from '@/components/shared';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import AddPersonMiniForm from './AddPersonMiniForm';

export default function DoctorDropdown({ value = '', onChange, readOnly = false }) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // Found Sep 19, 2026 (Abinash, testing zero-data): no button anywhere to
  // add a new doctor record, unlike PatientCombobox's matching "Add
  // Customer" mini-form — a genuinely new pharmacy with zero doctors had
  // no visible way to add its first one here, only the free-text fallback.
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', registration_number: '' });
  const [saving,  setSaving]  = useState(false);

  const wrapperRef = useRef(null);
  const contentRef = useRef(null);
  const inputRef   = useRef(null);
  const addNameRef = useRef(null);
  const debouncedQ = useDebounce(query, 250);

  useEffect(() => {
    if (showAdd) addNameRef.current?.focus();
  }, [showAdd]);

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

  // Close on outside click — save whatever is typed.
  // The suggestions list renders via a Radix Portal (see below), so it's
  // no longer a DOM descendant of wrapperRef — must also exempt clicks
  // inside contentRef, or picking a suggestion always misfired this as an
  // "outside" click first and saved the raw typed text instead of the
  // selected doctor (caught live while verifying the portal fix itself).
  useEffect(() => {
    const handler = (e) => {
      const inWrapper = wrapperRef.current && wrapperRef.current.contains(e.target);
      const inContent = contentRef.current && contentRef.current.contains(e.target);
      if (!inWrapper && !inContent) {
        if (open) onChange(query); // save freetext on blur
        setOpen(false);
        setResults([]);
        setShowAdd(false);
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
    setShowAdd(false);
  };

  const handleAddSave = async () => {
    if (!addForm.name.trim()) { toast.error('Doctor name is required'); return; }
    setSaving(true);
    try {
      const res = await api.post(apiUrl.doctors(), {
        name: addForm.name.trim(),
        registration_number: addForm.registration_number.trim() || null,
      });
      // Doctor name is free text — some entries already include "Dr."
      // (same concern already documented in excelExport.js's doctor-wise
      // report formatter), so don't double-prefix it here.
      toast.success(`${res.data.name} added`);
      handleSelect(res.data);
    } catch (error) {
      toast.error(error.message || 'Failed to add doctor');
    } finally {
      setSaving(false);
    }
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
  // Suggestions render via Radix Popover (portals to document.body) instead
  // of a plain `absolute` div — found Sep 13, 2026 (Billing product-review):
  // BillingSubbar's toolbar row has `overflow-x-auto`, which per the CSS
  // overflow spec forces `overflow-y` to also clip ("auto"), silently
  // hiding any plain-absolute dropdown nested inside it, no matter its
  // z-index. The Date field's Calendar already avoided this the same way —
  // matching that existing, proven pattern instead of inventing a new one.
  const noResults = !loading && query.trim().length > 0 && results.length === 0;

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className="relative">
          {!open ? (
            <AppButton
              variant="chip"
              onClick={openField}
              className="w-40 h-9 px-2.5 justify-between gap-1 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
              data-testid="doctor-chip"
            >
              <span className={`truncate ${!value ? 'text-gray-400' : ''}`}>{value || 'Doctor'}</span>
              <svg className="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </AppButton>
          ) : (
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
              onKeyDown={handleKey}
              placeholder={value || 'Doctor name...'}
              className="w-40 h-9 px-2.5 text-sm font-medium text-gray-900 border border-brand rounded-lg outline-none bg-white focus:ring-2 focus:ring-brand placeholder:text-gray-400 placeholder:font-normal"
              data-testid="doctor-search-input"
            />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        className="w-56 p-0 overflow-hidden"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {!showAdd ? (
          <>
            {loading && (
              <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                <div className="w-3 h-3 border border-gray-300 border-t-brand rounded-full animate-spin" />
                Searching...
              </div>
            )}
            {results.map(doctor => (
              <div
                key={doctor.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(doctor)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(doctor); } }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-brand/5 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
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
              </div>
            ))}

            {/* Add new — found Sep 19, 2026, same gap PatientCombobox already
                closed: no button anywhere to add a doctor record. */}
            {noResults && (
              <AppButton
                variant="ghost"
                onClick={() => { setShowAdd(true); setAddForm({ name: query.trim(), registration_number: '' }); }}
                className="w-full justify-start px-3 py-2.5 text-sm text-brand hover:bg-brand/5 hover:text-brand border-t border-gray-100 rounded-none"
                icon={<UserPlus className="w-3.5 h-3.5" />}
                data-testid="doctor-add-new"
              >
                Add "{query.trim()}" as new doctor
              </AppButton>
            )}
            {!loading && !query.trim() && (
              <div className="px-3 py-4 flex flex-col items-center gap-2 text-center">
                <Search className="w-4 h-4 text-gray-300" />
                <p className="text-xs text-gray-400">Type to search, or add a new doctor</p>
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAdd(true); setAddForm({ name: '', registration_number: '' }); }}
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                  data-testid="doctor-add-new-empty"
                >
                  Add Doctor
                </AppButton>
              </div>
            )}
          </>
        ) : (
          <AddPersonMiniForm
            title="New Doctor"
            namePlaceholder="Doctor name *"
            nameRef={addNameRef}
            name={addForm.name}
            onNameChange={(v) => setAddForm(f => ({ ...f, name: v }))}
            secondPlaceholder="Registration number (optional)"
            secondValue={addForm.registration_number}
            onSecondChange={(v) => setAddForm(f => ({ ...f, registration_number: v }))}
            saving={saving}
            onBack={() => setShowAdd(false)}
            onSave={handleAddSave}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
