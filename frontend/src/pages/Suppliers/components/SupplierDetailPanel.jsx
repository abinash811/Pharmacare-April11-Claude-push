/**
 * SupplierDetailPanel — right-side panel: overview / purchase history / outstanding.
 * Props:
 *   supplier            {object}
 *   onEdit              {() => void}
 *   onClose             {() => void}
 *   onRecordPayment     {() => void}
 *   purchaseHistory     {Array}
 *   historyLoading      {boolean}
 *   activeTab           {string}
 *   onTabChange         {(tab) => void}
 */
import React from 'react';
import { Edit, X, Building2, Phone, Mail, MapPin, CreditCard, FileText, Banknote } from 'lucide-react';
import { InlineLoader } from '@/components/shared';
import { formatDate } from '@/utils/dates';

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
      <div>
        <div className="text-xs text-gray-500 uppercase font-medium">{label}</div>
        <div className="text-sm text-gray-900">{value || '—'}</div>
      </div>
    </div>
  );
}

export default function SupplierDetailPanel({
  supplier, onEdit, onClose, onRecordPayment,
  purchaseHistory, historyLoading,
  activeTab, onTabChange,
}) {
  const outstanding = supplier.outstanding || 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{supplier.name}</h2>
          {supplier.gstin && <div className="text-sm text-gray-500 font-mono mt-1">GSTIN: {supplier.gstin}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Edit">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-6">
          {[['overview','Overview'],['history','Purchase History'],['outstanding','Outstanding']].map(([id, label]) => (
            <button key={id} onClick={() => onTabChange(id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? 'border-[#4682B4] text-[#4682B4]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              data-testid={`detail-tab-${id}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field icon={Building2} label="Contact Person" value={supplier.contact_person} />
              <Field icon={Phone}     label="Phone"          value={supplier.phone} />
              <Field icon={Mail}      label="Email"          value={supplier.email} />
            </div>
            <div className="space-y-4">
              <Field icon={MapPin}    label="Address"        value={supplier.address} />
              <Field icon={CreditCard} label="Credit Days"  value={`${supplier.credit_days || supplier.payment_terms_days || 0} days`} />
              <Field icon={FileText}  label="Notes"          value={supplier.notes} />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          historyLoading ? (
            <InlineLoader text="Loading history..." />
          ) : purchaseHistory.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No purchase history</div>
          ) : (
            <table className="w-full text-sm" data-testid="purchase-history-table">
              <thead className="bg-gray-50">
                <tr>
                  {['Purchase No.','Date','Amount','Status'].map(h => (
                    <th key={h} className={`px-3 py-2 text-xs font-medium text-gray-500 uppercase ${h==='Amount'?'text-right':h==='Status'?'text-center':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchaseHistory.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono" style={{ color: '#0C7A6B' }}>{p.purchase_number}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(p.purchase_date || p.created_at)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">₹{(p.net_amount || p.total_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.payment_status === 'paid' ? 'Paid' : 'Due'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {activeTab === 'outstanding' && (
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Current Outstanding</div>
                <div className="text-3xl font-bold font-mono" style={{ color: outstanding > 0 ? '#CC2F2F' : '#166B3E' }}>
                  ₹{outstanding.toFixed(2)}
                </div>
              </div>
              <button onClick={onRecordPayment} disabled={outstanding <= 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#13ecda' }} data-testid="record-payment-btn">
                <Banknote className="w-4 h-4" />
                Record Payment
              </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Payment History</h3>
              {!supplier.payment_history || supplier.payment_history.length === 0 ? (
                <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">No payment history</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Date','Type','Amount','Note'].map(h => (
                        <th key={h} className={`px-3 py-2 text-xs font-medium text-gray-500 uppercase ${h==='Amount'?'text-right':'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {supplier.payment_history.slice().reverse().map((pay, idx) => (
                      <tr key={pay.id || idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">{formatDate(pay.date)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pay.type === 'purchase_return' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {pay.type === 'purchase_return' ? 'Return' : 'Payment'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: '#166B3E' }}>₹{(pay.amount||0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-500 truncate max-w-[150px]">{pay.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
