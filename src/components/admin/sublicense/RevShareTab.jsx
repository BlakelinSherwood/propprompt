import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TRANSFER_BADGE = {
  pending: 'bg-yellow-100 text-yellow-700',
  transferred: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

function getMonthLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getMonths(ledger) {
  const months = new Set(ledger.map(l => l.period_start?.slice(0, 7)).filter(Boolean));
  return Array.from(months).sort().reverse();
}

export default function RevShareTab({ ledger, territories }) {
  const months = getMonths(ledger);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(months[0] || currentMonth);

  const filtered = ledger.filter(l => l.period_start?.slice(0, 7) === selectedMonth);
  const totalGross = filtered.reduce((s, l) => s + (l.gross_amount || 0), 0);
  const totalEarnings = filtered.reduce((s, l) => s + (l.share_amount || 0), 0);

  function getTerritory(id) { return territories.find(t => t.id === id); }

  function exportCSV() {
    const header = ['Town', 'Sublicensee', 'Gross Paid', 'Share %', 'Your Earnings', 'Transfer Status', 'Period'];
    const rows = filtered.map(l => {
      const t = getTerritory(l.territory_id);
      return [t?.city_town || l.territory_id, l.sublicensee_subscription_id, `$${l.gross_amount?.toFixed(2)}`,
        `${l.share_pct}%`, `$${l.share_amount?.toFixed(2)}`, l.status,
        `${l.period_start} — ${l.period_end}`];
    });
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `revenue-share-${selectedMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm text-[#1A3226] bg-white">
            {months.length ? months.map(m => (
              <option key={m} value={m}>{getMonthLabel(m + '-01')}</option>
            )) : <option value={currentMonth}>Current Month</option>}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1A3226]/5 text-[#1A3226]/50 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Town</th>
                <th className="text-left px-4 py-3">Sublicensee</th>
                <th className="text-right px-4 py-3">Gross Paid</th>
                <th className="text-right px-4 py-3">Share %</th>
                <th className="text-right px-4 py-3">Your Earnings</th>
                <th className="text-left px-4 py-3">Transfer Status</th>
                <th className="text-left px-4 py-3">Period</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-[#1A3226]/30">No revenue share records for this month.</td></tr>
              )}
              {filtered.map(l => {
                const t = getTerritory(l.territory_id);
                return (
                  <tr key={l.id} className="border-t border-[#1A3226]/5 hover:bg-[#1A3226]/2">
                    <td className="px-4 py-3 font-medium text-[#1A3226]">{t?.city_town || '—'}</td>
                    <td className="px-4 py-3 text-[#1A3226]/60 text-xs">{l.sublicensee_subscription_id}</td>
                    <td className="px-4 py-3 text-right text-[#1A3226]/70">${l.gross_amount?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-[#1A3226]/70">{l.share_pct}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#B8982F]">${l.share_amount?.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TRANSFER_BADGE[l.status] || 'bg-gray-100 text-gray-500'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#1A3226]/50">{l.period_start} — {l.period_end}</td>
                  </tr>
                );
              })}
              {filtered.length > 0 && (
                <tr className="border-t-2 border-[#1A3226]/10 bg-[#1A3226]/3 font-semibold">
                  <td className="px-4 py-3 text-[#1A3226]" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right text-[#1A3226]/70">${totalGross.toFixed(2)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-[#B8982F]">${totalEarnings.toFixed(2)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}