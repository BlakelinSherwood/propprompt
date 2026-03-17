import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";

export default function PoolTownsTab({ pool, members, stateMap, countyMap, pricing, onRefresh }) {
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [saving, setSaving] = useState(false);

  const bucketSize = parseInt(pricing?.territory_seat_size || 50000);
  const tierPrice = parseFloat(pricing?.[`${pool.tier}_monthly_price`] || 0);
  const tierCap = parseInt(pricing?.[`${pool.tier}_analyses_cap`] || 0);

  const currentPop = pool.combined_population || 0;
  const currentBuckets = pool.buckets_used || 1;
  const currentPrice = pool.monthly_price || 0;

  const afterAddPop = pendingAdd ? currentPop + (pendingAdd.population || 0) : 0;
  const afterAddBuckets = pendingAdd ? Math.max(1, Math.ceil(afterAddPop / bucketSize)) : 0;
  const afterAddPrice = pendingAdd ? afterAddBuckets * tierPrice : 0;
  const addCrossesBucket = pendingAdd && afterAddBuckets > currentBuckets;

  const afterRemovePop = removeTarget ? Math.max(0, currentPop - (removeTarget.population || 0)) : 0;
  const afterRemoveBuckets = removeTarget ? Math.max(1, Math.ceil(afterRemovePop / bucketSize)) : 0;
  const afterRemovePrice = removeTarget ? afterRemoveBuckets * tierPrice : 0;
  const removeLosesBucket = removeTarget && afterRemoveBuckets < currentBuckets;

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const results = await base44.entities.Territory.filter({ city_town: { $regex: q }, status: 'available' });
    const existingIds = (pool.territory_ids || []);
    setSearchResults(results.filter(r => !existingIds.includes(r.id)).slice(0, 8));
  };

  const confirmAdd = async () => {
    if (!pendingAdd) return;
    setSaving(true);
    await base44.entities.PopulationPoolMember.create({
      pool_id: pool.id,
      territory_id: pendingAdd.id,
      population_contribution: pendingAdd.population || 0,
    });
    await base44.entities.Territory.update(pendingAdd.id, { status: 'active', pool_id: pool.id });
    await base44.functions.invoke('recalculateSubscription', { id: pool.id, type: 'pool' });
    setPendingAdd(null);
    setAddOpen(false);
    setSaving(false);
    onRefresh();
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setSaving(true);
    await base44.entities.PopulationPoolMember.delete(removeTarget.memberId);
    await base44.entities.Territory.update(removeTarget.territory_id, { status: 'available', pool_id: null });
    await base44.functions.invoke('recalculateSubscription', { id: pool.id, type: 'pool' });
    setRemoveTarget(null);
    setSaving(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} className="bg-[#1A3226] text-white gap-2">
          <Plus className="w-4 h-4" /> Add Town
        </Button>
      </div>

      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/8">
              {['Town', 'State', 'County', 'Population', 'Status', ''].map(h => (
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
                  <td className="px-4 py-3 text-[#1A3226]/60">{(m.population_contribution || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t?.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {t?.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setRemoveTarget({ ...m, name: t?.city_town, population: m.population_contribution })}
                      className="text-[#1A3226]/30 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-[#1A3226]/30 text-sm">No towns in this pool.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Town Dialog */}
      <Dialog open={addOpen} onOpenChange={() => { setAddOpen(false); setPendingAdd(null); setSearchResults([]); setSearchQ(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Town to Pool</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Input value={searchQ} onChange={e => handleSearch(e.target.value)} placeholder="Search available towns…" />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#1A3226]/10 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {searchResults.map(r => (
                    <button key={r.id} onClick={() => { setPendingAdd(r); setSearchResults([]); setSearchQ(''); }}
                      className="w-full text-left px-4 py-3 hover:bg-[#1A3226]/5 border-b last:border-0 text-sm flex justify-between">
                      <span className="font-medium text-[#1A3226]">{r.city_town}</span>
                      <span className="text-[#1A3226]/50">{(r.population || 0).toLocaleString()} residents</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pendingAdd && (
              <div className="space-y-3">
                {addCrossesBucket && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-700">
                      Adding <strong>{pendingAdd.city_town}</strong> opens Bucket {afterAddBuckets}. 
                      Your price increases from <strong>${currentPrice.toFixed(2)}/mo</strong> to <strong>${afterAddPrice.toFixed(2)}/mo</strong>.
                    </p>
                  </div>
                )}

                {/* Population bar */}
                <div className="rounded-xl border border-[#1A3226]/10 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#1A3226]/60">After adding</span>
                    <span className="font-medium text-[#1A3226]">{afterAddPop.toLocaleString()} residents</span>
                  </div>
                  <div className="w-full h-2 bg-[#1A3226]/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#B8982F] rounded-full" style={{ width: `${Math.min(100, ((afterAddPop % bucketSize) / bucketSize) * 100)}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center pt-1">
                    <div><div className="font-bold text-[#1A3226]">{afterAddBuckets}</div><div className="text-[#1A3226]/40">Buckets</div></div>
                    <div><div className="font-bold text-[#1A3226]">${afterAddPrice.toFixed(2)}/mo</div><div className="text-[#1A3226]/40">New price</div></div>
                    <div><div className="font-bold text-[#1A3226]">{afterAddBuckets * tierCap}</div><div className="text-[#1A3226]/40">Analyses/mo</div></div>
                  </div>
                  <p className="text-xs text-[#1A3226]/40">Price change takes effect at next billing cycle.</p>
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
          <DialogHeader><DialogTitle>Remove Town</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#1A3226]/70">Remove <strong>{removeTarget?.name}</strong> from your pool?</p>
            {removeLosesBucket && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                Removing {removeTarget?.name} will reduce your pool from <strong>{currentBuckets}</strong> to <strong>{afterRemoveBuckets}</strong> bucket{afterRemoveBuckets !== 1 ? 's' : ''}.
                Your monthly price will decrease from <strong>${currentPrice.toFixed(2)}</strong> to <strong>${afterRemovePrice.toFixed(2)}</strong> at your next billing cycle.
              </div>
            )}
            {!removeLosesBucket && (
              <div className="rounded-xl border border-[#1A3226]/10 p-3 text-sm space-y-1">
                <div className="flex justify-between text-[#1A3226]/60"><span>Current</span><span>${currentPrice.toFixed(2)}/mo · {currentBuckets} buckets</span></div>
                <div className="flex justify-between font-medium text-[#1A3226]"><span>After removal</span><span>${afterRemovePrice.toFixed(2)}/mo · {afterRemoveBuckets} buckets</span></div>
                <p className="text-xs text-[#1A3226]/40">Price change takes effect at next billing cycle.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={confirmRemove} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Remove Town
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}