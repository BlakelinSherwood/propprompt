import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function PricingChangeLogTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PricingChangeLog.list('-changed_at', 50).then(rows => {
      setLogs(rows);
      setLoading(false);
    });
  }, []);

  const fmt = (v) => {
    if (v === null || v === undefined) return '—';
    return typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v;
  };

  const fmtDate = (s) => {
    if (!s) return '—';
    return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1A3226] mb-4">Change Log</h2>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No changes recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date / Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Field</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Old Value</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">New Value</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Changed By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.changed_at)}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#1A3226]">{l.display_label || l.config_key}</div>
                    <div className="text-xs text-gray-400 font-mono">{l.config_key}</div>
                  </td>
                  <td className="px-4 py-2.5 text-red-500">{fmt(l.old_value)}</td>
                  <td className="px-4 py-2.5 text-emerald-600 font-medium">{fmt(l.new_value)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.changed_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}