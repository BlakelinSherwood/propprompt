import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Building2, Users, FileText, TrendingUp, Shield, MapPin, AlertCircle } from "lucide-react";

const COLORS = ["#1A3226", "#B8982F", "#4CAF50", "#2196F3", "#9C27B0"];

export default function PlatformAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.functions.invoke("platformAggregate", {})
      .then((res) => {
        if (res.data?.error) {
          setError(res.data.error);
        } else {
          setData(res.data);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-6 flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-red-500" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  );

  const { summary, by_type, by_platform, by_month, town_heatmap, org_summary } = data;

  const typeChart = Object.entries(by_type || {}).map(([name, count]) => ({ name: name.replace(/_/g, " "), count }));
  const platformChart = Object.entries(by_platform || {}).map(([name, count]) => ({ name, count }));
  const monthChart = Object.entries(by_month || {}).sort().slice(-6).map(([name, count]) => ({ name, count }));
  const fhStats = summary.fair_housing || {};

  return (
    <div className="space-y-6">
      {/* Privacy notice */}
      <div className="rounded-lg border border-[#B8982F]/30 bg-[#B8982F]/5 px-4 py-3 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-[#B8982F] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#1A3226]/70">
          <strong className="text-[#1A3226]">Aggregate view only.</strong> Individual analysis content, addresses, and outputs are never accessible here. Private analyses are excluded from all counts. Town data suppressed where n &lt; 3 (k-anonymity).
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Organizations", value: summary.total_orgs, icon: Building2, color: "text-[#1A3226]", bg: "bg-[#1A3226]/5" },
          { label: "Total Analyses", value: summary.total_analyses, icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "FH Reviews Signed", value: fhStats.signed || 0, icon: Shield, color: "text-[#B8982F]", bg: "bg-[#B8982F]/10" },
          { label: "FH Overdue", value: fhStats.overdue || 0, icon: AlertCircle, color: fhStats.overdue > 0 ? "text-red-600" : "text-[#1A3226]/40", bg: fhStats.overdue > 0 ? "bg-red-50" : "bg-gray-50" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border border-[#1A3226]/10 ${kpi.bg} p-4`}>
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
            <p className="text-2xl font-bold text-[#1A3226]">{kpi.value}</p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Analyses by Type */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by Type</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeChart} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {typeChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Analyses by Platform */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by AI Platform</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={platformChart} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {platformChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly trend */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Monthly Volume (last 6 months)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthChart} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#1A3226" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Town heatmap (k-anon) */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1A3226]">Activity by Town</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-[#1A3226]/40">
              <MapPin className="w-3 h-3" />
              k=3 anonymity applied
            </div>
          </div>
          {town_heatmap.length === 0 ? (
            <p className="text-xs text-[#1A3226]/40 text-center py-8">No town data above threshold yet</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {town_heatmap.slice(0, 15).map((t, i) => (
                <div key={t.town} className="flex items-center gap-3">
                  <span className="text-xs text-[#1A3226]/60 w-32 truncate">{t.town}</span>
                  <div className="flex-1 bg-[#1A3226]/5 rounded-full h-2">
                    <div
                      className="bg-[#B8982F] h-2 rounded-full transition-all"
                      style={{ width: `${Math.round((t.count / town_heatmap[0].count) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[#1A3226] w-6 text-right">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Org summary table */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1A3226]/5">
          <h3 className="text-sm font-semibold text-[#1A3226]">Organization Summary</h3>
          <p className="text-xs text-[#1A3226]/40 mt-0.5">Aggregate counts only — no analysis content</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#FAF8F4] text-[#1A3226]/50 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-2.5 text-left">Org</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Seats</th>
                <th className="px-4 py-2.5 text-right">Analyses</th>
                <th className="px-4 py-2.5 text-right">FH Signed</th>
                <th className="px-4 py-2.5 text-right">FH Overdue</th>
              </tr>
            </thead>
            <tbody>
              {org_summary.map((org, i) => (
                <tr key={org.id} className={`${i !== org_summary.length - 1 ? "border-b border-[#1A3226]/5" : ""} hover:bg-[#FAF8F4]/50`}>
                  <td className="px-5 py-3 font-medium text-[#1A3226]">{org.name}</td>
                  <td className="px-4 py-3 text-[#1A3226]/50 capitalize">{org.org_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      org.status === "active" ? "bg-emerald-50 text-emerald-700" :
                      org.status === "suspended" ? "bg-red-50 text-red-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {org.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#1A3226]/70">{org.seat_count}</td>
                  <td className="px-4 py-3 text-right text-[#1A3226]/70">{org.analysis_count}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{org.fair_housing.signed}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${org.fair_housing.overdue > 0 ? "text-red-600" : "text-[#1A3226]/30"}`}>
                    {org.fair_housing.overdue || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}