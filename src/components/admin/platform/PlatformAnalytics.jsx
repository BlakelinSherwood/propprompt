import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { Building2, Users, FileText, TrendingUp, Shield, MapPin, Loader2 } from "lucide-react";

const COLORS = ["#1A3226", "#B8982F", "#4CAF50", "#2196F3", "#FF5722", "#9C27B0"];

export default function PlatformAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.functions.invoke("platformAggregateAnalytics").then((res) => {
      if (res.data?.error) { setError(res.data.error); }
      else { setData(res.data); }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-[#1A3226]/50">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading aggregate analytics…
    </div>
  );

  if (error) return <div className="text-red-600 text-sm py-8 text-center">{error}</div>;
  if (!data) return null;

  const typeChartData = Object.entries(data.analysesByType || {}).map(([name, count]) => ({
    name: name.replace(/_/g, " "), count,
  }));
  const platformChartData = Object.entries(data.analysesByPlatform || {}).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-6">
      {/* Privacy notice */}
      <div className="flex items-start gap-2 text-xs text-[#1A3226]/60 bg-[#1A3226]/[0.03] border border-[#1A3226]/10 rounded-xl px-4 py-3">
        <Shield className="w-4 h-4 shrink-0 mt-0.5 text-[#1A3226]/40" />
        <p>Aggregate statistics only — per Addendum A3.3. No individual analysis content, addresses, or prompts are accessible from this view. Town heat map suppresses locations with fewer than {data.kAnonymityThreshold} analyses (k-anonymity).</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Organizations", value: data.totalOrgs, icon: Building2 },
          { label: "Total Users", value: data.totalUsers, icon: Users },
          { label: "Total Analyses", value: data.totalAnalyses, icon: FileText },
          { label: "Active Orgs", value: data.orgCountByStatus?.active || 0, icon: TrendingUp },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#1A3226]/10 bg-white p-4">
            <div className="text-[#1A3226]/40 mb-2"><kpi.icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-[#1A3226]">{kpi.value}</p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Fair Housing Compliance Counts */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-[#1A3226] mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#B8982F]" /> Fair Housing Review Status (counts only)
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Signed", value: data.fairHousingCounts.signed, color: "text-emerald-600 bg-emerald-50" },
            { label: "Pending", value: data.fairHousingCounts.pending, color: "text-yellow-600 bg-yellow-50" },
            { label: "Viewed", value: data.fairHousingCounts.viewed, color: "text-blue-600 bg-blue-50" },
            { label: "Overdue", value: data.fairHousingCounts.overdue, color: "text-red-600 bg-red-50" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg p-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Analyses over time */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by Month</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.totalAnalysesByMonth} margin={{ left: -20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#1A3226" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Analyses by Type */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by Type</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeChartData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {typeChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Platform distribution */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by AI Platform</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={platformChartData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {platformChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Town Heat Map */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#B8982F]" /> Town Activity Heat Map
          </h3>
          <p className="text-xs text-[#1A3226]/40 mb-3">Towns with ≥{data.kAnonymityThreshold} analyses shown (k-anonymity applied)</p>
          {data.townHeatMap.length === 0 ? (
            <p className="text-sm text-[#1A3226]/40 text-center py-6">Not enough data yet (minimum {data.kAnonymityThreshold} analyses per town required)</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {data.townHeatMap.map((t, i) => (
                <div key={t.town} className="flex items-center gap-3">
                  <span className="text-xs text-[#1A3226]/60 capitalize w-32 truncate">{t.town}</span>
                  <div className="flex-1 bg-[#1A3226]/5 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-[#B8982F]"
                      style={{ width: `${Math.round((t.count / (data.townHeatMap[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[#1A3226] w-6 text-right">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Users by Role */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Users by Role</h3>
        <div className="space-y-2">
          {Object.entries(data.userCountByRole || {}).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
            <div key={role} className="flex items-center gap-3">
              <span className="text-xs text-[#1A3226]/60 w-40 capitalize">{role.replace(/_/g, " ")}</span>
              <div className="flex-1 bg-[#1A3226]/5 rounded-full h-2">
                <div
                  className="bg-[#1A3226] h-2 rounded-full"
                  style={{ width: `${Math.round((count / data.totalUsers) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#1A3226] w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}