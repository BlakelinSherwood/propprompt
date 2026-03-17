import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function exportCSV(rows, territories, subscriptions) {
  const getCity = (id) => territories.find(t => t.id === id)?.city_town || id;
  const getSublicensee = (subId) => subscriptions.find(s => s.id === subId)?.user_id || subId;

  const header = ["Town","Sublicensee","Gross Paid","Share %","Your Earnings","Transfer Status","Period Start","Period End"];
  const lines = rows.map(r => [
    getCity(r.territory_id),
    getSublicensee(r.sublicensee_subscription_id),
    r.gross_amount,
    r.share_pct,
    r.share_amount,
    r.status,
    r.period_start,
    r.period_end,
  ]);
  const csv = [header, ...lines].map(row => row.map(v => `"${v ?? ''}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "revenue-share.csv"; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_COLORS = {
  transferred: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
};

export default function RevenueShareTab({ ledger, territories, subscriptions }) {
  const months = useMemo(() => {
    const set = new Set(ledger.map(r => r.period_start?.slice(0, 7)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [ledger]);

  const [month, setMonth] = useState(months[0] || "");

  const filtered = month ? ledger.filter(r => r.period_start?.startsWith(month)) : ledger;

  const totalEarnings = filtered.reduce((s, r) => s + (r.share_amount || 0), 0);
  const totalGross = filtered.reduce((s, r) => s + (r.gross_amount || 0), 0);

  const getCity = (id) => territories.find(t => t.id === id)?.city_town || id;
  const getSublicensee = (subId) => subscriptions.find(s => s.id === subId)?.user_id || subId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-[#1A3226]/20 rounded-lg px-3 py-1.5 text-sm text-[#1A3226]"
          >
            <option value="">All months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="text-sm text-[#1A3226]/50">{filtered.length} records</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, territories, subscriptions)} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1A3226]/[0.03] text-xs text-[#1A3226]/50 uppercase tracking-wider">
              <tr>
                {["Town","Sublicensee","Gross Paid","Share %","Your Earnings","Transfer Status","Period"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A3226]/5">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-[#1A3226]/[0.02]">
                  <td className="px-4 py-3 font-medium text-[#1A3226]">{getCity(r.territory_id)}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60 text-xs">{getSublicensee(r.sublicensee_subscription_id)}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">${(r.gross_amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[#1A3226]/60">{r.share_pct}%</td>
                  <td className="px-4 py-3 font-semibold text-green-700">${(r.share_amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#1A3226]/50 text-xs">{r.period_start} → {r.period_end}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#1A3226]/40">No revenue share records for this period.</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-[#1A3226]/[0.03] border-t border-[#1A3226]/10 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-[#1A3226]">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-[#1A3226]">${totalGross.toFixed(2)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-green-700">${totalEarnings.toFixed(2)}</td>
                  <td colSpan={2} className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}