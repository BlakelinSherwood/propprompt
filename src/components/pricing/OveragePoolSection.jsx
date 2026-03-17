import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function OveragePoolSection({ pricing, onSave }) {
  const [editOverage, setEditOverage] = useState('');
  const [editBucket, setEditBucket] = useState('');
  const [saving, setSaving] = useState(null);

  const overageDirty = editOverage !== '' && parseFloat(editOverage) !== parseFloat(pricing['overage_price_per_analysis']);
  const bucketDirty = editBucket !== '' && parseFloat(editBucket) !== parseFloat(pricing['pool_bucket_size']);

  const save = async (key, val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    setSaving(key);
    await base44.functions.invoke('updatePricingConfig', { config_key: key, new_value: n });
    await onSave();
    if (key === 'overage_price_per_analysis') setEditOverage('');
    else setEditBucket('');
    setSaving(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Overage */}
      <div>
        <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Overage Pricing</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500 mb-2">Price per overage analysis</div>
          <div className="text-3xl font-bold text-[#1A3226] mb-3">
            ${parseFloat(pricing['overage_price_per_analysis'] ?? 0).toFixed(2)}
          </div>
          <div className="flex gap-2">
            <Input type="number" placeholder="New price" value={editOverage}
              onChange={e => setEditOverage(e.target.value)} className="h-8 text-sm w-32" />
            {overageDirty && (
              <Button size="sm" onClick={() => save('overage_price_per_analysis', editOverage)}
                disabled={saving === 'overage_price_per_analysis'} className="bg-[#1A3226] text-white h-8">
                {saving === 'overage_price_per_analysis' ? '…' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pool bucket size */}
      <div>
        <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Population Pool</h2>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <div className="text-sm text-gray-600 mb-2">Residents per pricing bucket</div>
          <div className="text-3xl font-bold text-[#1A3226] mb-1">
            {parseInt(pricing['pool_bucket_size'] ?? 50000).toLocaleString()}
          </div>
          <p className="text-xs text-orange-600 mb-3">
            Changing bucket size affects how many towns fit in each pricing tier.
            This is a significant change — existing pools will need recalculation.
          </p>
          <div className="flex gap-2">
            <Input type="number" placeholder="New bucket size" value={editBucket}
              onChange={e => setEditBucket(e.target.value)} className="h-8 text-sm w-40 bg-white" />
            {bucketDirty && (
              <Button size="sm" onClick={() => save('pool_bucket_size', editBucket)}
                disabled={saving === 'pool_bucket_size'} className="bg-orange-600 text-white h-8">
                {saving === 'pool_bucket_size' ? '…' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}