import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const FIELDS = [
  { key: 'sublicense_default_share_pct', label: 'Default Share %' },
  { key: 'sublicense_min_share_pct', label: 'Minimum Share %' },
  { key: 'sublicense_max_share_pct', label: 'Maximum Share %' },
];

export default function RevenueShareSection({ pricing, onSave }) {
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

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Revenue Share</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FIELDS.map(f => (
          <div key={f.key} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-500 mb-2">{f.label}</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={getVal(f.key)}
                onChange={e => setEditing(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-24 h-9 text-xl font-bold border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                onBlur={() => isDirty(f.key) && saveKey(f.key)}
              />
              <span className="text-2xl text-gray-400">%</span>
              {isDirty(f.key) && (
                <button onClick={() => saveKey(f.key)} disabled={saving === f.key}
                  className="text-xs bg-[#1A3226] text-white rounded px-2 py-1">
                  {saving === f.key ? '…' : 'Save'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400">Min and Max enforce the range available when setting a sublicensing agreement.</p>
    </div>
  );
}