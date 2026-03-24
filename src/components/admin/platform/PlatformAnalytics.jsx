import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Building2, FileText, TrendingUp, Shield, MapPin, AlertCircle, Loader2 } from "lucide-react";

const COLORS = ["#1A3226", "#B8982F", "#4CAF50", "#2196F3", "#9C27B0"];

export default function PlatformAnalytics() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [fhReviews, setFhReviews] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [orgsData, analysesData, fhData] = await Promise.all([
          base44.asServiceRole.entities.Organization.list("-created_date", 200),
          base44.asServiceRole.entities.Analysis.list("-created_date", 500),
          base44.asServiceRole.entities.FairHousingReview.list("-created_date", 200),
        ]);
        setOrgs(orgsData || []);
        setAnalyses(analysesData || []);
        setFhReviews(fhData || []);
      } catch (e) {
        console.error('[PlatformAnalytics] load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-[#1A3226]/30" />
    </div>
  );

  // Compute stats
  const totalOrgs = orgs.length;
  const totalAnalyses = analyses.length;
  const fhSigned = fhReviews.filter(r => r.status === "signed").length;
  const fhOverdue = fhReviews.filter(r => r.status === "overdue").length;

  // By type
  const byType = {};
  analyses.forEach(a => { if (a.assessment_type) byType[a.assessment_type] = (byType[a.assessment_type] || 0) + 1; });
  const typeChart = Object.entries(byType).map(([name, count]) => ({ name: name.replace(/_/g, " "), count }));

  // By platform
  const byPlatform = {};
  analyses.forEach(a => { if (a.ai_platform) byPlatform[a.ai_platform] = (byPlatform[a.ai_platform] || 0) + 1; });
  const platformChart = Object.entries(byPlatform).map(([name, count]) => ({ name, count }));

  // Monthly (last 6 months)
  const byMonth = {};
  analyses.forEach(a => {
    const d = new Date(a.created_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });
  const monthChart = Object.entries(byMonth).sort().slice(-6).map(([name, count]) => ({ name, count }));

  // Per-org analysis counts
  const analysisByOrg = {};
  analyses.forEach(a => { if (a.org_id) analysisByOrg[a.org_id] = (analysisByOrg[a.org_id] || 0) + 1; });

  const fhByOrg = {};
  fhReviews.forEach(r => {
    if (!fhByOrg[r.org_id]) fhByOrg[r.org_id] = { signed: 0, overdue: 0 };
    if (r.status === "signed") fhByOrg[r.org_id].signed++;
    if (r.status === "overdue") fhByOrg[r.org_id].overdue++;
  });

  return (
    <div className="space-y-6">
      {/* Privacy notice */}
      <div className="rounded-lg border border-[#B8982F]/30 bg-[#B8982F]/5 px-4 py-3 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-[#B8982F] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#1A3226]/70">
          <strong className="text-[#1A3226]">Aggregate view only.</strong> Individual analysis content, addresses, and outputs are never shown here.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Organizations", value: totalOrgs, icon: Building2, color: "text-[#1A3226]", bg: "bg-[#1A3226]/5" },
          { label: "Total Analyses", value: totalAnalyses, icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "FH Reviews Signed", value: fhSigned, icon: Shield, color: "text-[#B8982F]", bg: "bg-[#B8982F]/10" },
          { label: "FH Overdue", value: fhOverdue, icon: AlertCircle, color: fhOverdue > 0 ? "text-red-600" : "text-[#1A3226]/40", bg: fhOverdue > 0 ? "bg-red-50" : "bg-gray-50" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border border-[#1A3226]/10 ${kpi.bg} p-4`}>
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
            <p className="text-2xl font-bold text-[#1A3226]">{kpi.value}</p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by Type</h3>
          {typeChart.length === 0 ? <p className="text-xs text-[#1A3226]/40 text-center py-8">No data yet</p> : (
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
          )}
        </div>

        {/* By Platform */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by AI Platform</h3>
          {platformChart.length === 0 ? <p className="text-xs text-[#1A3226]/40 text-center py-8">No data yet</p> : (
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
          )}
        </div>

        {/* Monthly trend */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Monthly Volume (last 6 months)</h3>
          {monthChart.length === 0 ? <p className="text-xs text-[#1A3226]/40 text-center py-8">No data yet</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthChart} margin={{ left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#1A3226" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orgs placeholder for 4th chart slot */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Org Status Breakdown</h3>
          {orgs.length === 0 ? <p className="text-xs text-[#1A3226]/40 text-center py-8">No orgs yet</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={Object.entries(
                  orgs.reduce((acc, o) => { acc[o.status || "unknown"] = (acc[o.status || "unknown"] || 0) + 1; return acc; }, {})
                ).map(([name, count]) => ({ name, count }))}
                margin={{ left: -20 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#B8982F" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Org summary table */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1A3226]/5">
          <h3 className="text-sm font-semibold text-[#1A3226]">Organization Summary</h3>
          <p className="text-xs text-[#1A3226]/40 mt-0.5">Aggregate counts only</p>
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
              {orgs.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-[#1A3226]/40">No organizations yet</td></tr>
              )}
              {orgs.map((org, i) => (
                <tr key={org.id} className={`${i !== orgs.length - 1 ? "border-b border-[#1A3226]/5" : ""} hover:bg-[#FAF8F4]/50`}>
                  <td className="px-5 py-3 font-medium text-[#1A3226]">{org.name}</td>
                  <td className="px-4 py-3 text-[#1A3226]/50 capitalize">{org.org_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      org.status === "active" ? "bg-emerald-50 text-emerald-700" :
                      org.status === "suspended" ? "bg-red-50 text-red-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>{org.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#1A3226]/70">{org.seat_count ?? 0}</td>
                  <td className="px-4 py-3 text-right text-[#1A3226]/70">{analysisByOrg[org.id] || 0}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{fhByOrg[org.id]?.signed || 0}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${(fhByOrg[org.id]?.overdue || 0) > 0 ? "text-red-600" : "text-[#1A3226]/30"}`}>
                    {fhByOrg[org.id]?.overdue || "—"}
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