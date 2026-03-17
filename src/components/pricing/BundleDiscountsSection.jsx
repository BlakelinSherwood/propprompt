import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const BUNDLES = [
  { name: 'Duo', keys: { min: 'bundle_duo_min', discount: 'bundle_duo_discount', multiplier: 'bundle_duo_cap_multiplier' }, noMax: true },
  { name: 'Trio', keys: { min: 'bundle_trio_min', max: 'bundle_trio_max', discount: 'bundle_trio_discount', multiplier: 'bundle_trio_cap_multiplier' } },
  { name: 'Regional', keys: { min: 'bundle_regional_min', max: 'bundle_regional_max', discount: 'bundle_regional_discount', multiplier: 'bundle_regional_cap_multiplier' } },
  { name: 'District', keys: { min: 'bundle_district_min', max: 'bundle_district_max', discount: 'bundle_district_discount', multiplier: 'bundle_district_cap_multiplier' } },
  { name: 'Master', keys: { min: 'bundle_master_min', discount: 'bundle_master_discount', multiplier: 'bundle_master_cap_multiplier' }, noMax: true },
  { name: 'County', keys: { discount: 'bundle_county_discount', floor: 'bundle_county_floor_price', cap: 'bundle_county_analyses_cap' }, isCounty: true },
];

export default function BundleDiscountsSection({ pricing, onSave }) {
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);

  const setVal = (key, val) => setEditing(e => ({ ...e, [key]: val }));
  const getVal = (key) => editing[key] !== undefined ? editing[key] : (pricing[key] ?? '');

  const saveKey = async (key) => {
    const val = parseFloat(editing[key]);
    if (isNaN(val)) return;
    setSaving(key);
    await base44.functions.invoke('updatePricingConfig', { config_key: key, new_value: val });
    await onSave();
    setEditing(e => ({ ...e, [key]: undefined }));
    setSaving(null);
  };

  const Cell = ({ k, type = 'number', prefix = '', suffix = '' }) => {
    const dirty = editing[k] !== undefined && parseFloat(editing[k]) !== parseFloat(pricing[k]);
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
        <input
          type={type}
          value={getVal(k)}
          onChange={e => setVal(k, e.target.value)}
          className="w-20 h-7 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
        />
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
        {dirty && (
          <button onClick={() => saveKey(k)} disabled={saving === k}
            className="text-[10px] bg-[#1A3226] text-white rounded px-1.5 py-0.5 ml-1">
            {saving === k ? '…' : '✓'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Bundle Discounts</h2>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Bundle</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Min</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Max</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Discount %</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Cap / Multiplier</th>
            </tr>
          </thead>
          <tbody>
            {BUNDLES.map((b, i) => (
              <tr key={b.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-4 py-3 font-medium text-[#1A3226]">{b.name}</td>
                <td className="px-4 py-3">{b.keys.min ? <Cell k={b.keys.min} /> : '—'}</td>
                <td className="px-4 py-3">{b.keys.max ? <Cell k={b.keys.max} /> : (b.noMax ? '∞' : '—')}</td>
                <td className="px-4 py-3"><Cell k={b.keys.discount} suffix="%" /></td>
                <td className="px-4 py-3">
                  {b.isCounty ? (
                    <div className="flex flex-col gap-1">
                      <Cell k={b.keys.floor} prefix="$" />
                      <Cell k={b.keys.cap} suffix=" analyses" />
                    </div>
                  ) : (
                    <Cell k={b.keys.multiplier} suffix="%" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}