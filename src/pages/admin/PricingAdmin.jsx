import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, RefreshCw, DollarSign, Settings } from "lucide-react";
import PricingField from "../../components/admin/pricing/PricingField";
import ConfirmPricingModal from "../../components/admin/pricing/ConfirmPricingModal";
import PricingChangeLogTable from "../../components/admin/pricing/PricingChangeLogTable";

const CATEGORY_LABELS = {
  tier_pricing: "Tier Pricing",
  analysis_caps: "Analysis Caps",
  bundle_discounts: "Bundle Discounts",
  buyout_discounts: "Full City Buyout Discounts",
  topup_packs: "Top-Up Packs",
  pool_pricing: "Population Pool",
  overage: "Overage Pricing",
  revenue_share: "Revenue Share",
  thresholds: "Thresholds & Automation",
};

export default function PricingAdmin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState(null); // {configKey, newValue, record}
  const [logKey, setLogKey] = useState(0);
  const [seatConfirmText, setSeatConfirmText] = useState("");

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (!u || u.role !== "admin") { navigate("/Dashboard"); return; }
      setUser(u);
      loadConfigs();
    });
  }, []);

  const loadConfigs = async () => {
    const rows = await base44.entities.PricingConfig.list();
    setConfigs(rows || []);
    setLoading(false);
  };

  const byCategory = useCallback((cat) => configs.filter((c) => c.category === cat), [configs]);
  const getValue = useCallback((key) => configs.find((c) => c.config_key === key)?.config_value ?? 0, [configs]);
  const getRecord = useCallback((key) => configs.find((c) => c.config_key === key), [configs]);

  const requestSave = (configKey, newValue) => {
    const record = getRecord(configKey);
    if (!record) return;
    setPendingChange({ configKey, newValue, record });
  };

  const confirmSave = async () => {
    if (!pendingChange) return;
    const { configKey, newValue } = pendingChange;
    const res = await base44.functions.invoke("updatePricingConfig", { config_key: configKey, new_value: newValue });
    if (res?.data?.success) {
      await loadConfigs();
      setLogKey((k) => k + 1);
      // Refresh server cache
      await base44.functions.invoke("getPricingConfig", { force_refresh: true }).catch(() => {});
    }
    setPendingChange(null);
  };

  const fmt = (v, type) => {
    if (type === "currency") return `$${Number(v).toFixed(2)}`;
    if (type === "percentage") return `${v}%`;
    if (type === "days") return `${v} days`;
    return String(v);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-7 h-7 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  const sectionCard = (title, children, note) => (
    <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1A3226]/8 bg-[#1A3226]/2">
        <h2 className="text-sm font-semibold text-[#1A3226] uppercase tracking-wider">{title}</h2>
        {note && <p className="text-xs text-[#1A3226]/50 mt-0.5">{note}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Pricing Configuration</h1>
          <p className="text-sm text-[#1A3226]/50 mt-1">All prices, caps, and thresholds. Changes take effect immediately for new subscribers.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConfigs} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* TIER PRICING */}
      {sectionCard("Tier Pricing", (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: "starter_monthly_price", label: "Starter", color: "bg-gray-50 border-gray-200" },
            { key: "pro_monthly_price", label: "Pro", color: "bg-[#B8982F]/5 border-[#B8982F]/30" },
            { key: "team_monthly_price", label: "Team", color: "bg-[#1A3226]/5 border-[#1A3226]/20" },
          ].map(({ key, label, color }) => {
            const rec = getRecord(key);
            return (
              <div key={key} className={`rounded-xl border p-4 ${color}`}>
                <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">{label} Territory</p>
                <PricingField configKey={key} value={getValue(key)} valueType="currency" label={rec?.display_label} onSave={requestSave} />
                <p className="text-xs text-[#1A3226]/40 mt-1">per month</p>
              </div>
            );
          })}
        </div>
      ))}

      {/* ANALYSIS CAPS */}
      {sectionCard("Analysis Caps", (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { key: "starter_analyses_cap", label: "Starter Cap" },
            { key: "pro_analyses_cap", label: "Pro Cap" },
            { key: "team_analyses_cap", label: "Team Cap" },
          ].map(({ key, label }) => {
            const rec = getRecord(key);
            return (
              <div key={key}>
                <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">{label}</p>
                <PricingField configKey={key} value={getValue(key)} valueType="integer" label={rec?.display_label} onSave={requestSave} />
                <p className="text-xs text-[#1A3226]/40 mt-1">analyses / month</p>
                <p className="text-xs text-amber-600 mt-1">Affects all subscribers at next monthly reset</p>
              </div>
            );
          })}
        </div>
      ))}

      {/* OVERAGE */}
      {sectionCard("Overage Pricing", (
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">Price Per Extra Analysis</p>
            <PricingField configKey="overage_price_per_analysis" value={getValue("overage_price_per_analysis")} valueType="currency" label="Overage Price Per Analysis" onSave={requestSave} />
          </div>
        </div>
      ))}

      {/* BUNDLE DISCOUNTS */}
      {sectionCard("Bundle Discounts", (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A3226]/10">
                {["Bundle", "Min Territories", "Max Territories", "Discount %", "Cap Multiplier %"].map(h => (
                  <th key={h} className="text-left pb-2 pr-6 text-xs text-[#1A3226]/50 font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A3226]/5">
              {[
                { name: "Duo", min: "bundle_duo_min", max: null, disc: "bundle_duo_discount", mult: "bundle_duo_cap_multiplier" },
                { name: "Trio", min: "bundle_trio_min", max: "bundle_trio_max", disc: "bundle_trio_discount", mult: "bundle_trio_cap_multiplier" },
                { name: "Regional", min: "bundle_regional_min", max: "bundle_regional_max", disc: "bundle_regional_discount", mult: "bundle_regional_cap_multiplier" },
                { name: "District", min: "bundle_district_min", max: "bundle_district_max", disc: "bundle_district_discount", mult: "bundle_district_cap_multiplier" },
                { name: "Master", min: "bundle_master_min", max: null, disc: "bundle_master_discount", mult: "bundle_master_cap_multiplier" },
              ].map((row) => (
                <tr key={row.name} className="py-2">
                  <td className="py-2 pr-6 font-medium text-[#1A3226]">{row.name}</td>
                  <td className="py-2 pr-6"><PricingField configKey={row.min} value={getValue(row.min)} valueType="integer" onSave={requestSave} /></td>
                  <td className="py-2 pr-6">{row.max ? <PricingField configKey={row.max} value={getValue(row.max)} valueType="integer" onSave={requestSave} /> : <span className="text-[#1A3226]/30 text-xs">No max</span>}</td>
                  <td className="py-2 pr-6"><PricingField configKey={row.disc} value={getValue(row.disc)} valueType="percentage" onSave={requestSave} /></td>
                  <td className="py-2"><PricingField configKey={row.mult} value={getValue(row.mult)} valueType="percentage" onSave={requestSave} /></td>
                </tr>
              ))}
              {/* County row — different structure */}
              <tr className="py-2 bg-amber-50/40">
                <td className="py-2 pr-6 font-medium text-[#1A3226]">County</td>
                <td className="py-2 pr-6 text-xs text-[#1A3226]/40">All towns</td>
                <td className="py-2 pr-6 text-xs text-[#1A3226]/40">—</td>
                <td className="py-2 pr-6"><PricingField configKey="bundle_county_discount" value={getValue("bundle_county_discount")} valueType="percentage" onSave={requestSave} /></td>
                <td className="py-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-[#1A3226]/50">Floor: <PricingField configKey="bundle_county_floor_price" value={getValue("bundle_county_floor_price")} valueType="currency" onSave={requestSave} /></div>
                    <div className="flex items-center gap-1 text-xs text-[#1A3226]/50">Cap: <PricingField configKey="bundle_county_analyses_cap" value={getValue("bundle_county_analyses_cap")} valueType="integer" onSave={requestSave} /> /mo</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* POPULATION POOL */}
      {sectionCard("Population Pool", (
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">Residents Per Bucket</p>
            <PricingField configKey="pool_bucket_size" value={getValue("pool_bucket_size")} valueType="integer" label="Population Pool — Residents Per Bucket" onSave={requestSave} />
          </div>
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Changing the bucket size affects how many towns fit in each pricing tier. This is a significant change — existing pools will be recalculated at their next billing cycle.
          </p>
        </div>
      ))}

      {/* BUYOUT DISCOUNTS */}
      {sectionCard("Full City Buyout Discounts", (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1A3226]/10">
                  <th className="text-left pb-2 pr-6 text-xs text-[#1A3226]/50 font-medium uppercase tracking-wider">Seat Bracket</th>
                  <th className="text-left pb-2 text-xs text-[#1A3226]/50 font-medium uppercase tracking-wider">Discount %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A3226]/5">
                {[
                  { label: "2-Seat City", key: "buyout_2seat_discount" },
                  { label: "3–4 Seat City", key: "buyout_3_4seat_discount" },
                  { label: "5–9 Seat City", key: "buyout_5_9seat_discount" },
                  { label: "10+ Seat City", key: "buyout_10plus_seat_discount" },
                ].map((row) => (
                  <tr key={row.key}>
                    <td className="py-2 pr-6 text-[#1A3226] font-medium">{row.label}</td>
                    <td className="py-2"><PricingField configKey={row.key} value={getValue(row.key)} valueType="percentage" onSave={requestSave} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">Right of First Refusal</p>
            <div className="flex items-center gap-2">
              <PricingField configKey="buyout_refusal_days" value={getValue("buyout_refusal_days")} valueType="days" label="Buyout — Right of First Refusal Days" onSave={requestSave} />
            </div>
          </div>
        </div>
      ))}

      {/* TOP-UP PACKS */}
      {sectionCard("Top-Up Packs", (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1A3226]/10">
                  {["Pack", "Analyses", "Price", "Per-Analysis Cost"].map(h => (
                    <th key={h} className="text-left pb-2 pr-6 text-xs text-[#1A3226]/50 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A3226]/5">
                {[
                  { name: "Starter", analyses: "topup_starter_analyses", price: "topup_starter_price" },
                  { name: "Standard", analyses: "topup_standard_analyses", price: "topup_standard_price" },
                  { name: "Pro", analyses: "topup_pro_analyses", price: "topup_pro_price" },
                  { name: "Bulk", analyses: "topup_bulk_analyses", price: "topup_bulk_price" },
                ].map((row) => {
                  const analyses = getValue(row.analyses);
                  const price = getValue(row.price);
                  const perAnalysis = analyses > 0 ? (price / analyses).toFixed(2) : "—";
                  return (
                    <tr key={row.name}>
                      <td className="py-2 pr-6 font-medium text-[#1A3226]">{row.name}</td>
                      <td className="py-2 pr-6"><PricingField configKey={row.analyses} value={analyses} valueType="integer" onSave={requestSave} /></td>
                      <td className="py-2 pr-6"><PricingField configKey={row.price} value={price} valueType="currency" onSave={requestSave} /></td>
                      <td className="py-2 text-[#1A3226]/50 text-xs">${perAnalysis}/analysis</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">Pack Expiry</p>
            <PricingField configKey="topup_expiry_days" value={getValue("topup_expiry_days")} valueType="days" label="Top-Up Pack — Expiry Days" onSave={requestSave} />
          </div>
        </div>
      ))}

      {/* REVENUE SHARE */}
      {sectionCard("Revenue Share", (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { key: "sublicense_default_share_pct", label: "Default Share %" },
            { key: "sublicense_min_share_pct", label: "Minimum Share %" },
            { key: "sublicense_max_share_pct", label: "Maximum Share %" },
          ].map(({ key, label }) => (
            <div key={key}>
              <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">{label}</p>
              <PricingField configKey={key} value={getValue(key)} valueType="percentage" label={label} onSave={requestSave} />
            </div>
          ))}
          <div className="sm:col-span-3">
            <p className="text-xs text-[#1A3226]/50 bg-[#1A3226]/4 rounded-lg px-3 py-2">
              Min and Max enforce the range available in the sublicensing modal when a territory owner sets up a revenue share arrangement.
            </p>
          </div>
        </div>
      ))}

      {/* THRESHOLDS */}
      {sectionCard("Thresholds & Automation", (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { key: "auto_approve_hours", label: "Auto-Approval Hours", note: "Hours until a pending claim is auto-approved if admin has not acted" },
              { key: "rejection_recliam_days", label: "Rejection Re-Claim Days", note: "Days a user must wait after rejection before re-applying" },
              { key: "founder_refusal_days", label: "Founder Right of First Refusal Days", note: "Days Eastern MA release towns are held for founder subscribers" },
            ].map(({ key, label, note }) => (
              <div key={key}>
                <p className="text-xs uppercase tracking-wider text-[#1A3226]/50 mb-1">{label}</p>
                <PricingField configKey={key} value={getValue(key)} valueType={key === "auto_approve_hours" ? "integer" : "days"} label={label} onSave={requestSave} />
                <p className="text-xs text-[#1A3226]/40 mt-1">{note}</p>
              </div>
            ))}
          </div>

          {/* Seat Size Formula — requires CONFIRM */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Territory Seat Formula</p>
                <p className="text-xs text-red-600 mt-0.5">
                  ⚠️ Changing the seat size formula recalculates seats_total for every territory. This is irreversible without a data restore. Only change this if you are certain.
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-red-400 mb-1">Residents Per Seat</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-red-700">{getValue("territory_seat_size").toLocaleString()} residents/seat</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-100 text-xs"
                  onClick={() => {
                    const newVal = prompt("Enter new residents-per-seat value (currently " + getValue("territory_seat_size") + "):");
                    if (!newVal) return;
                    const parsed = parseInt(newVal);
                    if (isNaN(parsed) || parsed < 1000) { alert("Invalid value."); return; }
                    const confirm = window.prompt('Type CONFIRM to change the seat formula to ' + parsed + ' residents/seat:');
                    if (confirm !== "CONFIRM") { alert("Change cancelled."); return; }
                    requestSave("territory_seat_size", parsed);
                  }}
                >
                  Change Formula
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* AUDIT LOG */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1A3226]/8 bg-[#1A3226]/2">
          <h2 className="text-sm font-semibold text-[#1A3226] uppercase tracking-wider">Change Audit Log</h2>
          <p className="text-xs text-[#1A3226]/50 mt-0.5">Last 50 pricing changes</p>
        </div>
        <div className="p-6">
          <PricingChangeLogTable key={logKey} />
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmPricingModal
        open={!!pendingChange}
        onClose={() => setPendingChange(null)}
        onConfirm={confirmSave}
        label={pendingChange?.record?.display_label || pendingChange?.configKey}
        oldValue={pendingChange?.record?.config_value}
        newValue={pendingChange?.newValue}
        valueType={pendingChange?.record?.value_type}
        requireConfirmText={pendingChange?.configKey === "territory_seat_size" || pendingChange?.configKey === "pool_bucket_size"}
      />
    </div>
  );
}