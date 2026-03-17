import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Search } from "lucide-react";

const STATUS_BADGE = {
  sublicensed: "bg-purple-100 text-purple-700 border-purple-200",
  reserved: "bg-slate-100 text-slate-700 border-slate-200",
  available: "bg-green-100 text-green-700 border-green-200",
};

export default function TownsTable({ territories, counties, subscriptions, onSublicense, onRelease, onAdjust, onRevoke }) {
  const [q, setQ] = useState("");

  const filtered = territories.filter(t =>
    !q || t.city_town?.toLowerCase().includes(q.toLowerCase())
  );

  const getCounty = (id) => counties.find(c => c.id === id)?.name || "—";
  const getSub = (t) => subscriptions.find(s => s.territory_id === t.id && s.status === 'active');

  return (
    <div className="bg-white rounded-xl border border-[#1A3226]/10 overflow-hidden">
      <div className="p-4 border-b border-[#1A3226]/10 flex items-center gap-3">
        <Search className="w-4 h-4 text-[#1A3226]/40" />
        <Input
          placeholder="Filter towns…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 px-0 h-7"
        />
        <span className="text-xs text-[#1A3226]/40 whitespace-nowrap">{filtered.length} towns</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1A3226]/[0.03] text-xs text-[#1A3226]/50 uppercase tracking-wider">
            <tr>
              {["Town", "County", "Population", "Seats", "Status", "Sublicensee", "Rev Share %", "Monthly Rev", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3226]/5">
            {filtered.map(t => {
              const sub = getSub(t);
              const tierPrice = sub ? (sub.monthly_price || 0) : 0;
              const revEarned = sub ? ((tierPrice * (sub.sublicensor_revenue_share || 0)) / 100).toFixed(2) : "—";

              return (
                <tr key={t.id} className="hover:bg-[#1A3226]/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1A3226]">{t.city_town}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{getCounty(t.county_id)}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{(t.population || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{t.seats_total || 1}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[t.status] || STATUS_BADGE.reserved}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#1A3226]/60 text-xs">{sub?.user_id || "—"}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{sub ? `${sub.sublicensor_revenue_share || 0}%` : "—"}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{sub ? `$${revEarned}` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {t.status === 'reserved' && (
                        <>
                          <Button size="sm" onClick={() => onSublicense(t)}
                            className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white px-2">
                            Sublicense
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onRelease(t)}
                            className="h-7 text-xs px-2">
                            Release
                          </Button>
                        </>
                      )}
                      {t.status === 'sublicensed' && sub && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => onAdjust(t, sub)}
                            className="h-7 text-xs px-2">
                            Adj. Share
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onRevoke(t, sub)}
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 px-2">
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#1A3226]/40">No towns match your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}