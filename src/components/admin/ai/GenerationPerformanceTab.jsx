import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TIERS = ["starter", "pro", "team", "broker"];
const THRESHOLDS = { starter: 30, pro: 45, team: 45, broker: 60 };
const PIPELINES = { starter: "Claude + GPT-4o", pro: "5-model ensemble", team: "5-model ensemble", broker: "5-model ensemble" };

export default function GenerationPerformanceTab() {
  const [snapshot, setSnapshot] = useState(null);
  const [exceedances, setExceedances] = useState([]);
  const [allTimings, setAllTimings] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const configs = await base44.entities.PlatformConfig.list();
      const config = configs[0];
      setSnapshot(config?.generation_perf_snapshot || {});

      const timings = await base44.entities.GenerationTimingLog.list('-created_at', 100);
      const exceedanceList = timings.filter(t => t.threshold_exceeded).slice(0, 20);
      setExceedances(exceedanceList);
      setAllTimings(timings);
    } catch (error) {
      console.error("Error loading generation performance data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    try {
      await base44.functions.invoke('generationTimeMonitor', {});
      setTimeout(loadData, 1000);
    } catch (error) {
      console.error("Error triggering refresh:", error);
      setLoading(false);
    }
  }

  if (loading) return <div className="p-4 text-center text-sm text-slate-500">Loading...</div>;

  const lastUpdated = snapshot?.last_computed ? new Date(snapshot.last_computed).toLocaleString() : "Never";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1A3226]">Generation Performance</h2>
          <p className="text-sm text-[#1A3226]/60 mt-1">Average AI copy generation time per tier. Does not include PDF render or file upload.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#1A3226]/50">
          <span>Last updated: {lastUpdated}</span>
          <button onClick={handleRefresh} className="p-1 hover:bg-[#1A3226]/10 rounded" title="Refresh data">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map(tier => {
          const data = snapshot?.[tier] || {};
          const threshold = THRESHOLDS[tier];
          const avgColor = data.avg_7d && data.avg_7d < threshold * 0.7 ? "text-green-600" : data.avg_7d && data.avg_7d < threshold ? "text-amber-600" : "text-red-600";
          const p95Color = data.p95_7d && data.p95_7d < threshold * 0.7 ? "text-green-600" : data.p95_7d && data.p95_7d < threshold ? "text-amber-600" : "text-red-600";
          const exceedColor = data.pct_exceeded_7d === 0 ? "text-green-600" : data.pct_exceeded_7d <= 5 ? "text-amber-600" : "text-red-600";

          return (
            <div key={tier} className="border border-[#1A3226]/10 rounded-lg p-4 space-y-3">
              <div className="text-sm font-semibold text-[#1A3226] capitalize">{tier}</div>
              <div>
                <div className="text-xs text-[#1A3226]/60">Avg (7 days)</div>
                <div className={`text-2xl font-bold ${avgColor}`}>{(data.avg_7d || 0).toFixed(1)}s</div>
              </div>
              <div>
                <div className="text-xs text-[#1A3226]/60">P95 (7 days)</div>
                <div className={`text-lg font-semibold ${p95Color}`}>{(data.p95_7d || 0).toFixed(1)}s</div>
              </div>
              <div className="text-xs text-[#1A3226]/60">Reports: <span className="font-medium">{data.count_7d || 0}</span></div>
              <div className="text-xs text-[#1A3226]/60">Threshold: <span className="font-medium">{threshold}s</span></div>
              <div className="text-xs text-[#1A3226]/60">Exceeded: <span className={`font-medium ${exceedColor}`}>{(data.pct_exceeded_7d || 0).toFixed(1)}%</span></div>
            </div>
          );
        })}
      </div>

      <div className="border border-[#1A3226]/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#FAF8F4]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Tier</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Pipeline</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Alert Threshold</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Target</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map(tier => (
              <tr key={tier} className="border-t border-[#1A3226]/10">
                <td className="px-4 py-2 capitalize font-medium text-[#1A3226]">{tier}</td>
                <td className="px-4 py-2 text-[#1A3226]/70">{PIPELINES[tier]}</td>
                <td className="px-4 py-2 text-[#1A3226]/70">{THRESHOLDS[tier]}s</td>
                <td className="px-4 py-2 text-[#1A3226]/70">8–14s (Starter), 18–28s (Others)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-[#1A3226]/10 rounded-lg p-4 text-sm text-[#1A3226]/70">
        <p className="text-xs">Alert thresholds are early-warning. Alerts fire before the 60-second target is reached to allow time to investigate before agents are affected.</p>
      </div>

      {exceedances.length === 0 ? (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-sm text-green-800">
          ✓ No threshold exceedances in the last 7 days. All tiers are performing within target ranges.
        </div>
      ) : (
        <div className="border border-[#1A3226]/10 rounded-lg overflow-hidden">
          <div className="bg-[#FAF8F4] px-4 py-2 text-xs font-semibold text-[#1A3226]/60">Recent Exceedances</div>
          <table className="w-full text-sm">
            <thead className="bg-[#FAF8F4] border-t border-[#1A3226]/10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Tier</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Report Type</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#1A3226]/60">Duration</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#1A3226]/60">Over by</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {exceedances.map((exc, idx) => {
                const relTime = Math.round((Date.now() - new Date(exc.created_at).getTime()) / 60000);
                const overBy = (exc.duration_seconds - THRESHOLDS[exc.subscription_tier]).toFixed(1);
                return (
                  <tr key={idx} className="border-t border-[#1A3226]/10">
                    <td className="px-4 py-2 text-[#1A3226]/70">{relTime}m ago</td>
                    <td className="px-4 py-2"><span className="px-2 py-1 rounded text-xs font-medium bg-[#1A3226]/10 text-[#1A3226]">{exc.subscription_tier}</span></td>
                    <td className="px-4 py-2 text-[#1A3226]/70 text-xs">{exc.report_type}</td>
                    <td className="px-4 py-2 text-right text-[#1A3226] font-medium">{exc.duration_seconds}s</td>
                    <td className="px-4 py-2 text-right text-red-600 font-medium">+{overBy}s</td>
                    <td className="px-4 py-2 text-[#1A3226]/70 text-xs">{exc.model_pipeline}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border border-[#1A3226]/10 rounded-lg overflow-hidden">
        <button onClick={() => setShowAll(!showAll)} className="w-full px-4 py-3 text-left text-sm font-medium text-[#1A3226] hover:bg-[#FAF8F4] flex items-center justify-between">
          <span>Show all recent timings ({allTimings.length} total)</span>
          <span className="text-xs text-[#1A3226]/60">{showAll ? "▼" : "▶"}</span>
        </button>
        {showAll && (
          <table className="w-full text-sm border-t border-[#1A3226]/10">
            <thead className="bg-[#FAF8F4]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Tier</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#1A3226]/60">Report Type</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-[#1A3226]/60">Duration</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-[#1A3226]/60">Status</th>
              </tr>
            </thead>
            <tbody>
              {allTimings.slice(0, 50).map((timing, idx) => {
                const relTime = Math.round((Date.now() - new Date(timing.created_at).getTime()) / 60000);
                const exceeded = timing.threshold_exceeded;
                return (
                  <tr key={idx} className="border-t border-[#1A3226]/10">
                    <td className="px-4 py-2 text-[#1A3226]/70 text-xs">{relTime}m ago</td>
                    <td className="px-4 py-2 text-xs capitalize text-[#1A3226]">{timing.subscription_tier}</td>
                    <td className="px-4 py-2 text-xs text-[#1A3226]/70">{timing.report_type}</td>
                    <td className="px-4 py-2 text-right text-[#1A3226] font-medium">{timing.duration_seconds}s</td>
                    <td className="px-4 py-2 text-center"><span className={`w-2 h-2 rounded-full inline-block ${exceeded ? "bg-red-500" : "bg-green-500"}`}></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}