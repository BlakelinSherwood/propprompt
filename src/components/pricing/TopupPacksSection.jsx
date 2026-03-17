import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const PACKS = [
  { name: 'Starter', analyses: 'topup_starter_analyses', price: 'topup_starter_price' },
  { name: 'Standard', analyses: 'topup_standard_analyses', price: 'topup_standard_price' },
  { name: 'Pro', analyses: 'topup_pro_analyses', price: 'topup_pro_price' },
  { name: 'Bulk', analyses: 'topup_bulk_analyses', price: 'topup_bulk_price' },
];

export default function TopupPacksSection({ pricing, onSave }) {
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);

  const getVal = (key) => editing[key] !== undefined ? editing[key] : (pricing[key] ?? '');
  const setVal = (key, val) => setEditing(e => ({ ...e, [key]: val }));
  const isDirty = (key) => editing[key] !== undefined && parseFloat(editing[key]) !== parseFloat(pricing[key]);

  const saveKey = async (key) => {
    const val = parseFloat(editing[key]);
    if (isNaN(val)) return;
    setSaving(key);
    await base44.functions.invoke('updatePricingConfig', { config_key: key, new_value: val });
    await onSave();
    setEditing(e => ({ ...e, [key]: undefined }));
    setSaving(null);
  };

  const InlineEdit = ({ k, prefix = '' }) => (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
      <input
        type="number"
        value={getVal(k)}
        onChange={e => setVal(k, e.target.value)}
        className="w-24 h-7 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
        onBlur={() => isDirty(k) && saveKey(k)}
      />
      {isDirty(k) && (
        <button onClick={() => saveKey(k)} disabled={saving === k}
          className="text-[10px] bg-[#1A3226] text-white rounded px-1.5 py-0.5">
          {saving === k ? '…' : '✓'}
        </button>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Top-Up Packs</h2>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pack</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Analyses</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Price</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Per-Analysis Cost</th>
            </tr>
          </thead>
          <tbody>
            {PACKS.map((p, i) => {
              const analyses = parseFloat(getVal(p.analyses)) || 0;
              const price = parseFloat(getVal(p.price)) || 0;
              const perAnalysis = analyses > 0 ? (price / analyses).toFixed(2) : '—';
              return (
                <tr key={p.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-3 font-medium text-[#1A3226]">{p.name}</td>
                  <td className="px-4 py-3"><InlineEdit k={p.analyses} /></td>
                  <td className="px-4 py-3"><InlineEdit k={p.price} prefix="$" /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">${perAnalysis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 text-sm">
        <span className="text-gray-600 font-medium">Pack expiry days:</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={getVal('topup_expiry_days')}
            onChange={e => setVal('topup_expiry_days', e.target.value)}
            className="w-20 h-7 text-xs border border-gray-200 rounded px-2 focus:outline-none"
            onBlur={() => isDirty('topup_expiry_days') && saveKey('topup_expiry_days')}
          />
          <span className="text-gray-400 text-xs">days after purchase</span>
          {isDirty('topup_expiry_days') && (
            <button onClick={() => saveKey('topup_expiry_days')}
              className="text-[10px] bg-[#1A3226] text-white rounded px-1.5 py-0.5 ml-1">✓</button>
          )}
        </div>
      </div>
    </div>
  );
}