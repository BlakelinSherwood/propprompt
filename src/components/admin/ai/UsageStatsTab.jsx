import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

const RANGES = [
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Last Month", value: "last_month" },
  { label: "All Time", value: "all" },
];

function getDateRange(range) {
  const now = new Date();
  if (range === "all") return null;
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  if (range === "last_month") {
    return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  }
  return null;
}

function getLastMonthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function StatusBadge({ status }) {
  const colors = {
    complete: "bg-green-100 text-green-700",
    in_progress: "bg-blue-100 text-blue-700",
    draft: "bg-gray-100 text-gray-600",
    archived: "bg-gray-100 text-gray-500",
    listed: "bg-purple-100 text-purple-700",
    sold: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${colors[status] || "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

export default function UsageStatsTab() {
  const [range, setRange] = useState("month");
  const [analyses, setAnalyses] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [all, cfg] = await Promise.all([
          base44.asServiceRole.entities.Analysis.list("-created_date", 500),
          base44.asServiceRole.entities.PlatformConfig.filter({}),
        ]);
        setAnalyses(all || []);
        setConfig(cfg[0] || {});
      } catch (e) {
        console.error('[UsageStatsTab] load error:', e);
        setAnalyses([]);
        setConfig({});
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = analyses.filter(a => {
    const from = getDateRange(range);
    const to = range === "last_month" ? getLastMonthEnd() : null;
    const d = new Date(a.created_date);
    if (from && d < new Date(from)) return false;
    if (to && d >= new Date(to)) return false;
    return true;
  });

  const totalCount = filtered.length;
  const ensembleCount = filtered.filter(a => a.ensemble_mode_used).length;
  const singleCount = filtered.filter(a => !a.ensemble_mode_used).length;
  const timesWithMs = filtered.filter(a => a.generation_time_ms > 0);
  const avgMs = timesWithMs.length > 0
    ? timesWithMs.reduce((s, a) => s + a.generation_time_ms, 0) / timesWithMs.length
    : 0;

  // Provider usage breakdown
  const providerUsage = {};
  filtered.forEach(a => {
    const p = a.ai_platform;
    if (p) {
      if (!providerUsage[p]) providerUsage[p] = { analyses: 0, sections: 0 };
      providerUsage[p].analyses++;
    }
    if (a.ensemble_section_outputs) {
      // Count sections per provider from section assignments (approximate from ai_model field)
      Object.keys(a.ensemble_section_outputs).forEach(() => {
        if (p) providerUsage[p].sections++;
      });
    }
  });

  const recent = filtered.slice(0, 20);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-[#1A3226]/40">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex gap-2">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              range === r.value
                ? "bg-[#1A3226] text-white"
                : "bg-[#1A3226]/5 text-[#1A3226]/60 hover:bg-[#1A3226]/10"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Analyses", value: totalCount },
          { label: "Ensemble Analyses", value: ensembleCount, accent: true },
          { label: "Single-Model Analyses", value: singleCount },
          { label: "Avg Generation Time", value: avgMs > 0 ? `${(avgMs / 1000).toFixed(1)}s` : "—" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.accent ? "border-purple-200 bg-purple-50" : "border-[#1A3226]/10 bg-white"}`}>
            <div className={`text-2xl font-bold ${c.accent ? "text-purple-700" : "text-[#1A3226]"}`}>{c.value}</div>
            <div className="text-xs text-[#1A3226]/50 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Provider Breakdown */}
      {Object.keys(providerUsage).length > 0 && (
        <div className="bg-white border border-[#1A3226]/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1A3226]/10">
            <h3 className="font-semibold text-[#1A3226]">Provider Usage Breakdown</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#1A3226]/3">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Analyses Used In</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Sections Generated</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Est. Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A3226]/5">
              {Object.entries(providerUsage).map(([p, data]) => {
                const enabledMap = {
                  claude: config.claude_enabled,
                  chatgpt: config.chatgpt_enabled,
                  gemini: config.gemini_enabled,
                  perplexity: config.perplexity_enabled,
                  grok: config.grok_enabled,
                  groq: config.groq_enabled,
                };
                const enabled = enabledMap[p] !== false;
                return (
                  <tr key={p} className="hover:bg-[#1A3226]/2">
                    <td className="px-4 py-3 font-medium text-[#1A3226] capitalize">{p}</td>
                    <td className="px-4 py-3 text-[#1A3226]/70">{data.analyses}</td>
                    <td className="px-4 py-3 text-[#1A3226]/70">{data.sections}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Analyses */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A3226]/10">
          <h3 className="font-semibold text-[#1A3226]">Recent Analyses</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1A3226]/3">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Property</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Mode</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Model(s)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Sections</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A3226]/5">
              {recent.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#1A3226]/40">No analyses in this period</td></tr>
              )}
              {recent.map(a => {
                const address = a.intake_data?.address || a.intake_data?.property_address || "—";
                const isEnsemble = a.ensemble_mode_used;
                const sectionsStr = isEnsemble
                  ? `${a.sections_completed ?? 0}/${a.sections_total ?? 9}`
                  : "—";
                const timeStr = a.generation_time_ms > 0
                  ? `${(a.generation_time_ms / 1000).toFixed(1)}s`
                  : "—";
                return (
                  <tr key={a.id} className="hover:bg-[#1A3226]/2">
                    <td className="px-4 py-3 text-[#1A3226]/60 whitespace-nowrap">
                      {new Date(a.created_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[#1A3226] max-w-[160px] truncate">{address}</td>
                    <td className="px-4 py-3">
                      {isEnsemble
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">Ensemble</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Single</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-[#1A3226]/70 capitalize">{a.ai_model || a.ai_platform || "—"}</td>
                    <td className="px-4 py-3 text-[#1A3226]/70">{sectionsStr}</td>
                    <td className="px-4 py-3 text-[#1A3226]/70">{timeStr}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}