import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const CAPS = [
  { key: 'starter_analyses_cap', label: 'Starter' },
  { key: 'pro_analyses_cap', label: 'Pro' },
  { key: 'team_analyses_cap', label: 'Team' },
];

export default function AnalysisCapsSection({ pricing, onSave }) {
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);

  const save = async (key) => {
    const val = parseInt(editing[key]);
    if (isNaN(val) || val <= 0) return;
    setSaving(key);
    await base44.functions.invoke('updatePricingConfig', { config_key: key, new_value: val });
    await onSave();
    setEditing(e => ({ ...e, [key]: undefined }));
    setSaving(null);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Analysis Caps</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CAPS.map(c => {
          const current = pricing[c.key] ?? '—';
          const editVal = editing[c.key] ?? '';
          const isDirty = editVal !== '' && parseInt(editVal) !== parseInt(current);
          return (
            <div key={c.key} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-medium text-gray-500 mb-1">{c.label}</div>
              <div className="text-2xl font-bold text-[#1A3226]">{current} <span className="text-sm font-normal text-gray-400">/ mo</span></div>
              <div className="mt-3 flex gap-2">
                <Input
                  type="number"
                  placeholder="New cap"
                  value={editVal}
                  onChange={e => setEditing(v => ({ ...v, [c.key]: e.target.value }))}
                  className="h-8 text-sm"
                />
                {isDirty && (
                  <Button size="sm" onClick={() => save(c.key)} disabled={saving === c.key} className="bg-[#1A3226] text-white h-8 px-3">
                    {saving === c.key ? '…' : 'Save'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">Affects all subscribers at next monthly reset</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}