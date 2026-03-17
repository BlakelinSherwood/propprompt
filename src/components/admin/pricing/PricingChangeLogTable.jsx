import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function PricingChangeLogTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PricingChangeLog.list("-changed_at", 50).then((data) => {
      setLogs(data || []);
      setLoading(false);
    });
  }, []);

  const fmt = (key, val) => {
    if (val === null || val === undefined) return "—";
    return String(val);
  };

  if (loading) return <div className="text-sm text-[#1A3226]/40 py-4">Loading audit log…</div>;
  if (!logs.length) return <div className="text-sm text-[#1A3226]/40 py-4">No changes recorded yet.</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1A3226]/10">
      <table className="w-full text-xs">
        <thead className="bg-[#1A3226]/5">
          <tr>
            {["Date / Time", "Field", "Old Value", "New Value", "Changed By"].map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium text-[#1A3226]/60 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={log.id} className={i % 2 === 0 ? "bg-white" : "bg-[#1A3226]/2"}>
              <td className="px-3 py-2 text-[#1A3226]/60 whitespace-nowrap">
                {log.changed_at ? format(new Date(log.changed_at), "MMM d, yyyy h:mm a") : "—"}
              </td>
              <td className="px-3 py-2 text-[#1A3226] font-medium">{log.display_label || log.config_key}</td>
              <td className="px-3 py-2 text-red-600">{fmt(log.config_key, log.old_value)}</td>
              <td className="px-3 py-2 text-emerald-700">{fmt(log.config_key, log.new_value)}</td>
              <td className="px-3 py-2 text-[#1A3226]/60">{log.changed_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}