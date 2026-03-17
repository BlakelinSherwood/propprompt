import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SublicenseModal from './SublicenseModal';
import AdjustShareModal from './AdjustShareModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

const STATUS_BADGE = {
  reserved: 'bg-slate-100 text-slate-700',
  sublicensed: 'bg-violet-100 text-violet-700',
  available: 'bg-emerald-100 text-emerald-700',
  active: 'bg-blue-100 text-blue-700',
};

export default function TownsTable({ territories, counties, subscriptions, pricing, founderUserId, onRefresh }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [sublicenseTarget, setSublicenseTarget] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null); // {territory, subscription}
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const filtered = territories.filter(t =>
    !search || t.city_town?.toLowerCase().includes(search.toLowerCase())
  );

  function getSubscription(territory) {
    return subscriptions.find(s => s.territory_id === territory.id && s.status === 'active' && s.sublicensor_id);
  }
  function getCounty(territory) {
    const c = counties.find(c => c.id === territory.county_id);
    return c?.name || '—';
  }

  async function handleRelease(territory) {
    const refusalDays = pricing?.founder_refusal_days || 7;
    const expiresAt = new Date(Date.now() + refusalDays * 86400000).toISOString();
    await base44.entities.Territory.update(territory.id, { status: 'available', reserved_by: null });
    await base44.entities.ReleasedTerritory.create({
      territory_id: territory.id,
      released_by_user_id: founderUserId,
      released_at: new Date().toISOString(),
      right_of_refusal_expires_at: expiresAt,
    });
    toast({ title: 'Territory released', description: `${territory.city_town} is now available. Right of first refusal expires in ${refusalDays} days.` });
    setReleaseTarget(null);
    onRefresh();
  }

  async function handleRevoke(territory, subscription) {
    await base44.entities.TerritorySubscription.update(subscription.id, { status: 'cancelled' });
    await base44.entities.Territory.update(territory.id, { status: 'reserved' });
    toast({ title: 'Sublicense revoked', description: `${territory.city_town} returned to reserved.` });
    setRevokeTarget(null);
    onRefresh();
  }

  return (
    <>
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search towns…"
          className="w-full sm:w-64 border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm text-[#1A3226] placeholder:text-[#1A3226]/30 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
      </div>
      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1A3226]/5 text-[#1A3226]/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Town</th>
                <th className="text-left px-4 py-3">County</th>
                <th className="text-right px-4 py-3">Population</th>
                <th className="text-right px-4 py-3">Seats</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Sublicensee</th>
                <th className="text-right px-4 py-3">Rev Share %</th>
                <th className="text-right px-4 py-3">Mo. Revenue</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-[#1A3226]/30">No towns found.</td></tr>
              )}
              {filtered.map(t => {
                const sub = getSubscription(t);
                const shareAmount = sub ? ((sub.monthly_price * sub.sublicensor_revenue_share) / 100).toFixed(2) : null;
                return (
                  <tr key={t.id} className="border-t border-[#1A3226]/5 hover:bg-[#1A3226]/2">
                    <td className="px-4 py-3 font-medium text-[#1A3226]">{t.city_town}</td>
                    <td className="px-4 py-3 text-[#1A3226]/60">{getCounty(t)}</td>
                    <td className="px-4 py-3 text-right text-[#1A3226]/60">{(t.population || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[#1A3226]/60">{t.seats_total || 1}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[t.status] || 'bg-gray-100 text-gray-500'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#1A3226]/60 text-xs">{sub?.user_id || '—'}</td>
                    <td className="px-4 py-3 text-right text-[#1A3226]/70">
                      {sub ? `${sub.sublicensor_revenue_share}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[#B8982F] font-medium">
                      {shareAmount ? `$${shareAmount}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {t.status === 'reserved' && (
                          <>
                            <Button size="sm" onClick={() => setSublicenseTarget(t)}
                              className="h-7 px-2 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                              Sublicense
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setReleaseTarget(t)}
                              className="h-7 px-2 text-xs text-slate-600 border-slate-200">
                              Release
                            </Button>
                          </>
                        )}
                        {t.status === 'sublicensed' && sub && (
                          <>
                            <Link to={`/account/subscription/${sub.id}`}
                              className="h-7 px-2 text-xs border border-[#1A3226]/20 rounded-md flex items-center text-[#1A3226]/70 hover:text-[#1A3226] hover:bg-[#1A3226]/5 transition-colors">
                              View
                            </Link>
                            <Button size="sm" variant="outline" onClick={() => setAdjustTarget({ territory: t, subscription: sub })}
                              className="h-7 px-2 text-xs">
                              Adjust %
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRevokeTarget({ territory: t, subscription: sub })}
                              className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sublicenseTarget && (
        <SublicenseModal open={!!sublicenseTarget} onClose={() => setSublicenseTarget(null)}
          territory={sublicenseTarget} pricing={pricing} onSuccess={onRefresh} />
      )}
      {adjustTarget && (
        <AdjustShareModal open={!!adjustTarget} onClose={() => setAdjustTarget(null)}
          territory={adjustTarget?.territory} subscription={adjustTarget?.subscription}
          pricing={pricing} onSuccess={onRefresh} />
      )}

      <AlertDialog open={!!releaseTarget} onOpenChange={() => setReleaseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release {releaseTarget?.city_town}?</AlertDialogTitle>
            <AlertDialogDescription>
              This territory will be returned to the available pool. You will have {pricing?.founder_refusal_days || 7} days of right of first refusal on any incoming claim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleRelease(releaseTarget)} className="bg-red-600 hover:bg-red-700 text-white">
              Release Territory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke sublicense for {revokeTarget?.territory?.city_town}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the sublicensee's subscription and return the territory to reserved status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleRevoke(revokeTarget?.territory, revokeTarget?.subscription)}
              className="bg-red-600 hover:bg-red-700 text-white">
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}