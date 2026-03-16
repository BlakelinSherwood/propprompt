import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Building2, Users, FileText, TrendingUp } from "lucide-react";

const COLORS = ["#1A3226", "#B8982F", "#4CAF50", "#2196F3", "#FF5722"];

export default function PlatformAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [orgs, users, analyses] = await Promise.all([
        base44.entities.Organization.list(),
        base44.entities.User.list(),
        base44.entities.Analysis.list("-created_date", 200),
      ]);

      const orgsByStatus = orgs.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});

      const usersByRole = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {});

      const analysesByType = analyses.reduce((acc, a) => {
        const t = a.assessment_type || "unknown";
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});

      const analysesByPlatform = analyses.reduce((acc, a) => {
        const p = a.ai_platform || "unknown";
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});

      setStats({ orgs, users, analyses, orgsByStatus, usersByRole, analysesByType, analysesByPlatform });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading analytics…</div>;

  const { orgs, users, analyses, orgsByStatus, usersByRole, analysesByType, analysesByPlatform } = stats;

  const typeChartData = Object.entries(analysesByType).map(([name, count]) => ({ name: name.replace(/_/g, " "), count }));
  const platformChartData = Object.entries(analysesByPlatform).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Organizations", value: orgs.length, icon: Building2, color: "text-[#1A3226]", bg: "bg-[#1A3226]/5" },
          { label: "Total Users", value: users.length, icon: Users, color: "text-[#B8982F]", bg: "bg-[#B8982F]/10" },
          { label: "Total Analyses", value: analyses.length, icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Active Orgs", value: orgsByStatus.active || 0, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border border-[#1A3226]/10 ${kpi.bg} p-4`}>
            <div className={`${kpi.color} mb-2`}><kpi.icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-[#1A3226]">{kpi.value}</p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Analyses by Type */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeChartData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {typeChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Analyses by Platform */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Analyses by AI Platform</h3>
          <ResponsiveContainer width="100%" height={200}>
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

        {/* Users by Role */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Users by Role</h3>
          <div className="space-y-2">
            {Object.entries(usersByRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
              <div key={role} className="flex items-center gap-3">
                <span className="text-xs text-[#1A3226]/60 w-36 capitalize">{role.replace(/_/g, " ")}</span>
                <div className="flex-1 bg-[#1A3226]/5 rounded-full h-2">
                  <div
                    className="bg-[#1A3226] h-2 rounded-full"
                    style={{ width: `${Math.round((count / users.length) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#1A3226] w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Org Status Breakdown */}
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Org Status Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(orgsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-[#1A3226]/60 w-24 capitalize">{status}</span>
                <div className="flex-1 bg-[#1A3226]/5 rounded-full h-2">
                  <div
                    className="bg-[#B8982F] h-2 rounded-full"
                    style={{ width: `${Math.round((count / orgs.length) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#1A3226] w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}