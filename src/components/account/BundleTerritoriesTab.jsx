import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, MapPin, Loader2 } from "lucide-react";

const BUNDLE_TIERS = [
  { name: 'Duo', min: 2, discount: 'bundle_duo_discount' },
  { name: 'Trio', min: 3, discount: 'bundle_trio_discount' },
  { name: 'Regional', min: 5, discount: 'bundle_regional_discount' },
  { name: 'District', min: 10, discount: 'bundle_district_discount' },
  { name: 'Master', min: 20, discount: 'bundle_master_discount' },
];

function getBundleDiscount(count, pricing) {
  const match = [...BUNDLE_TIERS].reverse().find(t => count >= t.min);
  return match ? { name: match.name, discount: parseFloat(pricing[match.discount] || 0) } : { name: 'Single', discount: 0 };
}

export default function BundleTerritoriesTab({ bundle, members, stateMap, countyMap, pricing, onRefresh }) {
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [saving, setSaving] = useState(false);

  const tierPrice = parseFloat(pricing?.[`${bundle.tier}_monthly_price`] || 0);
  const currentCount = members.length;
  const currentBundleInfo = getBundleDiscount(currentCount, pricing);
  const currentPrice = currentCount * tierPrice * (1 - currentBundleInfo.discount / 100);

  const afterAdd = pendingAdd ? getBundleDiscount(currentCount + 1, pricing) : null;
  const afterAddPrice = pendingAdd ? (currentCount + 1) * tierPrice * (1 - (afterAdd?.discount || 0) / 100) : null;

  const afterRemove = removeTarget ? getBundleDiscount(currentCount - 1, pricing) : null;
  const afterRemovePrice = removeTarget ? (currentCount - 1) * tierPrice * (1 - (afterRemove?.discount || 0) / 100) : null;

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const results = await base44.entities.Territory.filter({ city_town: { $regex: q }, status: 'available' });
    setSearchResults(results.filter(r => !members.find(m => m.territory_id === r.id)).slice(0, 8));
  };

  const confirmAdd = async () => {
    if (!pendingAdd) return;
    setSaving(true);
    const seatNum = currentCount + 1;
    await base44.entities.TerritoryBundleMember.create({
      bundle_id: bundle.id,
      territory_id: pendingAdd.id,
      seat_number: seatNum,
      joined_at: new Date().toISOString(),
    });
    await base44.entities.Territory.update(pendingAdd.id, { status: 'active' });
    await base44.functions.invoke('recalculateSubscription', { id: bundle.id, type: 'bundle' });
    setPendingAdd(null);
    setAddOpen(false);
    setSaving(false);
    onRefresh();
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setSaving(true);
    await base44.entities.TerritoryBundleMember.delete(removeTarget.memberId);
    await base44.entities.Territory.update(removeTarget.territory_id, { status: 'available' });
    await base44.functions.invoke('recalculateSubscription', { id: bundle.id, type: 'bundle' });
    setRemoveTarget(null);
    setSaving(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} className="bg-[#1A3226] text-white gap-2">
          <Plus className="w-4 h-4" /> Add Territory
        </Button>
      </div>

      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/8">
              {['Town', 'State', 'County', 'Status', 'Seat #', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/50 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const t = m._territory;
              return (
                <tr key={m.id} className={`border-b border-[#1A3226]/5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#1A3226]/[0.01]'}`}>
                  <td className="px-4 py-3 font-medium text-[#1A3226]">{t?.city_town || '—'}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{stateMap[t?.state_id]?.code}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{countyMap[t?.county_id]?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t?.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {t?.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#1A3226]/60">#{m.seat_number}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setRemoveTarget({ ...m, name: t?.city_town })}
                      className="text-[#1A3226]/30 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-[#1A3226]/30 text-sm">No territories in this bundle.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Territory Drawer */}
      <Dialog open={addOpen} onOpenChange={() => { setAddOpen(false); setPendingAdd(null); setSearchResults([]); setSearchQ(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Territory to Bundle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Input value={searchQ} onChange={e => handleSearch(e.target.value)} placeholder="Search available territories…" />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#1A3226]/10 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {searchResults.map(r => (
                    <button key={r.id} onClick={() => { setPendingAdd(r); setSearchResults([]); setSearchQ(''); }}
                      className="w-full text-left px-4 py-3 hover:bg-[#1A3226]/5 border-b last:border-0 text-sm">
                      <p className="font-medium text-[#1A3226]">{r.city_town}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pendingAdd && (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#1A3226]/5 px-4 py-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1A3226]/60" />
                  <span className="font-medium text-[#1A3226]">{pendingAdd.city_town}</span>
                  <button onClick={() => setPendingAdd(null)} className="ml-auto text-[#1A3226]/30 hover:text-[#1A3226] text-xs">✕</button>
                </div>

                <div className="rounded-xl border border-[#1A3226]/10 p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-[#1A3226]/40 uppercase tracking-wider mb-2">Pricing Preview</p>
                  <div className="flex justify-between text-[#1A3226]/60">
                    <span>Current ({currentCount} territories · {currentBundleInfo.name} · {currentBundleInfo.discount}% off)</span>
                    <span>${currentPrice.toFixed(2)}/mo</span>
                  </div>
                  <div className="flex justify-between font-semibold text-[#1A3226]">
                    <span>After adding ({currentCount + 1} · {afterAdd?.name} · {afterAdd?.discount}% off)</span>
                    <span>${afterAddPrice?.toFixed(2)}/mo</span>
                  </div>
                  <p className="text-xs text-[#1A3226]/40 pt-1">Price change takes effect at next billing cycle.</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setPendingAdd(null); }}>Cancel</Button>
            <Button disabled={!pendingAdd || saving} onClick={confirmAdd} className="bg-[#1A3226] text-white gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Remove Territory</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#1A3226]/70">Remove <strong>{removeTarget?.name}</strong> from your bundle?</p>
            <div className="rounded-xl border border-[#1A3226]/10 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-[#1A3226]/60">
                <span>Current ({currentCount} territories · {currentBundleInfo.name})</span>
                <span>${currentPrice.toFixed(2)}/mo</span>
              </div>
              <div className="flex justify-between font-semibold text-[#1A3226]">
                <span>After removing ({currentCount - 1} · {afterRemove?.name})</span>
                <span>${afterRemovePrice?.toFixed(2)}/mo</span>
              </div>
              <p className="text-xs text-[#1A3226]/40 pt-1">Price change takes effect at next billing cycle.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={confirmRemove} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Remove Territory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}