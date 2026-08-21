// @ts-nocheck -- Switch (@/components/ui/switch.jsx) is untyped; every other
// form using it in this codebase does the same.
/**
 * AddMedicineModal — create a new medicine, with an optional opening-stock
 * section (batch/expiry/qty/MRP) in the same screen. A medicine with zero
 * stock still isn't sellable, so most pharmacists fill both in one go —
 * matches how Vyapar/Marg structure this, instead of a separate step.
 *
 * HSN is never typed — it's derived from Category (see backend/constants.py
 * CATEGORY_HSN_MAP), so the same kind of product can't end up miscoded
 * differently depending on who added it.
 */
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch.jsx';
import { AppButton } from '@/components/shared';
import { SEED_MEDICINES, SEED_MANUFACTURERS } from '@/constants/medicineSeedList';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm';

function Field({ label, required, hint, children }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// Text input with a filtered suggestion dropdown — seed list + free typing.
// Not a validation constraint: whatever's typed is used as-is on blur/submit.
function SuggestField({ label, required, value, onChange, options, placeholder }: any) {
  const [open, setOpen] = useState(false);
  const matches = value.trim().length > 0
    ? options.filter((o: string) => o.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : [];
  return (
    <div className="relative">
      <Field label={label} required={required}>
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={INPUT_CLS}
          placeholder={placeholder}
          required={required}
        />
      </Field>
      {open && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {matches.map((m: string) => (
            <AppButton
              key={m}
              type="button"
              variant="ghost"
              onMouseDown={() => { onChange(m); setOpen(false); }}
              className="w-full h-auto justify-start text-left px-3 py-2 text-sm font-normal rounded-none hover:bg-brand/5"
            >
              {m}
            </AppButton>
          ))}
        </div>
      )}
    </div>
  );
}

const FORM_INIT = {
  name: '', category: '', dosageForm: '', gstPercent: 5,
  manufacturer: '', brand: '', genericName: '', unitsPerPack: 1,
  schedule: 'OTC', lowStockThreshold: 10,
  addOpeningStock: true, batchNo: '', expiryDate: '', initialQty: '', mrpPerUnit: '', costPrice: '',
};

export default function AddMedicineModal({ onClose, onSuccess }: Props) {
  const [meta, setMeta] = useState<{ categories: any[]; gst_rates: number[]; dosage_forms: any[] }>({
    categories: [], gst_rates: [5], dosage_forms: [],
  });
  const [form, setForm] = useState(FORM_INIT);
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get(apiUrl.productMeta()).then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  const medicineNames = SEED_MEDICINES.map((m) => m.name);
  const selectedCategory = meta.categories.find((c) => c.value === form.category);
  const selectedDosageForm = meta.dosage_forms.find((d) => d.value === form.dosageForm);

  const handleSelectMedicine = (name: string) => {
    const match = SEED_MEDICINES.find((m) => m.name === name);
    set('name', name);
    if (match) {
      if (!form.category) set('category', match.category);
      if (!form.dosageForm) set('dosageForm', match.dosageForm);
      if (!form.genericName) set('genericName', match.genericName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(apiUrl.products(), {
        name: form.name,
        category: form.category || null,
        dosage_form: form.dosageForm || null,
        gst_percent: parseFloat(String(form.gstPercent)),
        manufacturer: form.manufacturer || null,
        brand: form.brand || null,
        generic_name: form.genericName || null,
        units_per_pack: parseInt(String(form.unitsPerPack), 10) || 1,
        schedule: form.schedule,
        low_stock_threshold_units: parseInt(String(form.lowStockThreshold), 10) || 10,
      });

      if (form.addOpeningStock && form.initialQty && form.expiryDate) {
        await api.post(apiUrl.stockBatches(), {
          product_sku: res.data.sku,
          batch_no: form.batchNo || `INIT-${Date.now()}`,
          expiry_date: form.expiryDate,
          qty_on_hand: parseFloat(form.initialQty),
          cost_price_per_unit: parseFloat(form.costPrice) || 0,
          mrp_per_unit: parseFloat(form.mrpPerUnit) || 0,
          location: 'Default',
        });
      }

      toast.success('Medicine added successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add medicine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Medicine</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <SuggestField
                label="Medicine Name" required value={form.name}
                onChange={handleSelectMedicine} options={medicineNames}
                placeholder="e.g. Dolo 650"
              />
            </div>

            <Field label="Category" required>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className={INPUT_CLS} required>
                <option value="">Select category</option>
                {meta.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>

            <Field
              label="HSN Code"
              hint={selectedCategory ? `Covers: ${selectedCategory.hsn_description}` : 'Set by Category'}
            >
              <input value={selectedCategory?.hsn_code || ''} className={`${INPUT_CLS} bg-gray-50 text-gray-500`} disabled placeholder="Auto-filled from Category" />
            </Field>

            <Field label="Dosage Form" required hint={selectedDosageForm && !selectedDosageForm.divisible ? "Sold as a whole pack — can't sell loose units" : selectedDosageForm ? 'Can be sold loose (e.g. 1 tablet)' : undefined}>
              <select value={form.dosageForm} onChange={(e) => set('dosageForm', e.target.value)} className={INPUT_CLS} required>
                <option value="">Select dosage form</option>
                {meta.dosage_forms.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>

            <Field label="GST %" required>
              <select value={form.gstPercent} onChange={(e) => set('gstPercent', e.target.value)} className={INPUT_CLS} required>
                {meta.gst_rates.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>

            <Field label="Units per Pack" required hint="e.g. 10 tablets per strip. Use 1 for syrup/injection/ointment.">
              <input type="number" min={1} value={form.unitsPerPack} onChange={(e) => set('unitsPerPack', e.target.value)} className={INPUT_CLS} required />
            </Field>

            <Field label="Drug Schedule" required>
              <select value={form.schedule} onChange={(e) => set('schedule', e.target.value)} className={INPUT_CLS}>
                <option value="OTC">OTC — Over the Counter</option>
                <option value="H">H — Prescription Required</option>
                <option value="H1">H1 — Prescription + 3yr Register</option>
                <option value="X">X — Narcotic</option>
              </select>
            </Field>

            <SuggestField label="Manufacturer" value={form.manufacturer} onChange={(v: string) => set('manufacturer', v)} options={SEED_MANUFACTURERS} placeholder="e.g. Cipla Ltd" />
            <Field label="Brand"><input value={form.brand} onChange={(e) => set('brand', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Generic Name / Composition"><input value={form.genericName} onChange={(e) => set('genericName', e.target.value)} className={INPUT_CLS} /></Field>
            <Field label="Low Stock Alert"><input type="number" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} className={INPUT_CLS} /></Field>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Opening Stock</h4>
              <Switch checked={form.addOpeningStock} onCheckedChange={(v: boolean) => set('addOpeningStock', v)} />
            </div>
            {form.addOpeningStock && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Batch Number" hint="Auto-generated if left blank">
                  <input value={form.batchNo} onChange={(e) => set('batchNo', e.target.value)} className={INPUT_CLS} />
                </Field>
                <Field label="Expiry Date" required={form.addOpeningStock}>
                  <input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} className={INPUT_CLS} required={form.addOpeningStock} />
                </Field>
                <Field label="Quantity" required={form.addOpeningStock}>
                  <input type="number" value={form.initialQty} onChange={(e) => set('initialQty', e.target.value)} className={INPUT_CLS} required={form.addOpeningStock} />
                </Field>
                <Field label="MRP per Unit" required={form.addOpeningStock}>
                  <input type="number" step="0.01" value={form.mrpPerUnit} onChange={(e) => set('mrpPerUnit', e.target.value)} className={INPUT_CLS} required={form.addOpeningStock} />
                </Field>
                <Field label="Cost Price per Unit" hint="Optional now — needed later for margin reports">
                  <input type="number" step="0.01" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} className={INPUT_CLS} />
                </Field>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-gray-100">
            <AppButton type="button" variant="secondary" onClick={onClose}>Cancel</AppButton>
            <AppButton type="submit" loading={loading}>Add Medicine</AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
