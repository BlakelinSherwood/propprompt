import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const ROWS = [
  { label: '2-Seat City', key: 'buyout_2seat_discount' },
  { label: '3–4 Seat City', key: 'buyout_3_4seat_discount' },
  { label: '5–9 Seat City', key: 'buyout_5_9seat_discount' },
  { label: '10+ Seat City', key: 'buyout_10plus_seat_discount' },
];

export default function BuyoutDiscountsSection({ pricing, onSave }) {
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);

  const getVal = (key) => editing[key] !== undefined ? editing[key] : (pricing[key] ?? '');
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

  const EditCell = ({ k }) => (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={getVal(k)}
        onChange={e => setEditing(v => ({ ...v, [k]: e.target.value }))}
        className="w-20 h-7 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
        onBlur={() => isDirty(k) && saveKey(k)}
      />
      <span className="text-xs text-gray-400">%</span>
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
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Full City Buyout Discounts</h2>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Seat Count Bracket</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Full Buyout Discount</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={r.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-4 py-3 font-medium text-[#1A3226]">{r.label}</td>
                <td className="px-4 py-3"><EditCell k={r.key} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 text-sm">
        <span className="text-gray-600 font-medium">Right of first refusal:</span>
        <EditCell k="buyout_refusal_days" />
        <span className="text-gray-400 text-xs">days on new seats</span>
      </div>
    </div>
  );
}