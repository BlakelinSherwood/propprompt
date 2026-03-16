import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Users, TrendingUp, CheckCircle } from "lucide-react";
import moment from "moment";

export default function TeamUsageTab({ org, user }) {
  const [analyses, setAnalyses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Analysis.filter({ org_id: org.id }, "-created_date", 200),
      base44.entities.OrgMembership.filter({ org_id: org.id }),
    ]).then(([ana, mem]) => {
      setAnalyses(ana);
      setMembers(mem.filter((m) => m.status === "active"));
      setLoading(false);
    });
  }, [org.id]);

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading usage…</div>;

  const thisMonth = analyses.filter((a) => moment(a.created_date).isSame(moment(), "month"));
  const complete = analyses.filter((a) => a.status === "complete");

  // Per-agent breakdown
  const agentMap = analyses.reduce((acc, a) => {
    const email = a.run_by_email;
    if (!acc[email]) acc[email] = { total: 0, thisMonth: 0, complete: 0 };
    acc[email].total++;
    if (moment(a.created_date).isSame(moment(), "month")) acc[email].thisMonth++;
    if (a.status === "complete") acc[email].complete++;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Members", value: members.length, icon: Users },
          { label: "Total Analyses", value: analyses.length, icon: FileText },
          { label: "This Month", value: thisMonth.length, icon: TrendingUp },
          { label: "Completed", value: complete.length, icon: CheckCircle },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#1A3226]/10 bg-white p-4">
            <div className="text-[#1A3226]/40 mb-2"><k.icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-[#1A3226]">{k.value}</p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Per-agent table */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1A3226]/8">
          <h3 className="font-semibold text-sm text-[#1A3226]">Usage by Agent</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/10">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-[#1A3226]/60 text-xs">Agent</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#1A3226]/60 text-xs">This Month</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#1A3226]/60 text-xs">Total</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#1A3226]/60 text-xs">Complete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3226]/5">
            {Object.entries(agentMap).sort((a, b) => b[1].total - a[1].total).map(([email, stats]) => (
              <tr key={email} className="hover:bg-[#1A3226]/[0.02]">
                <td className="px-4 py-2.5 text-[#1A3226] text-xs">{email}</td>
                <td className="px-4 py-2.5 text-right text-[#1A3226] font-medium">{stats.thisMonth}</td>
                <td className="px-4 py-2.5 text-right text-[#1A3226]/60">{stats.total}</td>
                <td className="px-4 py-2.5 text-right text-emerald-600">{stats.complete}</td>
              </tr>
            ))}
            {Object.keys(agentMap).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[#1A3226]/40">No usage data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}