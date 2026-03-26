import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

function fmt(n) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US");
}

export default function ValuationAnomalyModal({ anomalyData, analysisId, onReviewComps, onOverrideConfirmed }) {
  const [showOverride, setShowOverride] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleOverride() {
    if (confirmText !== "CONFIRMED") return;
    setSaving(true);
    try {
      const me = await base44.auth.me();
      await base44.entities.Analysis.update(analysisId, {
        override_acknowledged: true,
        override_acknowledged_by: me?.id || me?.email || "",
        override_acknowledged_at: new Date().toISOString(),
        status: "complete",
      });
      onOverrideConfirmed();
    } catch (e) {
      console.error("[ValuationAnomalyModal] override save failed:", e);
      alert("Failed to save override. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg space-y-5 p-7">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1A3226]">
              ⚠️ Valuation Anomaly Detected — Review Required
            </h2>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">Generation paused — no credit deducted</p>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-[#1A3226]/75 leading-relaxed">
          The AI-generated valuation is significantly below what market appreciation would suggest for this property.
        </p>

        {/* Data points */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 divide-y divide-amber-100">
          {[
            ["Prior sale price", `${fmt(anomalyData.prior_sale_price)} (${anomalyData.prior_sale_year})`],
            ["Projected current value", fmt(anomalyData.projected_current_value)],
            ["AI-generated midpoint", fmt(anomalyData.ai_midpoint)],
            ["Variance", `${anomalyData.variance_percent}% below projected`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 gap-4">
              <span className="text-xs text-amber-800/70">{label}</span>
              <span className="text-sm font-semibold text-amber-900">{value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#1A3226]/60 leading-relaxed">
          This gap is outside normal parameters and may indicate the AI used incorrect data, the wrong property type, or insufficient comps.{" "}
          <strong>Do not share this report with your client</strong> until you have reviewed your comp set and confirmed the valuation is reasonable.
        </p>

        {/* Override confirmation input */}
        {showOverride && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-xs font-medium text-red-800">
              Type <strong>CONFIRMED</strong> below to override and proceed with PDF generation.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Type CONFIRMED"
              className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleOverride}
                disabled={confirmText !== "CONFIRMED" || saving}
                className="bg-red-600 hover:bg-red-700 text-white gap-1"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Proceed with override
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowOverride(false); setConfirmText(""); }}
                className="text-[#1A3226]/60">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!showOverride && (
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button
              onClick={onReviewComps}
              className="flex-1 bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
            >
              Review My Comps
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowOverride(true)}
              className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
            >
              Override — I Confirm This Valuation Is Correct
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}